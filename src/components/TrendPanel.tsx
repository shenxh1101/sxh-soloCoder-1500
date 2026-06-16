import React, { useMemo, useState, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useFarmStore } from '../store/useFarmStore';
import { SensorHistory } from '../types';
import { Layers, BarChart3, AlertTriangle, X, Thermometer, Droplets, AlertCircle } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const POSITION_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

interface AnomalyDetail {
  hourLabel: string;
  temperature: number;
  humidity: number;
  tempAlert: boolean;
  humAlert: boolean;
  tempReason: string;
  humReason: string;
}

const interpolateNulls = (values: (number | null)[]): number[] => {
  const result = [...values] as (number | null)[];
  
  let lastValidIdx = -1;
  for (let i = 0; i < result.length; i++) {
    if (result[i] !== null) {
      lastValidIdx = i;
    } else if (lastValidIdx !== -1) {
      let nextValidIdx = -1;
      for (let j = i + 1; j < result.length; j++) {
        if (result[j] !== null) {
          nextValidIdx = j;
          break;
        }
      }
      if (nextValidIdx !== -1) {
        const span = nextValidIdx - lastValidIdx;
        const startVal = result[lastValidIdx] as number;
        const endVal = result[nextValidIdx] as number;
        for (let k = lastValidIdx + 1; k < nextValidIdx; k++) {
          const ratio = (k - lastValidIdx) / span;
          result[k] = startVal + (endVal - startVal) * ratio;
        }
        lastValidIdx = nextValidIdx - 1;
      }
    }
  }

  let firstValid = result.findIndex(v => v !== null);
  if (firstValid > 0) {
    const val = result[firstValid] as number;
    for (let i = 0; i < firstValid; i++) result[i] = val;
  }

  let lastValid = -1;
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i] !== null) { lastValid = i; break; }
  }
  if (lastValid !== -1 && lastValid < result.length - 1) {
    const val = result[lastValid] as number;
    for (let i = lastValid + 1; i < result.length; i++) result[i] = val;
  }

  return result.map(v => v ?? 25);
};

export const TrendPanel: React.FC = () => {
  const {
    sensorHistory,
    cages,
    selectedCageId,
    selectedFloorForTrend,
    trendViewMode,
    setTrendViewMode,
    setSelectedFloorForTrend,
    lastValidConfig,
    getFeedImpactAnalysis,
  } = useFarmStore();

  const [anomalyDetail, setAnomalyDetail] = useState<AnomalyDetail | null>(null);
  const chartRef = useRef<any>(null);

  const twentyFourHoursAgo = useMemo(() => new Date(Date.now() - 24 * 60 * 60 * 1000), []);

  const timeLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 24; i >= 0; i--) {
      const d = new Date(Date.now() - i * 60 * 60 * 1000);
      labels.push(`${d.getHours().toString().padStart(2, '0')}:00`);
    }
    return labels;
  }, []);

  const aggregateByHour = (history: SensorHistory[]) => {
    const buckets: Record<string, { temps: number[]; hums: number[]; hasAlert: boolean; tempAlert: boolean; humAlert: boolean }> = {};
    
    history.forEach(h => {
      if (h.time < twentyFourHoursAgo) return;
      const key = `${h.time.getHours().toString().padStart(2, '0')}:00`;
      if (!buckets[key]) buckets[key] = { temps: [], hums: [], hasAlert: false, tempAlert: false, humAlert: false };
      buckets[key].temps.push(h.temperature);
      buckets[key].hums.push(h.humidity);
      
      const tempOut = h.temperature < lastValidConfig.tempMin || h.temperature > lastValidConfig.tempMax;
      const humOut = h.humidity < lastValidConfig.humidityMin || h.humidity > lastValidConfig.humidityMax;
      if (tempOut || humOut) {
        buckets[key].hasAlert = true;
        if (tempOut) buckets[key].tempAlert = true;
        if (humOut) buckets[key].humAlert = true;
      }
    });

    return buckets;
  };

  const singleCageData = useMemo(() => {
    if (!selectedCageId) return null;
    const cage = cages.find(c => c.id === selectedCageId);
    if (!cage) return null;

    const cageHistory = sensorHistory.filter(h => h.cageId === selectedCageId);
    const buckets = aggregateByHour(cageHistory);

    const rawTemps = timeLabels.map(t => {
      const b = buckets[t];
      return b && b.temps.length > 0
        ? b.temps.reduce((a, b) => a + b, 0) / b.temps.length
        : null;
    });

    const rawHums = timeLabels.map(t => {
      const b = buckets[t];
      return b && b.hums.length > 0
        ? b.hums.reduce((a, b) => a + b, 0) / b.hums.length
        : null;
    });

    const temps = interpolateNulls(rawTemps);
    const hums = interpolateNulls(rawHums);

    const alertInfo = timeLabels.map((t, i) => {
      const b = buckets[t];
      return {
        hasAlert: b?.hasAlert ?? false,
        tempAlert: b?.tempAlert ?? false,
        humAlert: b?.humAlert ?? false,
        temp: temps[i],
        hum: hums[i],
      };
    });

    const alertPointIndices = alertInfo
      .map((info, i) => (info.hasAlert ? i : null))
      .filter(i => i !== null) as number[];

    const feedImpact = getFeedImpactAnalysis(selectedCageId);

    return { cage, temps, hums, alertInfo, alertPoints: alertPointIndices, feedImpact };
  }, [selectedCageId, sensorHistory, timeLabels, twentyFourHoursAgo, lastValidConfig, cages, getFeedImpactAnalysis]);

  const floorData = useMemo(() => {
    if (trendViewMode !== 'floor') return null;
    const floorCages = cages.filter(c => c.floor === selectedFloorForTrend);
    const result = floorCages.map(cage => {
      const cageHistory = sensorHistory.filter(h => h.cageId === cage.id);
      const buckets = aggregateByHour(cageHistory);
      const rawTemps = timeLabels.map(t => {
        const b = buckets[t];
        return b && b.temps.length > 0
          ? b.temps.reduce((a, b) => a + b, 0) / b.temps.length
          : null;
      });
      const temps = interpolateNulls(rawTemps);
      return { cage, temps };
    });
    return result;
  }, [selectedFloorForTrend, sensorHistory, timeLabels, twentyFourHoursAgo, lastValidConfig, cages, trendViewMode]);

  const chartData = useMemo(() => {
    if (trendViewMode === 'single' && singleCageData) {
      const { temps, hums, alertPoints } = singleCageData;
      return {
        labels: timeLabels,
        datasets: [
          {
            label: '温度 (°C)',
            data: temps,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            yAxisID: 'y',
            tension: 0.3,
            fill: true,
            pointRadius: (ctx: any) => (alertPoints.includes(ctx.dataIndex) ? 8 : 3),
            pointBackgroundColor: (ctx: any) => (alertPoints.includes(ctx.dataIndex) ? '#ef4444' : '#ef4444'),
            pointBorderColor: (ctx: any) => (alertPoints.includes(ctx.dataIndex) ? '#fef08a' : '#ef4444'),
            pointBorderWidth: (ctx: any) => (alertPoints.includes(ctx.dataIndex) ? 3 : 1),
            pointHoverRadius: 10,
          },
          {
            label: '湿度 (%)',
            data: hums,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            yAxisID: 'y1',
            tension: 0.3,
            fill: true,
            pointRadius: (ctx: any) => (alertPoints.includes(ctx.dataIndex) ? 8 : 3),
            pointBackgroundColor: (ctx: any) => (alertPoints.includes(ctx.dataIndex) ? '#3b82f6' : '#3b82f6'),
            pointBorderColor: (ctx: any) => (alertPoints.includes(ctx.dataIndex) ? '#fef08a' : '#3b82f6'),
            pointBorderWidth: (ctx: any) => (alertPoints.includes(ctx.dataIndex) ? 3 : 1),
            pointHoverRadius: 10,
          },
        ],
      };
    }

    if (trendViewMode === 'floor' && floorData) {
      return {
        labels: timeLabels,
        datasets: floorData.map((fd, idx) => ({
          label: fd.cage.id,
          data: fd.temps,
          borderColor: POSITION_COLORS[idx % POSITION_COLORS.length],
          backgroundColor: `${POSITION_COLORS[idx % POSITION_COLORS.length]}20`,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 5,
        })),
      };
    }

    return { labels: timeLabels, datasets: [] };
  }, [trendViewMode, singleCageData, floorData, timeLabels]);

  const chartOptions = useMemo(() => {
    const isSingle = trendViewMode === 'single';
    return {
      responsive: true,
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
      onClick: (_e: any, elements: any[]) => {
        if (!isSingle || !singleCageData || elements.length === 0) return;
        const idx = elements[0].index;
        const info = singleCageData.alertInfo[idx];
        if (!info?.hasAlert) return;

        let tempReason = '';
        if (info.tempAlert) {
          if (info.temp < lastValidConfig.tempMin) {
            tempReason = `低于下限 ${lastValidConfig.tempMin}°C，差值 ${(lastValidConfig.tempMin - info.temp).toFixed(1)}°C`;
          } else {
            tempReason = `高于上限 ${lastValidConfig.tempMax}°C，差值 ${(info.temp - lastValidConfig.tempMax).toFixed(1)}°C`;
          }
        }

        let humReason = '';
        if (info.humAlert) {
          if (info.hum < lastValidConfig.humidityMin) {
            humReason = `低于下限 ${lastValidConfig.humidityMin}%，差值 ${(lastValidConfig.humidityMin - info.hum).toFixed(1)}%`;
          } else {
            humReason = `高于上限 ${lastValidConfig.humidityMax}%，差值 ${(info.hum - lastValidConfig.humidityMax).toFixed(1)}%`;
          }
        }

        setAnomalyDetail({
          hourLabel: timeLabels[idx],
          temperature: info.temp,
          humidity: info.hum,
          tempAlert: info.tempAlert,
          humAlert: info.humAlert,
          tempReason,
          humReason,
        });
      },
      plugins: {
        legend: {
          labels: {
            color: '#e2e8f0',
            font: { size: 10 },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleColor: '#e2e8f0',
          bodyColor: '#e2e8f0',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: (context: any) => {
              const label = context.dataset.label || '';
              const value = context.parsed.y.toFixed(1);
              return `${label}: ${value}${label.includes('温度') ? '°C' : '%'}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8', font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
          grid: { color: 'rgba(51, 65, 85, 0.5)' },
        },
        y: isSingle ? {
          type: 'linear' as const,
          display: true,
          position: 'left' as const,
          title: { display: true, text: '温度 (°C)', color: '#ef4444', font: { size: 10 } },
          ticks: { color: '#94a3b8', font: { size: 9 } },
          grid: { color: 'rgba(51, 65, 85, 0.5)' },
          suggestedMin: lastValidConfig.tempMin - 5,
          suggestedMax: lastValidConfig.tempMax + 5,
        } : {
          ticks: { color: '#94a3b8', font: { size: 9 } },
          grid: { color: 'rgba(51, 65, 85, 0.5)' },
          title: { display: true, text: '温度 (°C)', color: '#e2e8f0', font: { size: 10 } },
        },
        ...(isSingle ? {
          y1: {
            type: 'linear' as const,
            display: true,
            position: 'right' as const,
            title: { display: true, text: '湿度 (%)', color: '#3b82f6', font: { size: 10 } },
            ticks: { color: '#94a3b8', font: { size: 9 } },
            grid: { drawOnChartArea: false },
            suggestedMin: lastValidConfig.humidityMin - 10,
            suggestedMax: lastValidConfig.humidityMax + 10,
          },
        } : {}),
      },
    };
  }, [trendViewMode, lastValidConfig, singleCageData, timeLabels]);

  return (
    <div className="absolute bottom-20 left-4 right-88 bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden shadow-2xl">
      <div className="p-3 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-cyan-400" />
          <span className="text-white text-sm font-semibold">历史趋势 (24小时)</span>
          {trendViewMode === 'single' && singleCageData?.alertPoints && singleCageData.alertPoints.length > 0 && (
            <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full">
              <AlertTriangle size={12} />
              {singleCageData.alertPoints.length} 个异常点
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTrendViewMode('single')}
            disabled={!selectedCageId}
            className={`text-xs px-3 py-1 rounded-lg transition-colors ${
              trendViewMode === 'single'
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {selectedCageId ? `单笼位: ${selectedCageId}` : '选择笼位'}
          </button>
          <button
            onClick={() => setTrendViewMode('floor')}
            className={`text-xs px-3 py-1 rounded-lg transition-colors flex items-center gap-1 ${
              trendViewMode === 'floor'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <Layers size={12} />
            整层对比
          </button>
          {trendViewMode === 'floor' && (
            <div className="flex gap-1">
              {[1, 2, 3].map(floor => (
                <button
                  key={floor}
                  onClick={() => setSelectedFloorForTrend(floor as 1 | 2 | 3)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    selectedFloorForTrend === floor
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  第{floor}层
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {trendViewMode === 'single' && singleCageData?.feedImpact && (
        <div className="px-3 py-2 bg-cyan-950/30 border-b border-cyan-800/30 flex items-center gap-4 text-xs">
          <span className="text-cyan-400 font-medium">最近投料影响:</span>
          <span className="text-slate-300">
            投料前 <span className="text-white font-semibold">{singleCageData.feedImpact.before}°C</span>
          </span>
          <span className="text-slate-500">→</span>
          <span className="text-slate-300">
            投料后 <span className="text-white font-semibold">{singleCageData.feedImpact.after}°C</span>
          </span>
          <span className={`font-semibold ${singleCageData.feedImpact.change > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {singleCageData.feedImpact.change > 0 ? '+' : ''}{singleCageData.feedImpact.change}°C
          </span>
        </div>
      )}

      <div className="p-3 h-52 relative">
        {trendViewMode === 'single' && !selectedCageId ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            请从左侧或3D场景中选择一个笼位查看趋势
          </div>
        ) : (
          <Line ref={chartRef} data={chartData} options={chartOptions} />
        )}

        {anomalyDetail && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-slate-900 border border-yellow-600/50 rounded-lg p-4 shadow-2xl z-10 min-w-64">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-yellow-400" />
                <span className="text-yellow-400 font-semibold text-sm">异常点详情 - {anomalyDetail.hourLabel}</span>
              </div>
              <button
                onClick={() => setAnomalyDetail(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Thermometer size={14} className={anomalyDetail.tempAlert ? 'text-red-400' : 'text-slate-400'} />
                <span className={`${anomalyDetail.tempAlert ? 'text-red-400 font-semibold' : 'text-slate-300'}`}>
                  温度: {anomalyDetail.temperature.toFixed(1)}°C
                </span>
                {anomalyDetail.tempAlert && (
                  <span className="text-xs text-red-300 bg-red-500/10 px-1.5 py-0.5 rounded">
                    {anomalyDetail.tempReason}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Droplets size={14} className={anomalyDetail.humAlert ? 'text-blue-400' : 'text-slate-400'} />
                <span className={`${anomalyDetail.humAlert ? 'text-blue-400 font-semibold' : 'text-slate-300'}`}>
                  湿度: {anomalyDetail.humidity.toFixed(1)}%
                </span>
                {anomalyDetail.humAlert && (
                  <span className="text-xs text-blue-300 bg-blue-500/10 px-1.5 py-0.5 rounded">
                    {anomalyDetail.humReason}
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">点击图表其他位置或关闭按钮继续查看</p>
          </div>
        )}
      </div>
    </div>
  );
};

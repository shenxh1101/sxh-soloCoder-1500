import React, { useMemo } from 'react';
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
import { Layers, BarChart3, AlertTriangle } from 'lucide-react';

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

const FLOOR_COLORS = [
  { temp: '#ef4444', hum: '#3b82f6', border: '#22c55e' },
  { temp: '#f97316', hum: '#8b5cf6', border: '#eab308' },
  { temp: '#ec4899', hum: '#06b6d4', border: '#a855f7' },
];

const POSITION_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

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
  } = useFarmStore();

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
    const buckets: Record<string, { temps: number[]; hums: number[]; hasAlert: boolean }> = {};
    
    history.forEach(h => {
      if (h.time < twentyFourHoursAgo) return;
      const key = `${h.time.getHours()}:00`;
      if (!buckets[key]) buckets[key] = { temps: [], hums: [], hasAlert: false };
      buckets[key].temps.push(h.temperature);
      buckets[key].hums.push(h.humidity);
      
      if (
        h.temperature < lastValidConfig.tempMin ||
        h.temperature > lastValidConfig.tempMax ||
        h.humidity < lastValidConfig.humidityMin ||
        h.humidity > lastValidConfig.humidityMax
      ) {
        buckets[key].hasAlert = true;
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

    const temps = timeLabels.map(t => {
      const b = buckets[t];
      return b && b.temps.length > 0
        ? b.temps.reduce((a, b) => a + b, 0) / b.temps.length
        : null;
    });

    const hums = timeLabels.map(t => {
      const b = buckets[t];
      return b && b.hums.length > 0
        ? b.hums.reduce((a, b) => a + b, 0) / b.hums.length
        : null;
    });

    const alertPoints = timeLabels.map((t, i) => {
      const b = buckets[t];
      return b?.hasAlert ? i : null;
    }).filter(i => i !== null) as number[];

    return { cage, temps, hums, alertPoints };
  }, [selectedCageId, sensorHistory, timeLabels, twentyFourHoursAgo, lastValidConfig, cages]);

  const floorData = useMemo(() => {
    if (trendViewMode !== 'floor') return null;
    const floorCages = cages.filter(c => c.floor === selectedFloorForTrend);
    const result = floorCages.map(cage => {
      const cageHistory = sensorHistory.filter(h => h.cageId === cage.id);
      const buckets = aggregateByHour(cageHistory);
      const temps = timeLabels.map(t => {
        const b = buckets[t];
        return b && b.temps.length > 0
          ? b.temps.reduce((a, b) => a + b, 0) / b.temps.length
          : null;
      });
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
      plugins: {
        legend: {
          labels: {
            color: '#e2e8f0',
            font: { size: 10 },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleColor: '#e2e8f0',
          bodyColor: '#e2e8f0',
          borderColor: '#334155',
          borderWidth: 1,
        },
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8', font: { size: 9 } },
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
  }, [trendViewMode, lastValidConfig]);

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
      <div className="p-3 h-52">
        {trendViewMode === 'single' && !selectedCageId ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-sm">
            请从左侧或3D场景中选择一个笼位查看趋势
          </div>
        ) : (
          <Line data={chartData} options={chartOptions} />
        )}
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useFarmStore } from '../store/useFarmStore';
import { 
  Thermometer, Droplets, Settings, UtensilsCrossed, 
  PlayCircle, PauseCircle, FileText, Download, Clock,
  ChevronDown, ChevronUp, Trash2, Plus
} from 'lucide-react';
import { downloadCSV } from '../utils/csvExporter';
import { formatReportAsText } from '../utils/reportGenerator';

export const ControlPanel: React.FC = () => {
  const {
    cages,
    selectedCageId,
    systemConfig,
    timerSchedules,
    isAutoInspecting,
    robot,
    selectCage,
    feedCage,
    feedFloor,
    feedAll,
    updateConfig,
    toggleAutoInspect,
    generateDailyReport,
    exportSensorHistoryToCSV,
    addTimerSchedule,
    removeTimerSchedule,
    toggleTimerSchedule,
  } = useFarmStore();

  const [expandedSections, setExpandedSections] = useState({
    cageSelect: true,
    feedControl: true,
    thresholds: true,
    schedule: true,
    reports: true,
  });

  const [newScheduleTime, setNewScheduleTime] = useState('08:00');
  const [newScheduleTarget, setNewScheduleTarget] = useState<'all' | 'floor1' | 'floor2' | 'floor3'>('all');
  const [feedTarget, setFeedTarget] = useState<'single' | 'floor' | 'all'>('single');
  const [selectedFloor, setSelectedFloor] = useState<1 | 2 | 3>(1);
  const [isFeeding, setIsFeeding] = useState(false);

  const selectedCage = cages.find(c => c.id === selectedCageId);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleFeed = async () => {
    if (isFeeding || robot.status !== 'idle') return;
    
    setIsFeeding(true);
    try {
      if (feedTarget === 'single' && selectedCageId) {
        await feedCage(selectedCageId, 'manual');
      } else if (feedTarget === 'floor') {
        await feedFloor(selectedFloor, 'batch');
      } else if (feedTarget === 'all') {
        await feedAll('batch');
      }
    } finally {
      setIsFeeding(false);
    }
  };

  const handleExportCSV = () => {
    const csvContent = exportSensorHistoryToCSV();
    const filename = `sensor_history_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csvContent, filename);
  };

  const handleGenerateReport = () => {
    const report = generateDailyReport();
    const reportText = formatReportAsText(report);
    
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `daily_report_${report.date}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleAddSchedule = () => {
    if (!newScheduleTime) return;
    addTimerSchedule({
      time: newScheduleTime,
      enabled: true,
      target: newScheduleTarget,
    });
  };

  const getRobotStatusText = () => {
    switch (robot.status) {
      case 'idle': return '待机中';
      case 'moving': return '移动中';
      case 'feeding': return '投料中';
      default: return '未知';
    }
  };

  const getRobotStatusColor = () => {
    switch (robot.status) {
      case 'idle': return 'text-green-400';
      case 'moving': return 'text-blue-400';
      case 'feeding': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="w-80 h-full bg-slate-900/95 backdrop-blur-xl border-r border-slate-700/50 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-700/50">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-2xl">🏭</span>
          智能养殖监控系统
        </h1>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="text-slate-400">机器人状态:</span>
          <span className={`font-mono ${getRobotStatusColor()}`}>
            {getRobotStatusText()}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700/50">
          <button
            onClick={() => toggleSection('cageSelect')}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-700/30 transition-colors"
          >
            <span className="text-white font-semibold flex items-center gap-2">
              <span className="text-lg">🔢</span> 笼位选择
            </span>
            {expandedSections.cageSelect ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </button>
          
          {expandedSections.cageSelect && (
            <div className="p-3 pt-0">
              <div className="grid grid-cols-8 gap-1">
                {[1, 2, 3].map(floor => (
                  <React.Fragment key={floor}>
                    <div className="col-span-8 text-xs text-slate-400 mt-2 mb-1 font-medium">
                      第 {floor} 层
                    </div>
                    {Array.from({ length: 8 }, (_, i) => i + 1).map(pos => {
                      const cageId = `F${floor}-P${pos}`;
                      const cage = cages.find(c => c.id === cageId);
                      const isSelected = selectedCageId === cageId;
                      const hasAlert = cage?.hasAlert;
                      
                      return (
                        <button
                          key={cageId}
                          onClick={() => selectCage(isSelected ? null : cageId)}
                          className={`
                            w-full aspect-square rounded-lg text-xs font-mono transition-all duration-200
                            ${isSelected 
                              ? 'bg-green-600 text-white shadow-lg shadow-green-500/30' 
                              : hasAlert 
                                ? 'bg-red-600 text-white animate-pulse' 
                                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                            }
                          `}
                        >
                          {pos}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
              
              {selectedCage && (
                <div className="mt-4 p-3 bg-slate-900/50 rounded-lg border border-slate-600/50">
                  <div className="text-sm font-semibold text-white mb-2">
                    {selectedCage.id} 详细信息
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Thermometer size={14} className={selectedCage.alertType === 'temperature' ? 'text-red-400' : 'text-green-400'} />
                        温度
                      </span>
                      <span className={`font-mono ${selectedCage.alertType === 'temperature' ? 'text-red-400' : 'text-green-400'}`}>
                        {selectedCage.temperature.toFixed(1)}°C
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Droplets size={14} className={selectedCage.alertType === 'humidity' ? 'text-red-400' : 'text-blue-400'} />
                        湿度
                      </span>
                      <span className={`font-mono ${selectedCage.alertType === 'humidity' ? 'text-red-400' : 'text-blue-400'}`}>
                        {selectedCage.humidity.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1">
                        <UtensilsCrossed size={14} className="text-yellow-400" />
                        今日投料
                      </span>
                      <span className="font-mono text-yellow-400">
                        {selectedCage.feedCount} 次
                      </span>
                    </div>
                    {selectedCage.lastFeedTime && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">上次投料</span>
                        <span className="font-mono text-slate-300 text-xs">
                          {selectedCage.lastFeedTime.toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700/50">
          <button
            onClick={() => toggleSection('feedControl')}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-700/30 transition-colors"
          >
            <span className="text-white font-semibold flex items-center gap-2">
              <span className="text-lg">🍽️</span> 投料控制
            </span>
            {expandedSections.feedControl ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </button>
          
          {expandedSections.feedControl && (
            <div className="p-3 pt-0 space-y-3">
              <div className="flex gap-2">
                {(['single', 'floor', 'all'] as const).map(target => (
                  <button
                    key={target}
                    onClick={() => setFeedTarget(target)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                      feedTarget === target
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {target === 'single' ? '单个' : target === 'floor' ? '整层' : '全部'}
                  </button>
                ))}
              </div>

              {feedTarget === 'floor' && (
                <div className="flex gap-2">
                  {[1, 2, 3].map(floor => (
                    <button
                      key={floor}
                      onClick={() => setSelectedFloor(floor as 1 | 2 | 3)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        selectedFloor === floor
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      第{floor}层
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={handleFeed}
                disabled={isFeeding || robot.status !== 'idle' || (feedTarget === 'single' && !selectedCageId)}
                className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-green-500/20 disabled:shadow-none flex items-center justify-center gap-2"
              >
                {isFeeding ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    执行中...
                  </>
                ) : (
                  <>
                    <UtensilsCrossed size={18} />
                    执行投料
                  </>
                )}
              </button>

              <button
                onClick={toggleAutoInspect}
                className={`w-full py-3 px-4 ${
                  isAutoInspecting
                    ? 'bg-gradient-to-r from-red-600 to-orange-600 shadow-red-500/20'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-500/20'
                } text-white font-semibold rounded-xl transition-all duration-200 shadow-lg flex items-center justify-center gap-2`}
              >
                {isAutoInspecting ? (
                  <>
                    <PauseCircle size={18} />
                    停止自动巡检
                  </>
                ) : (
                  <>
                    <PlayCircle size={18} />
                    启动自动巡检
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700/50">
          <button
            onClick={() => toggleSection('thresholds')}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-700/30 transition-colors"
          >
            <span className="text-white font-semibold flex items-center gap-2">
              <Settings size={18} className="text-slate-300" /> 阈值配置
            </span>
            {expandedSections.thresholds ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </button>
          
          {expandedSections.thresholds && (
            <div className="p-3 pt-0 space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-2 block">温度范围 (°C)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={systemConfig.tempMin}
                    onChange={e => updateConfig({ tempMin: parseFloat(e.target.value) })}
                    className="flex-1 bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-green-500 transition-colors"
                    step="0.5"
                  />
                  <span className="text-slate-500">~</span>
                  <input
                    type="number"
                    value={systemConfig.tempMax}
                    onChange={e => updateConfig({ tempMax: parseFloat(e.target.value) })}
                    className="flex-1 bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-green-500 transition-colors"
                    step="0.5"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm text-slate-400 mb-2 block">湿度范围 (%)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={systemConfig.humidityMin}
                    onChange={e => updateConfig({ humidityMin: parseFloat(e.target.value) })}
                    className="flex-1 bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
                    step="1"
                  />
                  <span className="text-slate-500">~</span>
                  <input
                    type="number"
                    value={systemConfig.humidityMax}
                    onChange={e => updateConfig({ humidityMax: parseFloat(e.target.value) })}
                    className="flex-1 bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
                    step="1"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700/50">
          <button
            onClick={() => toggleSection('schedule')}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-700/30 transition-colors"
          >
            <span className="text-white font-semibold flex items-center gap-2">
              <Clock size={18} className="text-purple-400" /> 定时计划
            </span>
            {expandedSections.schedule ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </button>
          
          {expandedSections.schedule && (
            <div className="p-3 pt-0 space-y-3">
              <div className="flex gap-2">
                <input
                  type="time"
                  value={newScheduleTime}
                  onChange={e => setNewScheduleTime(e.target.value)}
                  className="flex-1 bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-purple-500 transition-colors"
                />
                <select
                  value={newScheduleTarget}
                  onChange={e => setNewScheduleTarget(e.target.value as typeof newScheduleTarget)}
                  className="bg-slate-900/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 transition-colors"
                >
                  <option value="all">全部</option>
                  <option value="floor1">第1层</option>
                  <option value="floor2">第2层</option>
                  <option value="floor3">第3层</option>
                </select>
                <button
                  onClick={handleAddSchedule}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="space-y-2">
                {timerSchedules.map(schedule => (
                  <div
                    key={schedule.id}
                    className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                      schedule.enabled
                        ? 'bg-purple-900/30 border border-purple-500/30'
                        : 'bg-slate-900/30 border border-slate-700/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleTimerSchedule(schedule.id)}
                        className={`w-10 h-6 rounded-full transition-colors ${
                          schedule.enabled ? 'bg-purple-500' : 'bg-slate-600'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-white transition-transform ${
                            schedule.enabled ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <div>
                        <div className="font-mono text-white text-sm">
                          {schedule.time}
                        </div>
                        <div className="text-xs text-slate-400">
                          {schedule.target === 'all' ? '全部笼位' : `第${schedule.target.slice(-1)}层`}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeTimerSchedule(schedule.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700/50">
          <button
            onClick={() => toggleSection('reports')}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-700/30 transition-colors"
          >
            <span className="text-white font-semibold flex items-center gap-2">
              <span className="text-lg">📊</span> 数据报表
            </span>
            {expandedSections.reports ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </button>
          
          {expandedSections.reports && (
            <div className="p-3 pt-0 space-y-3">
              <button
                onClick={handleGenerateReport}
                className="w-full py-3 px-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                <FileText size={18} />
                生成养殖日报
              </button>
              
              <button
                onClick={handleExportCSV}
                className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
              >
                <Download size={18} />
                导出传感器数据 (CSV)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

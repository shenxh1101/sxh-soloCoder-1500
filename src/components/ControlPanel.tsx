import React, { useState } from 'react';
import { useFarmStore } from '../store/useFarmStore';
import { 
  Thermometer, Droplets, Settings, UtensilsCrossed, 
  PlayCircle, PauseCircle, FileText, Download, Clock,
  ChevronDown, ChevronUp, Trash2, Plus, AlertCircle, Check, X,
  Edit3, Calendar, SkipForward, Square, ListTodo, Gauge,
} from 'lucide-react';
import { downloadCSV } from '../utils/csvExporter';
import { formatReportAsText } from '../utils/reportGenerator';
import { FeedQueueFilterType, TimerSchedule } from '../types';

export const ControlPanel: React.FC = () => {
  const {
    cages,
    selectedCageId,
    systemConfig,
    lastValidConfig,
    configValidation,
    timerSchedules,
    isAutoInspecting,
    robot,
    feedQueue,
    selectCage,
    feedCage,
    feedFloor,
    feedAll,
    updateConfig,
    commitConfig,
    resetConfig,
    toggleAutoInspect,
    generateDailyReport,
    exportSensorHistoryToCSV,
    addTimerSchedule,
    updateTimerSchedule,
    removeTimerSchedule,
    toggleTimerSchedule,
    toggleSchedulePauseForDate,
    createFeedQueue,
    startFeedQueue,
    skipNextInQueue,
    cancelFeedQueue,
  } = useFarmStore();

  const [expandedSections, setExpandedSections] = useState({
    cageSelect: true,
    feedControl: true,
    feedQueue: false,
    thresholds: true,
    schedule: true,
    reports: true,
  });

  const [newScheduleTime, setNewScheduleTime] = useState('08:00');
  const [newScheduleTarget, setNewScheduleTarget] = useState<'all' | 'floor1' | 'floor2' | 'floor3'>('all');
  const [feedTarget, setFeedTarget] = useState<'single' | 'floor' | 'all'>('single');
  const [selectedFloor, setSelectedFloor] = useState<1 | 2 | 3>(1);
  const [isFeeding, setIsFeeding] = useState(false);

  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editTime, setEditTime] = useState('');
  const [editTarget, setEditTarget] = useState<'all' | 'floor1' | 'floor2' | 'floor3'>('all');

  const [queueFilter, setQueueFilter] = useState<FeedQueueFilterType>('all');
  const [queueFloor, setQueueFloor] = useState<1 | 2 | 3>(1);
  const [queueOverdueHours, setQueueOverdueHours] = useState(4);

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

  const handleTempMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value === '' ? NaN : parseFloat(e.target.value);
    updateConfig({ tempMin: val });
  };

  const handleTempMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value === '' ? NaN : parseFloat(e.target.value);
    updateConfig({ tempMax: val });
  };

  const handleHumMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value === '' ? NaN : parseFloat(e.target.value);
    updateConfig({ humidityMin: val });
  };

  const handleHumMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value === '' ? NaN : parseFloat(e.target.value);
    updateConfig({ humidityMax: val });
  };

  const allConfigValid = Object.values(configValidation).every(v => v.valid);
  const configHasChanges = 
    systemConfig.tempMin !== lastValidConfig.tempMin ||
    systemConfig.tempMax !== lastValidConfig.tempMax ||
    systemConfig.humidityMin !== lastValidConfig.humidityMin ||
    systemConfig.humidityMax !== lastValidConfig.humidityMax;

  const handleCreateQueue = () => {
    createFeedQueue(queueFilter, queueFloor, queueOverdueHours);
  };

  const handleStartQueue = async () => {
    setIsFeeding(true);
    try {
      await startFeedQueue();
    } finally {
      setIsFeeding(false);
    }
  };

  const completedCount = feedQueue.items.filter(i => i.status === 'completed').length;
  const skippedCount = feedQueue.items.filter(i => i.status === 'skipped').length;
  const failedCount = feedQueue.items.filter(i => i.status === 'failed').length;
  const queueProgress = feedQueue.items.length > 0 
    ? ((completedCount + skippedCount + failedCount) / feedQueue.items.length) * 100 
    : 0;

  const todayStr = new Date().toISOString().split('T')[0];

  const startEditSchedule = (schedule: TimerSchedule) => {
    setEditingScheduleId(schedule.id);
    setEditTime(schedule.time);
    setEditTarget(schedule.target);
  };

  const saveEditSchedule = () => {
    if (editingScheduleId) {
      updateTimerSchedule(editingScheduleId, { time: editTime, target: editTarget });
      setEditingScheduleId(null);
    }
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
        {/* 笼位选择 */}
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

        {/* 投料控制 */}
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

        {/* 批量投料队列 */}
        <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700/50">
          <button
            onClick={() => toggleSection('feedQueue')}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-700/30 transition-colors"
          >
            <span className="text-white font-semibold flex items-center gap-2">
              <ListTodo size={18} className="text-orange-400" /> 批量投料队列
            </span>
            {expandedSections.feedQueue ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </button>
          
          {expandedSections.feedQueue && (
            <div className="p-3 pt-0 space-y-3">
              <div className="space-y-2">
                <div className="flex gap-2 flex-wrap">
                  {([
                    { key: 'all', label: '全部' },
                    { key: 'floor', label: '按层' },
                    { key: 'alert', label: '异常笼位' },
                    { key: 'overdue', label: '超时未投' },
                  ] as const).map(item => (
                    <button
                      key={item.key}
                      onClick={() => setQueueFilter(item.key)}
                      className={`py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all ${
                        queueFilter === item.key
                          ? 'bg-orange-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {queueFilter === 'floor' && (
                  <div className="flex gap-2">
                    {[1, 2, 3].map(floor => (
                      <button
                        key={floor}
                        onClick={() => setQueueFloor(floor as 1 | 2 | 3)}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                          queueFloor === floor
                            ? 'bg-orange-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        第{floor}层
                      </button>
                    ))}
                  </div>
                )}

                {queueFilter === 'overdue' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">超过</span>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={queueOverdueHours}
                      onChange={e => setQueueOverdueHours(parseInt(e.target.value) || 4)}
                      className="w-16 bg-slate-900/50 border border-slate-600 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-orange-500"
                    />
                    <span className="text-xs text-slate-400">小时未投料</span>
                  </div>
                )}
              </div>

              <button
                onClick={handleCreateQueue}
                disabled={feedQueue.isActive || robot.status !== 'idle'}
                className="w-full py-2 px-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-all flex items-center justify-center gap-1"
              >
                <ListTodo size={14} />
                生成投料队列
              </button>

              {feedQueue.items.length > 0 && (
                <div className="space-y-3">
                  <div className="bg-slate-900/50 rounded-lg p-2">
                    <div className="flex justify-between items-center text-xs mb-2">
                      <span className="text-slate-400">进度</span>
                      <span className="text-white font-mono">
                        {completedCount + skippedCount + failedCount}/{feedQueue.items.length}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-300"
                        style={{ width: `${queueProgress}%` }}
                      />
                    </div>
                    <div className="flex gap-3 mt-2 text-xs">
                      <span className="text-green-400">✓ {completedCount}</span>
                      <span className="text-yellow-400">⏭ {skippedCount}</span>
                      <span className="text-red-400">✗ {failedCount}</span>
                      <span className="text-slate-400">⏳ {feedQueue.items.filter(i => i.status === 'pending').length}</span>
                    </div>
                  </div>

                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {feedQueue.items.map((item, idx) => {
                      const statusColors: Record<string, string> = {
                        pending: 'bg-slate-700 text-slate-400',
                        in_progress: 'bg-blue-600/30 text-blue-400 border border-blue-500/50',
                        completed: 'bg-green-600/20 text-green-400',
                        skipped: 'bg-yellow-600/20 text-yellow-400',
                        failed: 'bg-red-600/20 text-red-400',
                      };
                      const statusText: Record<string, string> = {
                        pending: '等待',
                        in_progress: '进行中',
                        completed: '完成',
                        skipped: '跳过',
                        failed: '失败',
                      };
                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between px-2 py-1 rounded text-xs font-mono ${statusColors[item.status]}`}
                        >
                          <span>{item.cageId}</span>
                          <span className="text-[10px]">{statusText[item.status]}</span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-2">
                    {!feedQueue.isActive && completedCount + skippedCount + failedCount === 0 ? (
                      <button
                        onClick={handleStartQueue}
                        disabled={robot.status !== 'idle'}
                        className="flex-1 py-2 px-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 text-white text-sm rounded-lg transition-all flex items-center justify-center gap-1"
                      >
                        <PlayCircle size={14} />
                        开始执行
                      </button>
                    ) : null}
                    {feedQueue.isActive && (
                      <>
                        <button
                          onClick={skipNextInQueue}
                          className="flex-1 py-2 px-3 bg-yellow-600 hover:bg-yellow-500 text-white text-sm rounded-lg transition-all flex items-center justify-center gap-1"
                        >
                          <SkipForward size={14} />
                          跳过下一个
                        </button>
                        <button
                          onClick={cancelFeedQueue}
                          className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-all flex items-center justify-center gap-1"
                        >
                          <Square size={14} />
                          取消
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 阈值配置 */}
        <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700/50">
          <button
            onClick={() => toggleSection('thresholds')}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-700/30 transition-colors"
          >
            <span className="text-white font-semibold flex items-center gap-2">
              <Settings size={18} className="text-slate-300" /> 阈值配置
            </span>
            <div className="flex items-center gap-2">
              {configHasChanges && (
                <span className="text-xs text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full">
                  未保存
                </span>
              )}
              {expandedSections.thresholds ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
            </div>
          </button>
          
          {expandedSections.thresholds && (
            <div className="p-3 pt-0 space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-2 block">温度范围 (°C)</label>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <input
                      type="number"
                      value={isNaN(systemConfig.tempMin) ? '' : systemConfig.tempMin}
                      onChange={handleTempMinChange}
                      onBlur={commitConfig}
                      className={`w-full bg-slate-900/50 border rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none transition-colors ${
                        configValidation.tempMin.valid
                          ? 'border-slate-600 focus:border-green-500'
                          : 'border-red-500 focus:border-red-400'
                      }`}
                      step="0.5"
                      placeholder="下限"
                    />
                    {!configValidation.tempMin.valid && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-red-400">
                        <AlertCircle size={12} />
                        {configValidation.tempMin.error}
                      </div>
                    )}
                  </div>
                  <span className="text-slate-500">~</span>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={isNaN(systemConfig.tempMax) ? '' : systemConfig.tempMax}
                      onChange={handleTempMaxChange}
                      onBlur={commitConfig}
                      className={`w-full bg-slate-900/50 border rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none transition-colors ${
                        configValidation.tempMax.valid
                          ? 'border-slate-600 focus:border-green-500'
                          : 'border-red-500 focus:border-red-400'
                      }`}
                      step="0.5"
                      placeholder="上限"
                    />
                    {!configValidation.tempMax.valid && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-red-400">
                        <AlertCircle size={12} />
                        {configValidation.tempMax.error}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  当前有效: {lastValidConfig.tempMin}°C ~ {lastValidConfig.tempMax}°C
                </div>
              </div>
              
              <div>
                <label className="text-sm text-slate-400 mb-2 block">湿度范围 (%)</label>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <input
                      type="number"
                      value={isNaN(systemConfig.humidityMin) ? '' : systemConfig.humidityMin}
                      onChange={handleHumMinChange}
                      onBlur={commitConfig}
                      className={`w-full bg-slate-900/50 border rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none transition-colors ${
                        configValidation.humidityMin.valid
                          ? 'border-slate-600 focus:border-blue-500'
                          : 'border-red-500 focus:border-red-400'
                      }`}
                      step="1"
                      placeholder="下限"
                    />
                    {!configValidation.humidityMin.valid && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-red-400">
                        <AlertCircle size={12} />
                        {configValidation.humidityMin.error}
                      </div>
                    )}
                  </div>
                  <span className="text-slate-500">~</span>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={isNaN(systemConfig.humidityMax) ? '' : systemConfig.humidityMax}
                      onChange={handleHumMaxChange}
                      onBlur={commitConfig}
                      className={`w-full bg-slate-900/50 border rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none transition-colors ${
                        configValidation.humidityMax.valid
                          ? 'border-slate-600 focus:border-blue-500'
                          : 'border-red-500 focus:border-red-400'
                      }`}
                      step="1"
                      placeholder="上限"
                    />
                    {!configValidation.humidityMax.valid && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-red-400">
                        <AlertCircle size={12} />
                        {configValidation.humidityMax.error}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  当前有效: {lastValidConfig.humidityMin}% ~ {lastValidConfig.humidityMax}%
                </div>
              </div>

              {configHasChanges && (
                <div className="flex gap-2">
                  <button
                    onClick={commitConfig}
                    disabled={!allConfigValid}
                    className="flex-1 py-2 px-3 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-all flex items-center justify-center gap-1"
                  >
                    <Check size={14} />
                    应用
                  </button>
                  <button
                    onClick={resetConfig}
                    className="flex-1 py-2 px-3 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-all flex items-center justify-center gap-1"
                  >
                    <X size={14} />
                    撤销
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 定时计划 */}
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
                {timerSchedules.map(schedule => {
                  const isEditing = editingScheduleId === schedule.id;
                  const isPausedToday = schedule.pausedDates.includes(todayStr);
                  const statusColors: Record<string, string> = {
                    success: 'bg-green-500/20 text-green-400 border-green-500/30',
                    skipped: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
                    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
                  };

                  return (
                    <div
                      key={schedule.id}
                      className={`rounded-lg transition-all p-3 ${
                        schedule.enabled
                          ? 'bg-purple-900/30 border border-purple-500/30'
                          : 'bg-slate-900/30 border border-slate-700/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
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
                          {isEditing ? (
                            <div className="flex gap-1">
                              <input
                                type="time"
                                value={editTime}
                                onChange={e => setEditTime(e.target.value)}
                                className="w-20 bg-slate-900/80 border border-purple-500/50 rounded px-2 py-0.5 text-white text-xs font-mono"
                              />
                              <select
                                value={editTarget}
                                onChange={e => setEditTarget(e.target.value as typeof editTarget)}
                                className="bg-slate-900/80 border border-purple-500/50 rounded px-1 py-0.5 text-white text-xs"
                              >
                                <option value="all">全部</option>
                                <option value="floor1">1层</option>
                                <option value="floor2">2层</option>
                                <option value="floor3">3层</option>
                              </select>
                              <button
                                onClick={saveEditSchedule}
                                className="text-green-400 hover:text-green-300"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={() => setEditingScheduleId(null)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div>
                              <div className="font-mono text-white text-sm">
                                {schedule.time}
                              </div>
                              <div className="text-xs text-slate-400">
                                {schedule.target === 'all' ? '全部笼位' : `第${schedule.target.slice(-1)}层`}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {!isEditing && (
                            <>
                              <button
                                onClick={() => startEditSchedule(schedule)}
                                className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors"
                                title="编辑"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                onClick={() => toggleSchedulePauseForDate(schedule.id, todayStr)}
                                className={`p-1.5 rounded transition-colors ${
                                  isPausedToday
                                    ? 'text-yellow-400 bg-yellow-500/20'
                                    : 'text-slate-400 hover:text-yellow-400 hover:bg-yellow-500/10'
                                }`}
                                title={isPausedToday ? '今日已暂停，点击恢复' : '暂停今日执行'}
                              >
                                <Calendar size={14} />
                              </button>
                              <button
                                onClick={() => removeTimerSchedule(schedule.id)}
                                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {schedule.executionHistory.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-purple-500/20">
                          <div className="text-[10px] text-slate-500 mb-1">最近执行记录</div>
                          <div className="flex gap-1 flex-wrap">
                            {schedule.executionHistory.slice(-5).reverse().map(rec => (
                              <div
                                key={rec.id}
                                className={`text-[10px] px-1.5 py-0.5 rounded border ${statusColors[rec.status]}`}
                                title={`${rec.actualTime.toLocaleString()}${rec.message ? ` - ${rec.message}` : ''}`}
                              >
                                {rec.scheduledTime}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {isPausedToday && (
                        <div className="mt-2 flex items-center gap-1 text-[10px] text-yellow-400">
                          <Gauge size={10} />
                          今日执行已暂停
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 数据报表 */}
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

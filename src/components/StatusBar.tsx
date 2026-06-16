import React from 'react';
import { useFarmStore } from '../store/useFarmStore';
import { Thermometer, Droplets, UtensilsCrossed, Clock, Activity } from 'lucide-react';

export const StatusBar: React.FC = () => {
  const { cages, feedRecords, isAutoInspecting, robot } = useFarmStore();

  const temperatures = cages.map(c => c.temperature);
  const humidities = cages.map(c => c.humidity);
  const maxTemp = Math.max(...temperatures);
  const minTemp = Math.min(...temperatures);
  const avgHumidity = humidities.reduce((a, b) => a + b, 0) / humidities.length;
  const totalFeeds = cages.reduce((a, b) => a + b.feedCount, 0);
  const alertCount = cages.filter(c => c.hasAlert).length;

  const currentTime = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="absolute bottom-4 left-80 right-4 h-16 bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-700/50 px-6 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-slate-400" />
          <span className="font-mono text-white text-lg">{currentTime}</span>
        </div>
        
        <div className="h-8 w-px bg-slate-700" />
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Thermometer size={16} className="text-red-400" />
            <div className="flex flex-col">
              <span className="text-xs text-slate-400">温度范围</span>
              <span className="font-mono text-white text-sm">
                {minTemp.toFixed(1)} - {maxTemp.toFixed(1)}°C
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Droplets size={16} className="text-blue-400" />
            <div className="flex flex-col">
              <span className="text-xs text-slate-400">平均湿度</span>
              <span className="font-mono text-white text-sm">
                {avgHumidity.toFixed(1)}%
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <UtensilsCrossed size={16} className="text-yellow-400" />
            <div className="flex flex-col">
              <span className="text-xs text-slate-400">今日投料</span>
              <span className="font-mono text-white text-sm">
                {totalFeeds} 次
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Activity size={16} className={alertCount > 0 ? 'text-red-400' : 'text-green-400'} />
            <div className="flex flex-col">
              <span className="text-xs text-slate-400">异常笼位</span>
              <span className={`font-mono text-sm ${alertCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {alertCount} / {cages.length}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {isAutoInspecting && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 rounded-lg border border-blue-500/30">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            <span className="text-blue-400 text-sm font-medium">自动巡检中</span>
          </div>
        )}
        
        {robot.status === 'feeding' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
            <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            <span className="text-yellow-400 text-sm font-medium">投料中</span>
          </div>
        )}
        
        {robot.status === 'moving' && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/20 rounded-lg border border-cyan-500/30">
            <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
            <span className="text-cyan-400 text-sm font-medium">机器人移动中</span>
          </div>
        )}
      </div>
    </div>
  );
};

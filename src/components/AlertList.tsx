import React from 'react';
import { useFarmStore } from '../store/useFarmStore';
import { AlertTriangle, X, Thermometer, Droplets } from 'lucide-react';

export const AlertList: React.FC = () => {
  const { cages, selectCage, systemConfig } = useFarmStore();
  const alertCages = cages.filter(c => c.hasAlert);

  if (alertCages.length === 0) {
    return (
      <div className="absolute bottom-4 right-4 w-80 bg-slate-900/90 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center gap-2 text-green-400">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-sm font-medium">所有笼位运行正常</span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-4 right-4 w-80 bg-slate-900/90 backdrop-blur-xl rounded-xl border border-red-500/30 overflow-hidden">
      <div className="p-3 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-red-400" />
          <span className="text-red-400 font-semibold">
            异常告警 ({alertCages.length})
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <span>温度: {systemConfig.tempMin}-{systemConfig.tempMax}°C</span>
          <span className="mx-1">|</span>
          <span>湿度: {systemConfig.humidityMin}-{systemConfig.humidityMax}%</span>
        </div>
      </div>
      
      <div className="max-h-60 overflow-y-auto">
        {alertCages.map(cage => (
          <div
            key={cage.id}
            onClick={() => selectCage(cage.id)}
            className="p-3 border-b border-slate-700/30 last:border-b-0 cursor-pointer hover:bg-red-500/5 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-white font-semibold">{cage.id}</span>
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <X size={14} className="text-slate-400" />
              </div>
            </div>
            <div className="mt-2 flex gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Thermometer 
                  size={14} 
                  className={cage.alertType === 'temperature' ? 'text-red-400' : 'text-slate-400'}
                />
                <span className={`font-mono ${
                  cage.alertType === 'temperature' ? 'text-red-400' : 'text-slate-400'
                }`}>
                  {cage.temperature.toFixed(1)}°C
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Droplets 
                  size={14} 
                  className={cage.alertType === 'humidity' ? 'text-red-400' : 'text-slate-400'}
                />
                <span className={`font-mono ${
                  cage.alertType === 'humidity' ? 'text-red-400' : 'text-slate-400'
                }`}>
                  {cage.humidity.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {cage.alertType === 'temperature' 
                ? `温度超出阈值 (${systemConfig.tempMin}-${systemConfig.tempMax}°C)`
                : `湿度超出阈值 (${systemConfig.humidityMin}-${systemConfig.humidityMax}%)`
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

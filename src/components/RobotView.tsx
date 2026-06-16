import React, { useState, useEffect } from 'react';
import { Video } from 'lucide-react';
import { useFarmStore } from '../store/useFarmStore';

export const RobotView: React.FC = () => {
  const { robot, cages, selectedCageId } = useFarmStore();
  const currentCage = cages.find(c => c.id === robot.currentCageId);
  const selectedCage = cages.find(c => c.id === selectedCageId);
  const displayCage = currentCage || selectedCage;
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute top-4 right-4 w-72 bg-slate-900/90 backdrop-blur-xl rounded-xl border border-green-500/30 overflow-hidden shadow-2xl shadow-green-500/10">
      <div className="p-2 bg-green-500/10 border-b border-green-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video size={16} className="text-green-400" />
          <span className="text-green-400 text-sm font-semibold">机器人摄像头</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs text-red-400 font-mono">LIVE</span>
        </div>
      </div>
      
      <div className="relative">
        <div className="w-full aspect-video bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 relative overflow-hidden">
          <img
            src={`https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(`metal cage grid, industrial farm equipment, animal cage, surveillance camera view, dim lighting, security camera perspective, photorealistic`)}&image_size=landscape_16_9`}
            alt="笼位监控画面"
            className="w-full h-full object-cover opacity-80"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
          
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-[linear-gradient(0deg,transparent_24%,rgba(34,197,94,0.03)_25%,rgba(34,197,94,0.03)_26%,transparent_27%,transparent_74%,rgba(34,197,94,0.03)_75%,rgba(34,197,94,0.03)_76%,transparent_77%),linear-gradient(90deg,transparent_49%,rgba(34,197,94,0.02)_50%,rgba(34,197,94,0.02)_51%,transparent_52%)] bg-[length:100%_8px,8px_100%]" />
            <div className="absolute inset-0 scan-line" />
          </div>
          
          <div className="absolute top-2 left-2 right-2 flex justify-between text-xs font-mono">
            <span className="text-green-400 bg-black/50 px-2 py-0.5 rounded">
              {time.toLocaleTimeString()}
            </span>
            <span className="text-green-400 bg-black/50 px-2 py-0.5 rounded">
              CAM-01
            </span>
          </div>
          
          <div className="absolute bottom-2 left-2 right-2">
            <div className="flex justify-between items-end">
              {displayCage && (
                <div className="bg-black/70 rounded-lg p-2 text-xs backdrop-blur-sm">
                  <div className="text-green-400 font-semibold font-mono">
                    {displayCage.id}
                  </div>
                  <div className="text-slate-300 font-mono">
                    T: {displayCage.temperature.toFixed(1)}°C
                  </div>
                  <div className="text-slate-300 font-mono">
                    H: {displayCage.humidity.toFixed(1)}%
                  </div>
                </div>
              )}
              
              <div className="w-8 h-8 border-2 border-green-500/50 rounded-full flex items-center justify-center">
                <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
              </div>
            </div>
          </div>
          
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 75" fill="none">
            <path d="M0 10 L10 10 L10 0" stroke="rgba(34, 197, 94, 0.5)" strokeWidth="2" />
            <path d="M100 10 L90 10 L90 0" stroke="rgba(34, 197, 94, 0.5)" strokeWidth="2" />
            <path d="M0 65 L10 65 L10 75" stroke="rgba(34, 197, 94, 0.5)" strokeWidth="2" />
            <path d="M100 65 L90 65 L90 75" stroke="rgba(34, 197, 94, 0.5)" strokeWidth="2" />
            <line x1="50" y1="0" x2="50" y2="5" stroke="rgba(34, 197, 94, 0.3)" strokeWidth="1" />
            <line x1="50" y1="70" x2="50" y2="75" stroke="rgba(34, 197, 94, 0.3)" strokeWidth="1" />
            <line x1="0" y1="37.5" x2="5" y2="37.5" stroke="rgba(34, 197, 94, 0.3)" strokeWidth="1" />
            <line x1="95" y1="37.5" x2="100" y2="37.5" stroke="rgba(34, 197, 94, 0.3)" strokeWidth="1" />
          </svg>
        </div>
      </div>
      
      <div className="p-2 border-t border-slate-700/30">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">状态</span>
          <span className={`font-mono ${
            robot.status === 'idle' ? 'text-green-400' :
            robot.status === 'moving' ? 'text-blue-400' : 'text-yellow-400'
          }`}>
            {robot.status === 'idle' ? '待机' : robot.status === 'moving' ? '移动中' : '投料中'}
          </span>
        </div>
        {currentCage && (
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-slate-400">当前位置</span>
            <span className="font-mono text-white">{currentCage.id}</span>
          </div>
        )}
      </div>
    </div>
  );
};

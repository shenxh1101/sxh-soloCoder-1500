import React, { useEffect, useRef, useState } from 'react';
import { FarmScene } from './three/FarmScene';
import { ControlPanel } from './components/ControlPanel';
import { RobotView } from './components/RobotView';
import { AlertList } from './components/AlertList';
import { StatusBar } from './components/StatusBar';
import { useFarmStore } from './store/useFarmStore';
import { generateSensorData } from './utils/dataGenerator';

const App: React.FC = () => {
  const sceneContainerRef = useRef<HTMLDivElement>(null);
  const farmSceneRef = useRef<FarmScene | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastSensorUpdateRef = useRef<number>(0);
  const lastHistoryUpdateRef = useRef<number>(0);
  const lastScheduleCheckRef = useRef<number>(0);
  const autoInspectIndexRef = useRef<number>(0);
  
  const {
    cages,
    robot,
    isAutoInspecting,
    timerSchedules,
    selectCage,
    updateCageSensor,
    addSensorHistory,
    cleanupOldHistory,
    feedFloor,
    feedAll,
  } = useFarmStore();

  const [isSceneReady, setIsSceneReady] = useState(false);

  useEffect(() => {
    if (!sceneContainerRef.current) return;

    const scene = new FarmScene(sceneContainerRef.current);
    farmSceneRef.current = scene;

    scene.initializeCages(cages);
    scene.setOnCageClick((cageId) => {
      selectCage(cageId);
      scene.focusOnCage(cageId);
    });

    setIsSceneReady(true);

    return () => {
      scene.dispose();
      farmSceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isSceneReady || !farmSceneRef.current) return;

    const animate = (time: number) => {
      if (farmSceneRef.current) {
        farmSceneRef.current.update(cages, robot, time);
        farmSceneRef.current.render();
      }

      if (time - lastSensorUpdateRef.current > 2000) {
        cages.forEach(cage => {
          const newData = generateSensorData(cage.temperature, cage.humidity);
          updateCageSensor(cage.id, newData.temperature, newData.humidity);
        });
        lastSensorUpdateRef.current = time;
      }

      if (time - lastHistoryUpdateRef.current > 60000) {
        cages.forEach(cage => {
          addSensorHistory(cage.id, cage.temperature, cage.humidity);
        });
        cleanupOldHistory();
        lastHistoryUpdateRef.current = time;
      }

      if (time - lastScheduleCheckRef.current > 10000) {
        checkTimerSchedules();
        lastScheduleCheckRef.current = time;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isSceneReady, cages, robot]);

  useEffect(() => {
    if (!isAutoInspecting || !farmSceneRef.current || robot.status !== 'idle') return;

    const interval = setInterval(() => {
      if (robot.status !== 'idle') return;

      const allCages = [...cages].sort((a, b) => {
        if (a.floor !== b.floor) return a.floor - b.floor;
        return a.position - b.position;
      });

      const targetCage = allCages[autoInspectIndexRef.current % allCages.length];
      autoInspectIndexRef.current++;

      useFarmStore.getState().moveRobotTo(targetCage.id);
    }, 3000);

    return () => clearInterval(interval);
  }, [isAutoInspecting, robot.status]);

  const checkTimerSchedules = () => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    timerSchedules.forEach(async (schedule) => {
      if (!schedule.enabled) return;
      if (schedule.time !== currentTime) return;
      
      if (schedule.lastExecuted) {
        const lastExec = new Date(schedule.lastExecuted);
        if (lastExec.toDateString() === now.toDateString()) {
          return;
        }
      }

      if (useFarmStore.getState().robot.status !== 'idle') return;

      useFarmStore.setState((state) => ({
        timerSchedules: state.timerSchedules.map(s =>
          s.id === schedule.id ? { ...s, lastExecuted: now } : s
        ),
      }));

      if (schedule.target === 'all') {
        await feedAll('scheduled');
      } else {
        const floorNum = parseInt(schedule.target.slice(-1));
        await feedFloor(floorNum, 'scheduled');
      }
    });
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-slate-950 relative flex">
      <ControlPanel />
      
      <div className="flex-1 relative">
        <div 
          ref={sceneContainerRef} 
          className="w-full h-full"
        />
        
        <RobotView />
        <AlertList />
        <StatusBar />
        
        <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-xl rounded-xl px-4 py-3 border border-slate-700/50">
          <div className="text-xs text-slate-400 mb-1">操作提示</div>
          <div className="text-sm text-slate-300 space-y-0.5">
            <div>🖱️ 左键拖拽: 旋转视角</div>
            <div>🖱️ 滚轮: 缩放</div>
            <div>🖱️ 点击笼位: 选择笼位</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;

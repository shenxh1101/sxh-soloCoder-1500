import React, { useEffect, useRef, useState } from 'react';
import { FarmScene } from './three/FarmScene';
import { ControlPanel } from './components/ControlPanel';
import { RobotView } from './components/RobotView';
import { AlertList } from './components/AlertList';
import { StatusBar } from './components/StatusBar';
import { TrendPanel } from './components/TrendPanel';
import { useFarmStore } from './store/useFarmStore';
import { generateSensorData } from './utils/dataGenerator';

const App: React.FC = () => {
  const sceneContainerRef = useRef<HTMLDivElement>(null);
  const farmSceneRef = useRef<FarmScene | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastSensorUpdateRef = useRef<number>(0);
  const lastHistoryUpdateRef = useRef<number>(0);
  const lastScheduleCheckRef = useRef<number>(0);
  const lastHealthUpdateRef = useRef<number>(0);
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
    addScheduleExecutionRecord,
    computeHealthScores,
    computeRiskRank,
  } = useFarmStore();

  const [isSceneReady, setIsSceneReady] = useState(false);
  const [robotViewCanvas, setRobotViewCanvas] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!sceneContainerRef.current) return;

    const scene = new FarmScene(sceneContainerRef.current);
    farmSceneRef.current = scene;

    scene.initializeCages(cages);
    scene.setOnCageClick((cageId) => {
      selectCage(cageId);
      scene.focusOnCage(cageId);
    });

    setRobotViewCanvas(scene.getRobotViewCanvas());
    setIsSceneReady(true);

    computeHealthScores();
    computeRiskRank();

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

      if (time - lastHealthUpdateRef.current > 60000) {
        computeHealthScores();
        computeRiskRank();
        lastHealthUpdateRef.current = time;
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
      if (useFarmStore.getState().robot.status !== 'idle') return;
      if (useFarmStore.getState().feedQueue.isActive) return;

      const allCages = [...cages].sort((a, b) => {
        if (a.floor !== b.floor) return a.floor - b.floor;
        return a.position - b.position;
      });

      const targetCage = allCages[autoInspectIndexRef.current % allCages.length];
      autoInspectIndexRef.current++;

      useFarmStore.getState().moveRobotTo(targetCage.id);
    }, 3000);

    return () => clearInterval(interval);
  }, [isAutoInspecting, robot.status, cages]);

  const checkTimerSchedules = () => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const todayStr = now.toISOString().split('T')[0];
    const state = useFarmStore.getState();

    state.timerSchedules.forEach(async (schedule) => {
      if (!schedule.enabled) return;
      if (schedule.pausedDates.includes(todayStr)) return;
      if (schedule.time !== currentTime) return;
      
      if (schedule.lastExecuted) {
        const lastExec = new Date(schedule.lastExecuted);
        if (lastExec.toDateString() === now.toDateString()) {
          return;
        }
      }

      const currState = useFarmStore.getState();
      if (currState.robot.status !== 'idle') {
        addScheduleExecutionRecord(schedule.id, {
          scheduleId: schedule.id,
          scheduledTime: schedule.time,
          actualTime: now,
          status: 'skipped',
          target: schedule.target,
          message: '机器人忙碌中',
        });
        return;
      }

      useFarmStore.setState((s) => ({
        timerSchedules: s.timerSchedules.map(s =>
          s.id === schedule.id ? { ...s, lastExecuted: now } : s
        ),
      }));

      try {
        if (schedule.target === 'all') {
          await feedAll('scheduled');
        } else {
          const floorNum = parseInt(schedule.target.slice(-1));
          await feedFloor(floorNum, 'scheduled');
        }
        addScheduleExecutionRecord(schedule.id, {
          scheduleId: schedule.id,
          scheduledTime: schedule.time,
          actualTime: now,
          status: 'success',
          target: schedule.target,
        });
      } catch (e) {
        addScheduleExecutionRecord(schedule.id, {
          scheduleId: schedule.id,
          scheduledTime: schedule.time,
          actualTime: now,
          status: 'failed',
          target: schedule.target,
          message: e instanceof Error ? e.message : '未知错误',
        });
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
        
        <RobotView sceneCanvas={robotViewCanvas} />
        <AlertList />
        <StatusBar />
        <TrendPanel />
        
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

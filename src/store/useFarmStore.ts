import { create } from 'zustand';
import { FarmState, Cage, TimerSchedule } from '../types';
import { generateInitialCages, generate24HourHistory, getCagePosition } from '../utils/dataGenerator';
import { generateDailyReport } from '../utils/reportGenerator';
import { exportSensorHistoryToCSV } from '../utils/csvExporter';

const initialCages = generateInitialCages();

const generateId = (): string => Math.random().toString(36).substring(2, 11);

const defaultSchedules: TimerSchedule[] = [
  {
    id: generateId(),
    time: '08:00',
    enabled: true,
    target: 'all',
    lastExecuted: null,
  },
  {
    id: generateId(),
    time: '17:00',
    enabled: true,
    target: 'all',
    lastExecuted: null,
  },
];

export const useFarmStore = create<FarmState>((set, get) => ({
  cages: initialCages,
  robot: {
    status: 'idle',
    position: { x: -6, y: 0.6, z: 2 },
    targetCageId: null,
    currentCageId: null,
  },
  feedRecords: [],
  sensorHistory: generate24HourHistory(initialCages),
  timerSchedules: defaultSchedules,
  systemConfig: {
    tempMin: 20,
    tempMax: 30,
    humidityMin: 45,
    humidityMax: 75,
  },
  selectedCageId: null,
  isAutoInspecting: false,

  updateCageSensor: (cageId: string, temperature: number, humidity: number) => {
    const { systemConfig } = get();
    
    set((state) => ({
      cages: state.cages.map((cage) => {
        if (cage.id !== cageId) return cage;
        
        const hasTempAlert = temperature < systemConfig.tempMin || temperature > systemConfig.tempMax;
        const hasHumidityAlert = humidity < systemConfig.humidityMin || humidity > systemConfig.humidityMax;
        const hasAlert = hasTempAlert || hasHumidityAlert;
        const alertType = hasTempAlert ? 'temperature' : hasHumidityAlert ? 'humidity' : null;
        
        return {
          ...cage,
          temperature,
          humidity,
          hasAlert,
          alertType,
        };
      }),
    }));
  },

  selectCage: (cageId: string | null) => {
    set((state) => ({
      selectedCageId: cageId,
      cages: state.cages.map((cage) => ({
        ...cage,
        isSelected: cage.id === cageId,
      })),
    }));
  },

  moveRobotTo: async (cageId: string): Promise<void> => {
    const cage = get().cages.find(c => c.id === cageId);
    if (!cage) return;

    const targetPos = getCagePosition(cage.floor, cage.position);
    const robotPos = { ...targetPos, z: 2 };

    set((state) => ({
      robot: {
        ...state.robot,
        status: 'moving',
        targetCageId: cageId,
      },
    }));

    const startPos = { ...get().robot.position };
    const distance = Math.sqrt(
      Math.pow(robotPos.x - startPos.x, 2) +
      Math.pow(robotPos.y - startPos.y, 2)
    );
    const duration = Math.max(500, distance * 300);
    
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        set((state) => ({
          robot: {
            ...state.robot,
            position: {
              x: startPos.x + (robotPos.x - startPos.x) * easeProgress,
              y: startPos.y + (robotPos.y - startPos.y) * easeProgress,
              z: state.robot.position.z,
            },
          },
        }));
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          set((state) => ({
            robot: {
              ...state.robot,
              status: 'idle',
              currentCageId: cageId,
            },
          }));
          resolve();
        }
      };
      
      animate();
    });
  },

  feedCage: async (cageId: string, type: 'manual' | 'scheduled' | 'batch'): Promise<void> => {
    const { moveRobotTo } = get();
    
    await moveRobotTo(cageId);
    
    set((state) => ({
      robot: {
        ...state.robot,
        status: 'feeding',
      },
    }));
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const now = new Date();
    set((state) => ({
      cages: state.cages.map((cage) =>
        cage.id === cageId
          ? { ...cage, lastFeedTime: now, feedCount: cage.feedCount + 1 }
          : cage
      ),
      feedRecords: [
        ...state.feedRecords,
        {
          id: generateId(),
          cageId,
          time: now,
          type,
        },
      ],
      robot: {
        ...state.robot,
        status: 'idle',
      },
    }));
  },

  feedFloor: async (floor: number, type: 'manual' | 'scheduled' | 'batch'): Promise<void> => {
    const { cages, feedCage } = get();
    const floorCages = cages.filter(c => c.floor === floor).sort((a, b) => a.position - b.position);
    
    for (const cage of floorCages) {
      await feedCage(cage.id, type);
    }
  },

  feedAll: async (type: 'manual' | 'scheduled' | 'batch'): Promise<void> => {
    const { feedFloor } = get();
    
    for (let floor = 1; floor <= 3; floor++) {
      await feedFloor(floor, type);
    }
  },

  checkAlerts: () => {
    const { cages, systemConfig } = get();
    
    set({
      cages: cages.map((cage) => {
        const hasTempAlert = cage.temperature < systemConfig.tempMin || cage.temperature > systemConfig.tempMax;
        const hasHumidityAlert = cage.humidity < systemConfig.humidityMin || cage.humidity > systemConfig.humidityMax;
        const hasAlert = hasTempAlert || hasHumidityAlert;
        const alertType = hasTempAlert ? 'temperature' : hasHumidityAlert ? 'humidity' : null;
        
        return { ...cage, hasAlert, alertType };
      }),
    });
  },

  updateConfig: (config: Partial<FarmState['systemConfig']>) => {
    set((state) => ({
      systemConfig: { ...state.systemConfig, ...config },
    }));
    get().checkAlerts();
  },

  addTimerSchedule: (schedule: Omit<TimerSchedule, 'id' | 'lastExecuted'>) => {
    set((state) => ({
      timerSchedules: [
        ...state.timerSchedules,
        {
          ...schedule,
          id: generateId(),
          lastExecuted: null,
        },
      ],
    }));
  },

  removeTimerSchedule: (id: string) => {
    set((state) => ({
      timerSchedules: state.timerSchedules.filter(s => s.id !== id),
    }));
  },

  toggleTimerSchedule: (id: string) => {
    set((state) => ({
      timerSchedules: state.timerSchedules.map(s =>
        s.id === id ? { ...s, enabled: !s.enabled } : s
      ),
    }));
  },

  generateDailyReport: () => {
    const { cages, feedRecords, sensorHistory } = get();
    return generateDailyReport(cages, feedRecords, sensorHistory);
  },

  exportSensorHistoryToCSV: () => {
    const { sensorHistory } = get();
    return exportSensorHistoryToCSV(sensorHistory);
  },

  toggleAutoInspect: () => {
    set((state) => ({
      isAutoInspecting: !state.isAutoInspecting,
    }));
  },

  addSensorHistory: (cageId: string, temperature: number, humidity: number) => {
    set((state) => ({
      sensorHistory: [
        ...state.sensorHistory,
        {
          cageId,
          time: new Date(),
          temperature,
          humidity,
        },
      ],
    }));
  },

  cleanupOldHistory: () => {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    set((state) => ({
      sensorHistory: state.sensorHistory.filter(h => h.time >= twentyFourHoursAgo),
    }));
  },
}));

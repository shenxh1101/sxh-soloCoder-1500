import { create } from 'zustand';
import {
  FarmState, Cage, TimerSchedule, FeedQueueItem, FeedQueueFilterType,
  ConfigValidation, SystemConfig, InspectionSortMode, InspectionState,
  InspectionTaskItem, CageHealthScore, RiskRankItem, RiskFactorKey,
} from '../types';
import { generateInitialCages, generate24HourHistory, getCagePosition } from '../utils/dataGenerator';
import { generateDailyReport } from '../utils/reportGenerator';
import { exportSensorHistoryToCSV } from '../utils/csvExporter';

const initialCages = generateInitialCages();

const generateId = (): string => Math.random().toString(36).substring(2, 11);

const defaultConfig: SystemConfig = {
  tempMin: 20,
  tempMax: 30,
  humidityMin: 45,
  humidityMax: 75,
};

const defaultValidation: ConfigValidation = {
  tempMin: { valid: true },
  tempMax: { valid: true },
  humidityMin: { valid: true },
  humidityMax: { valid: true },
};

const defaultSchedules: TimerSchedule[] = [
  {
    id: generateId(),
    time: '08:00',
    enabled: true,
    target: 'all',
    lastExecuted: null,
    pausedDates: [],
    executionHistory: [],
  },
  {
    id: generateId(),
    time: '17:00',
    enabled: true,
    target: 'all',
    lastExecuted: null,
    pausedDates: [],
    executionHistory: [],
  },
];

const validateConfigValue = (
  key: keyof SystemConfig,
  value: number | undefined,
  currentConfig: SystemConfig
): { valid: boolean; error?: string } => {
  if (value === undefined || value === null || isNaN(value)) {
    return { valid: false, error: '请输入有效数字' };
  }
  if (key === 'tempMin' || key === 'tempMax') {
    if (value < -10 || value > 50) return { valid: false, error: '温度范围: -10~50°C' };
  }
  if (key === 'humidityMin' || key === 'humidityMax') {
    if (value < 0 || value > 100) return { valid: false, error: '湿度范围: 0~100%' };
  }
  if (key === 'tempMin' && value >= currentConfig.tempMax) {
    return { valid: false, error: '需低于温度上限' };
  }
  if (key === 'tempMax' && value <= currentConfig.tempMin) {
    return { valid: false, error: '需高于温度下限' };
  }
  if (key === 'humidityMin' && value >= currentConfig.humidityMax) {
    return { valid: false, error: '需低于湿度上限' };
  }
  if (key === 'humidityMax' && value <= currentConfig.humidityMin) {
    return { valid: false, error: '需高于湿度下限' };
  }
  return { valid: true };
};

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
  systemConfig: { ...defaultConfig },
  lastValidConfig: { ...defaultConfig },
  configValidation: { ...defaultValidation },
  selectedCageId: null,
  selectedFloorForTrend: 1,
  trendViewMode: 'single',
  isAutoInspecting: false,
  feedQueue: {
    isActive: false,
    items: [],
    currentIndex: 0,
    filterType: 'all',
  },
  inspection: {
    isActive: false,
    items: [],
    currentIndex: 0,
    sortMode: 'floor',
    totalDurationMs: 0,
  },
  inspectionRecords: [],
  healthScores: {},
  riskRank: [],

  updateCageSensor: (cageId: string, temperature: number, humidity: number) => {
    const { lastValidConfig } = get();
    
    set((state) => ({
      cages: state.cages.map((cage) => {
        if (cage.id !== cageId) return cage;
        
        const hasTempAlert = temperature < lastValidConfig.tempMin || temperature > lastValidConfig.tempMax;
        const hasHumidityAlert = humidity < lastValidConfig.humidityMin || humidity > lastValidConfig.humidityMax;
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
      trendViewMode: cageId ? 'single' : state.trendViewMode,
      cages: state.cages.map((cage) => ({
        ...cage,
        isSelected: cage.id === cageId,
      })),
    }));
  },

  setTrendViewMode: (mode) => set({ trendViewMode: mode }),
  setSelectedFloorForTrend: (floor) => set({ selectedFloorForTrend: floor }),

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
    const { cages, lastValidConfig } = get();
    
    set({
      cages: cages.map((cage) => {
        const hasTempAlert = cage.temperature < lastValidConfig.tempMin || cage.temperature > lastValidConfig.tempMax;
        const hasHumidityAlert = cage.humidity < lastValidConfig.humidityMin || cage.humidity > lastValidConfig.humidityMax;
        const hasAlert = hasTempAlert || hasHumidityAlert;
        const alertType = hasTempAlert ? 'temperature' : hasHumidityAlert ? 'humidity' : null;
        
        return { ...cage, hasAlert, alertType };
      }),
    });
  },

  updateConfig: (config: Partial<SystemConfig>) => {
    const current = get().systemConfig;
    const newConfig = { ...current, ...config };
    const validation = { ...defaultValidation };

    (Object.keys(config) as (keyof SystemConfig)[]).forEach(key => {
      const val = config[key];
      validation[key] = validateConfigValue(key, val, newConfig);
    });

    set({ systemConfig: newConfig, configValidation: validation });
  },

  commitConfig: () => {
    const { systemConfig, configValidation } = get();
    const allValid = Object.values(configValidation).every(v => v.valid);

    if (allValid) {
      set({ lastValidConfig: { ...systemConfig } });
      get().checkAlerts();
    }
  },

  resetConfig: () => {
    const { lastValidConfig } = get();
    set({
      systemConfig: { ...lastValidConfig },
      configValidation: { ...defaultValidation },
    });
  },

  addTimerSchedule: (schedule) => {
    set((state) => ({
      timerSchedules: [
        ...state.timerSchedules,
        {
          ...schedule,
          id: generateId(),
          lastExecuted: null,
          pausedDates: [],
          executionHistory: [],
        },
      ],
    }));
  },

  updateTimerSchedule: (id, updates) => {
    set((state) => ({
      timerSchedules: state.timerSchedules.map(s =>
        s.id === id ? { ...s, ...updates } : s
      ),
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

  toggleSchedulePauseForDate: (id, dateStr) => {
    set((state) => ({
      timerSchedules: state.timerSchedules.map(s => {
        if (s.id !== id) return s;
        const isPaused = s.pausedDates.includes(dateStr);
        return {
          ...s,
          pausedDates: isPaused
            ? s.pausedDates.filter(d => d !== dateStr)
            : [...s.pausedDates, dateStr],
        };
      }),
    }));
  },

  addScheduleExecutionRecord: (scheduleId, record) => {
    set((state) => ({
      timerSchedules: state.timerSchedules.map(s => {
        if (s.id !== scheduleId) return s;
        return {
          ...s,
          executionHistory: [
            ...s.executionHistory.slice(-9),
            { id: generateId(), ...record },
          ],
        };
      }),
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

  addSensorHistory: (cageId, temperature, humidity) => {
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

  createFeedQueue: (filterType: FeedQueueFilterType, filterFloor, overdueHours) => {
    const { cages } = get();
    let targetCages: Cage[] = [];

    switch (filterType) {
      case 'floor':
        targetCages = cages
          .filter(c => c.floor === filterFloor)
          .sort((a, b) => a.position - b.position);
        break;
      case 'alert':
        targetCages = cages.filter(c => c.hasAlert);
        break;
      case 'overdue': {
        const threshold = overdueHours ?? 4;
        const cutoff = new Date(Date.now() - threshold * 60 * 60 * 1000);
        targetCages = cages.filter(c => !c.lastFeedTime || c.lastFeedTime < cutoff);
        break;
      }
      default:
        targetCages = cages.sort((a, b) => {
          if (a.floor !== b.floor) return a.floor - b.floor;
          return a.position - b.position;
        });
    }

    const items: FeedQueueItem[] = targetCages.map(cage => ({
      cageId: cage.id,
      status: 'pending',
    }));

    set({
      feedQueue: {
        isActive: false,
        items,
        currentIndex: 0,
        filterType,
        filterFloor,
        overdueHours,
      },
    });
  },

  startFeedQueue: async (): Promise<void> => {
    const { feedCage } = get();
    let items = get().feedQueue.items;
    if (items.length === 0) return;

    set((state) => ({
      feedQueue: { ...state.feedQueue, isActive: true },
    }));

    for (let i = 0; i < items.length; i++) {
      const current = get();
      if (!current.feedQueue.isActive) break;
      const item = current.feedQueue.items[i];
      if (item.status === 'skipped') continue;

      set((state) => {
        const newItems = [...state.feedQueue.items];
        newItems[i] = { ...newItems[i], status: 'in_progress' };
        return {
          feedQueue: { ...state.feedQueue, items: newItems, currentIndex: i },
        };
      });

      try {
        await feedCage(item.cageId, 'batch');
        set((state) => {
          const newItems = [...state.feedQueue.items];
          newItems[i] = { ...newItems[i], status: 'completed' };
          return {
            feedQueue: { ...state.feedQueue, items: newItems },
          };
        });
      } catch {
        set((state) => {
          const newItems = [...state.feedQueue.items];
          newItems[i] = { ...newItems[i], status: 'failed' };
          return {
            feedQueue: { ...state.feedQueue, items: newItems },
          };
        });
      }
    }

    set((state) => ({
      feedQueue: { ...state.feedQueue, isActive: false },
    }));
  },

  skipNextInQueue: () => {
    set((state) => {
      const idx = state.feedQueue.currentIndex;
      const nextIdx = state.feedQueue.items.findIndex(
        (item, i) => i >= idx && item.status === 'pending'
      );
      if (nextIdx === -1) return state;
      const newItems = [...state.feedQueue.items];
      newItems[nextIdx] = { ...newItems[nextIdx], status: 'skipped' };
      return {
        feedQueue: { ...state.feedQueue, items: newItems },
      };
    });
  },

  cancelFeedQueue: () => {
    set((state) => ({
      feedQueue: { ...state.feedQueue, isActive: false },
    }));
  },

  createInspectionTask: (sortMode: InspectionSortMode) => {
    const { cages } = get();
    let sortedCages: Cage[] = [];

    switch (sortMode) {
      case 'alertFirst':
        sortedCages = [...cages].sort((a, b) => {
          if (a.hasAlert !== b.hasAlert) return a.hasAlert ? -1 : 1;
          if (a.floor !== b.floor) return a.floor - b.floor;
          return a.position - b.position;
        });
        break;
      case 'fixedRoute': {
        const order: { floor: number; position: number }[] = [];
        for (let floor = 1; floor <= 3; floor++) {
          if (floor % 2 === 1) {
            for (let pos = 1; pos <= 8; pos++) order.push({ floor, position: pos });
          } else {
            for (let pos = 8; pos >= 1; pos--) order.push({ floor, position: pos });
          }
        }
        sortedCages = order
          .map(o => cages.find(c => c.floor === o.floor && c.position === o.position)!)
          .filter(Boolean);
        break;
      }
      default:
        sortedCages = [...cages].sort((a, b) => {
          if (a.floor !== b.floor) return a.floor - b.floor;
          return a.position - b.position;
        });
    }

    const items: InspectionTaskItem[] = sortedCages.map(cage => ({
      cageId: cage.id,
      status: 'pending',
    }));

    const perCageMs = 3000;
    const totalDurationMs = items.length * perCageMs;

    set({
      inspection: {
        isActive: false,
        items,
        currentIndex: 0,
        sortMode,
        totalDurationMs,
      },
    });
  },

  startInspection: async (): Promise<void> => {
    const { moveRobotTo, inspectionRecords } = get();
    let items = get().inspection.items;
    if (items.length === 0) return;

    const startTime = new Date();
    const perCageMs = 3000;
    const estimatedEndTime = new Date(startTime.getTime() + items.length * perCageMs);

    set((state) => ({
      inspection: {
        ...state.inspection,
        isActive: true,
        startTime,
        estimatedEndTime,
      },
    }));

    const newRecords = [...inspectionRecords];

    for (let i = 0; i < items.length; i++) {
      const current = get();
      if (!current.inspection.isActive) break;
      const item = current.inspection.items[i];
      if (item.status === 'skipped') continue;

      set((state) => {
        const newItems = [...state.inspection.items];
        newItems[i] = { ...newItems[i], status: 'in_progress' };
        return {
          inspection: { ...state.inspection, items: newItems, currentIndex: i },
        };
      });

      try {
        await moveRobotTo(item.cageId);

        const cage = get().cages.find(c => c.id === item.cageId);
        const now = new Date();
        const temperature = cage?.temperature ?? 25;
        const humidity = cage?.humidity ?? 60;
        const hasAlertDuring = cage?.hasAlert ?? false;
        const alertType = cage?.alertType ?? null;

        newRecords.push({
          id: generateId(),
          cageId: item.cageId,
          inspectedAt: now,
          temperature,
          humidity,
          hasAlert: hasAlertDuring,
          alertType,
        });

        set((state) => {
          const newItems = [...state.inspection.items];
          newItems[i] = {
            ...newItems[i],
            status: 'completed',
            inspectedAt: now,
            temperature,
            humidity,
            hasAlertDuring,
          };
          return {
            inspection: { ...state.inspection, items: newItems },
            inspectionRecords: newRecords.slice(-200),
          };
        });

        await new Promise(resolve => setTimeout(resolve, 800));
      } catch {
        set((state) => {
          const newItems = [...state.inspection.items];
          newItems[i] = { ...newItems[i], status: 'skipped' };
          return {
            inspection: { ...state.inspection, items: newItems },
          };
        });
      }
    }

    set((state) => ({
      inspection: { ...state.inspection, isActive: false },
    }));
  },

  skipNextInspection: () => {
    set((state) => {
      const idx = state.inspection.currentIndex;
      const nextIdx = state.inspection.items.findIndex(
        (item, i) => i >= idx && item.status === 'pending'
      );
      if (nextIdx === -1) return state;
      const newItems = [...state.inspection.items];
      newItems[nextIdx] = { ...newItems[nextIdx], status: 'skipped' };
      return {
        inspection: { ...state.inspection, items: newItems },
      };
    });
  },

  cancelInspection: () => {
    set((state) => ({
      inspection: { ...state.inspection, isActive: false },
    }));
  },

  computeHealthScores: () => {
    const { cages, sensorHistory, lastValidConfig } = get();
    const scores: Record<string, CageHealthScore> = {};
    const now = new Date();

    cages.forEach(cage => {
      const cageHistory = sensorHistory
        .filter(h => h.cageId === cage.id)
        .sort((a, b) => b.time.getTime() - a.time.getTime())
        .slice(0, 24);

      let consecutiveAlerts = 0;
      for (let i = 0; i < cageHistory.length; i++) {
        const h = cageHistory[i];
        const isAlert = h.temperature < lastValidConfig.tempMin || h.temperature > lastValidConfig.tempMax
          || h.humidity < lastValidConfig.humidityMin || h.humidity > lastValidConfig.humidityMax;
        if (isAlert) consecutiveAlerts++;
        else break;
      }
      if (cage.hasAlert) consecutiveAlerts = Math.max(consecutiveAlerts, 1);

      const hoursWithoutFeed = cage.lastFeedTime
        ? (now.getTime() - cage.lastFeedTime.getTime()) / (1000 * 60 * 60)
        : 999;

      const tempValues = cageHistory.map(h => h.temperature);
      const humidityValues = cageHistory.map(h => h.humidity);
      const temperatureFluctuation = tempValues.length >= 2
        ? Math.max(...tempValues) - Math.min(...tempValues)
        : 0;
      const humidityFluctuation = humidityValues.length >= 2
        ? Math.max(...humidityValues) - Math.min(...humidityValues)
        : 0;

      let score = 100;
      score -= Math.min(consecutiveAlerts * 10, 40);
      score -= Math.min(hoursWithoutFeed * 2, 30);
      score -= Math.min(temperatureFluctuation * 2, 15);
      score -= Math.min(humidityFluctuation * 0.8, 15);
      score = Math.max(0, Math.min(100, score));

      let level: CageHealthScore['level'] = 'excellent';
      if (score < 60) level = 'danger';
      else if (score < 75) level = 'warning';
      else if (score < 90) level = 'good';

      scores[cage.id] = {
        cageId: cage.id,
        score: Math.round(score),
        level,
        factors: {
          consecutiveAlerts,
          hoursWithoutFeed: Math.round(hoursWithoutFeed * 10) / 10,
          temperatureFluctuation: Math.round(temperatureFluctuation * 10) / 10,
          humidityFluctuation: Math.round(humidityFluctuation * 10) / 10,
        },
      };
    });

    set({ healthScores: scores });
  },

  computeRiskRank: () => {
    const { cages, healthScores } = get();

    const rank: RiskRankItem[] = cages.map(cage => {
      const hs = healthScores[cage.id];
      const factors = hs?.factors ?? { consecutiveAlerts: 0, hoursWithoutFeed: 0, temperatureFluctuation: 0, humidityFluctuation: 0 };

      const alertScore = factors.consecutiveAlerts * 10;
      const feedScore = Math.min(factors.hoursWithoutFeed * 2, 30);
      const fluctScore = Math.min((factors.temperatureFluctuation + factors.humidityFluctuation) * 1.2, 20);

      let primaryRisk: RiskFactorKey = 'consecutiveAlerts';
      let riskValue = alertScore;
      if (feedScore > riskValue) {
        primaryRisk = 'hoursWithoutFeed';
        riskValue = feedScore;
      }
      if (fluctScore > riskValue) {
        primaryRisk = 'fluctuation';
        riskValue = fluctScore;
      }

      return {
        cageId: cage.id,
        floor: cage.floor,
        position: cage.position,
        healthScore: hs?.score ?? 80,
        level: hs?.level ?? 'good',
        primaryRisk,
        riskValue: Math.round(riskValue * 10) / 10,
      };
    });

    rank.sort((a, b) => a.healthScore - b.healthScore);

    set({ riskRank: rank });
  },

  createFeedQueueFromRiskTop: (count: number) => {
    const { riskRank, createFeedQueue } = get();
    const topCages = riskRank.slice(0, Math.min(count, riskRank.length));
    const items: FeedQueueItem[] = topCages.map(r => ({
      cageId: r.cageId,
      status: 'pending',
    }));

    set({
      feedQueue: {
        isActive: false,
        items,
        currentIndex: 0,
        filterType: 'alert',
      },
    });
  },

  getFeedImpactAnalysis: (cageId: string) => {
    const { feedRecords, sensorHistory } = get();
    const cageFeeds = feedRecords
      .filter(r => r.cageId === cageId)
      .sort((a, b) => b.time.getTime() - a.time.getTime());

    if (cageFeeds.length === 0) return null;

    const lastFeed = cageFeeds[0];
    const feedTime = lastFeed.time.getTime();
    const twoHoursBefore = feedTime - 2 * 60 * 60 * 1000;
    const twoHoursAfter = feedTime + 2 * 60 * 60 * 1000;

    const beforeData = sensorHistory.filter(
      h => h.cageId === cageId && h.time.getTime() >= twoHoursBefore && h.time.getTime() < feedTime
    );
    const afterData = sensorHistory.filter(
      h => h.cageId === cageId && h.time.getTime() > feedTime && h.time.getTime() <= twoHoursAfter
    );

    if (beforeData.length === 0 || afterData.length === 0) return null;

    const before = beforeData.reduce((s, h) => s + h.temperature, 0) / beforeData.length;
    const after = afterData.reduce((s, h) => s + h.temperature, 0) / afterData.length;

    return {
      before: Math.round(before * 10) / 10,
      after: Math.round(after * 10) / 10,
      change: Math.round((after - before) * 10) / 10,
    };
  },
}));

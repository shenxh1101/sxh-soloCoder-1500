export interface Cage {
  id: string;
  floor: number;
  position: number;
  temperature: number;
  humidity: number;
  lastFeedTime: Date | null;
  feedCount: number;
  hasAlert: boolean;
  alertType: 'temperature' | 'humidity' | null;
  isSelected: boolean;
}

export interface RobotState {
  status: 'idle' | 'moving' | 'feeding';
  position: { x: number; y: number; z: number };
  targetCageId: string | null;
  currentCageId: string | null;
}

export interface FeedRecord {
  id: string;
  cageId: string;
  time: Date;
  type: 'manual' | 'scheduled' | 'batch';
}

export interface SensorHistory {
  cageId: string;
  time: Date;
  temperature: number;
  humidity: number;
}

export interface TimerSchedule {
  id: string;
  time: string;
  enabled: boolean;
  target: 'all' | 'floor1' | 'floor2' | 'floor3';
  lastExecuted: Date | null;
}

export interface SystemConfig {
  tempMin: number;
  tempMax: number;
  humidityMin: number;
  humidityMax: number;
}

export interface DailyReport {
  date: string;
  maxTemperature: number;
  minTemperature: number;
  avgHumidity: number;
  feedCountByCage: Record<string, number>;
  totalFeedCount: number;
  alertCount: number;
}

export type FeedTarget = 'single' | 'floor' | 'all';

export interface FarmState {
  cages: Cage[];
  robot: RobotState;
  feedRecords: FeedRecord[];
  sensorHistory: SensorHistory[];
  timerSchedules: TimerSchedule[];
  systemConfig: SystemConfig;
  selectedCageId: string | null;
  isAutoInspecting: boolean;
  
  updateCageSensor: (cageId: string, temp: number, humidity: number) => void;
  selectCage: (cageId: string | null) => void;
  feedCage: (cageId: string, type: 'manual' | 'scheduled' | 'batch') => Promise<void>;
  feedFloor: (floor: number, type: 'manual' | 'scheduled' | 'batch') => Promise<void>;
  feedAll: (type: 'manual' | 'scheduled' | 'batch') => Promise<void>;
  moveRobotTo: (cageId: string) => Promise<void>;
  checkAlerts: () => void;
  updateConfig: (config: Partial<SystemConfig>) => void;
  addTimerSchedule: (schedule: Omit<TimerSchedule, 'id' | 'lastExecuted'>) => void;
  removeTimerSchedule: (id: string) => void;
  toggleTimerSchedule: (id: string) => void;
  generateDailyReport: () => DailyReport;
  exportSensorHistoryToCSV: () => string;
  toggleAutoInspect: () => void;
  addSensorHistory: (cageId: string, temp: number, humidity: number) => void;
  cleanupOldHistory: () => void;
}

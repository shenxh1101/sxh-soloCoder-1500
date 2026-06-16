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

export type ScheduleExecutionStatus = 'success' | 'skipped' | 'failed';

export interface ScheduleExecutionRecord {
  id: string;
  scheduleId: string;
  scheduledTime: string;
  actualTime: Date;
  status: ScheduleExecutionStatus;
  target: 'all' | 'floor1' | 'floor2' | 'floor3';
  message?: string;
}

export interface TimerSchedule {
  id: string;
  time: string;
  enabled: boolean;
  target: 'all' | 'floor1' | 'floor2' | 'floor3';
  lastExecuted: Date | null;
  pausedDates: string[];
  executionHistory: ScheduleExecutionRecord[];
}

export interface SystemConfig {
  tempMin: number;
  tempMax: number;
  humidityMin: number;
  humidityMax: number;
}

export interface ConfigValidation {
  tempMin: { valid: boolean; error?: string };
  tempMax: { valid: boolean; error?: string };
  humidityMin: { valid: boolean; error?: string };
  humidityMax: { valid: boolean; error?: string };
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

export type FeedQueueFilterType = 'floor' | 'alert' | 'overdue' | 'all';

export interface FeedQueueItem {
  cageId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
}

export interface FeedQueueState {
  isActive: boolean;
  items: FeedQueueItem[];
  currentIndex: number;
  filterType: FeedQueueFilterType;
  filterFloor?: 1 | 2 | 3;
  overdueHours?: number;
}

export type TrendViewMode = 'single' | 'floor';

export type InspectionSortMode = 'floor' | 'alertFirst' | 'fixedRoute';

export interface InspectionTaskItem {
  cageId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  inspectedAt?: Date;
  temperature?: number;
  humidity?: number;
  hasAlertDuring?: boolean;
}

export interface InspectionState {
  isActive: boolean;
  items: InspectionTaskItem[];
  currentIndex: number;
  sortMode: InspectionSortMode;
  startTime?: Date;
  estimatedEndTime?: Date;
  totalDurationMs: number;
}

export interface InspectionRecord {
  id: string;
  cageId: string;
  inspectedAt: Date;
  temperature: number;
  humidity: number;
  hasAlert: boolean;
  alertType?: 'temperature' | 'humidity' | null;
}

export interface CageHealthScore {
  cageId: string;
  score: number;
  level: 'excellent' | 'good' | 'warning' | 'danger';
  factors: {
    consecutiveAlerts: number;
    hoursWithoutFeed: number;
    temperatureFluctuation: number;
    humidityFluctuation: number;
  };
}

export type RiskFactorKey = 'consecutiveAlerts' | 'hoursWithoutFeed' | 'fluctuation';

export interface RiskRankItem {
  cageId: string;
  floor: number;
  position: number;
  healthScore: number;
  level: 'excellent' | 'good' | 'warning' | 'danger';
  primaryRisk: RiskFactorKey;
  riskValue: number;
}

export interface FarmState {
  cages: Cage[];
  robot: RobotState;
  feedRecords: FeedRecord[];
  sensorHistory: SensorHistory[];
  timerSchedules: TimerSchedule[];
  systemConfig: SystemConfig;
  lastValidConfig: SystemConfig;
  configValidation: ConfigValidation;
  selectedCageId: string | null;
  selectedFloorForTrend: 1 | 2 | 3;
  trendViewMode: TrendViewMode;
  isAutoInspecting: boolean;
  feedQueue: FeedQueueState;
  inspection: InspectionState;
  inspectionRecords: InspectionRecord[];
  healthScores: Record<string, CageHealthScore>;
  riskRank: RiskRankItem[];

  updateCageSensor: (cageId: string, temp: number, humidity: number) => void;
  selectCage: (cageId: string | null) => void;
  setTrendViewMode: (mode: TrendViewMode) => void;
  setSelectedFloorForTrend: (floor: 1 | 2 | 3) => void;
  feedCage: (cageId: string, type: 'manual' | 'scheduled' | 'batch') => Promise<void>;
  feedFloor: (floor: number, type: 'manual' | 'scheduled' | 'batch') => Promise<void>;
  feedAll: (type: 'manual' | 'scheduled' | 'batch') => Promise<void>;
  moveRobotTo: (cageId: string) => Promise<void>;
  checkAlerts: () => void;
  updateConfig: (config: Partial<SystemConfig>) => void;
  commitConfig: () => void;
  resetConfig: () => void;
  addTimerSchedule: (schedule: Omit<TimerSchedule, 'id' | 'lastExecuted' | 'pausedDates' | 'executionHistory'>) => void;
  updateTimerSchedule: (id: string, updates: Partial<Omit<TimerSchedule, 'id'>>) => void;
  removeTimerSchedule: (id: string) => void;
  toggleTimerSchedule: (id: string) => void;
  toggleSchedulePauseForDate: (id: string, dateStr: string) => void;
  addScheduleExecutionRecord: (scheduleId: string, record: Omit<ScheduleExecutionRecord, 'id'>) => void;
  generateDailyReport: () => DailyReport;
  exportSensorHistoryToCSV: () => string;
  toggleAutoInspect: () => void;
  addSensorHistory: (cageId: string, temp: number, humidity: number) => void;
  cleanupOldHistory: () => void;

  createFeedQueue: (filterType: FeedQueueFilterType, filterFloor?: 1 | 2 | 3, overdueHours?: number) => void;
  startFeedQueue: () => Promise<void>;
  skipNextInQueue: () => void;
  cancelFeedQueue: () => void;

  createInspectionTask: (sortMode: InspectionSortMode) => void;
  startInspection: () => Promise<void>;
  skipNextInspection: () => void;
  cancelInspection: () => void;
  computeHealthScores: () => void;
  computeRiskRank: () => void;
  createFeedQueueFromRiskTop: (count: number) => void;
  getFeedImpactAnalysis: (cageId: string) => { before: number; after: number; change: number } | null;
}

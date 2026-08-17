export type Tier = 1 | 2 | 3 | 4;

export type DemoMode = "normal" | "warning" | "critical" | "off";

export interface TelemetryInput {
  windSpeed: number;
  amplitude: number;
  dutyCycle: number;
  structuralStress: number;
  energyOutput: number;
  batteryPercent: number;
}

export interface Telemetry extends TelemetryInput {
  timestamp: number;
}

export interface DerivedState {
  tier: Tier;
  tierName: "Mati" | "Normal" | "Peringatan Dini" | "Kritis";
  statusText: string;
  statusColor: "off" | "normal" | "warning" | "critical";
  vibrationSafe: boolean;
  maintenanceFlag: boolean;
  structuralSafe: boolean;
  protectionModeActive: boolean;
  predictedLifespanDays: number;
  efficiencyDropPercent: number;
  batteryLabel: "Baik" | "Perlu Cek";
}

export interface NotificationItem {
  id: string;
  timestamp: number;
  tier: Tier;
  title: string;
  message: string;
}

export interface Thresholds {
  structuralStressWarningKPa: number;
  pushNotificationsEnabled: boolean;
}

export interface HistoryPoint {
  label: string;
  kwh: number;
}

export interface StoreSnapshot {
  telemetry: Telemetry;
  derived: DerivedState;
  thresholds: Thresholds;
  demoMode: DemoMode;
  notifications: NotificationItem[];
  history: {
    weekly: HistoryPoint[];
    monthly: HistoryPoint[];
    totalKwh: number;
    co2AvoidedKg: number;
    activeDays: number;
  };
}

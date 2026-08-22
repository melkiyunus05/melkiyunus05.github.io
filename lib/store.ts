import { EventEmitter } from "events";
import { pushToSmartThings } from "./smartthings";
import type {
  DemoMode,
  DerivedState,
  HistoryPoint,
  NotificationItem,
  StoreSnapshot,
  Telemetry,
  TelemetryInput,
  Thresholds,
  Tier,
} from "./types";

// --- tunable constants -----------------------------------------------------

const CUT_IN_WIND_SPEED = 2; // m/s, below this the turbine is "Mati"
const NORMAL_MAX_WIND_SPEED = 9; // m/s, edge of normal harvesting band
const EFFICIENCY_DROP_WARNING_PCT = 15;
const LOW_LIFESPAN_WARNING_DAYS = 30;
const PROLONGED_PROTECTION_TICKS = 3; // consecutive high-wind ticks before it counts as "prolonged"

function round(n: number, d = 2) {
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

function randRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// --- notification message bank ---------------------------------------------

const WARNING_MESSAGES = [
  {
    title: "Prediksi Pemeliharaan",
    message: "Risiko keausan lilitan tembaga dalam 7 hari, segera periksa.",
  },
  {
    title: "Anomali Efisiensi Terdeteksi",
    message:
      "Peringatan: Terdeteksi penurunan efisiensi osilasi 15% akibat badai kemarin. Jadwalkan pemeriksaan struktur tiang minggu ini.",
  },
];

const CRITICAL_MESSAGE = {
  title: "PERINGATAN: Integritas Struktur Kritis",
  message: "Beban struktur melebihi ambang aman — hentikan operasi & periksa segera.",
};

// --- singleton store (survives HMR via globalThis) --------------------------

interface InternalState {
  telemetry: Telemetry;
  derived: DerivedState;
  thresholds: Thresholds;
  demoMode: DemoMode;
  notifications: NotificationItem[];
  protectionStreak: number;
  emitter: EventEmitter;
  timer: ReturnType<typeof setInterval> | null;
  weekly: HistoryPoint[];
  monthly: HistoryPoint[];
}

const g = globalThis as unknown as { __vortigenStore?: InternalState };

function buildInitialTelemetry(): Telemetry {
  return {
    windSpeed: 6.2,
    amplitude: 0.34,
    dutyCycle: 11,
    structuralStress: 2.6,
    energyOutput: 1.1,
    batteryPercent: 82,
    timestamp: Date.now(),
  };
}

function buildInitialThresholds(): Thresholds {
  return {
    structuralStressWarningKPa: 5.0,
    pushNotificationsEnabled: true,
  };
}

function buildHistory() {
  const weekly: HistoryPoint[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weekly.push({
      label: `M${12 - i}`,
      kwh: round(randRange(9, 22), 1),
    });
  }
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const monthly: HistoryPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const idx = (now.getMonth() - i + 12) % 12;
    monthly.push({ label: monthNames[idx], kwh: round(randRange(45, 95), 1) });
  }
  return { weekly, monthly };
}

function initState(): InternalState {
  const { weekly, monthly } = buildHistory();
  const telemetry = buildInitialTelemetry();
  const thresholds = buildInitialThresholds();
  const derived = computeDerivedState(telemetry, thresholds, 0);
  return {
    telemetry,
    derived,
    thresholds,
    demoMode: "normal",
    notifications: [
      {
        id: "seed-1",
        timestamp: Date.now() - 1000 * 60 * 60 * 26,
        tier: 2,
        title: "Sistem Aktif",
        message: "Vortigen mulai beroperasi normal di Pos 1. Resonansi getaran terdeteksi stabil.",
      },
    ],
    protectionStreak: 0,
    emitter: new EventEmitter(),
    timer: null,
    weekly,
    monthly,
  };
}

function getState(): InternalState {
  if (!g.__vortigenStore) {
    g.__vortigenStore = initState();
  }
  return g.__vortigenStore;
}

// --- tier / derived-state computation ---------------------------------------

function computeDerivedState(
  t: Telemetry,
  thresholds: Thresholds,
  protectionStreak: number
): DerivedState {
  const isOff = t.windSpeed < CUT_IN_WIND_SPEED;
  const structuralSafe = t.structuralStress <= thresholds.structuralStressWarningKPa;
  const protectionModeActive = t.windSpeed > NORMAL_MAX_WIND_SPEED;
  const protectionProlonged = protectionModeActive && protectionStreak >= PROLONGED_PROTECTION_TICKS;

  // Cloud AI derived diagnostics (deterministic-ish functions of telemetry so the
  // dashboard tells a consistent story instead of pure noise)
  const efficiencyDropPercent = isOff
    ? 0
    : round(Math.max(0, (t.amplitude - 0.3) * 60 + (t.structuralStress - 2.5) * 4), 1);
  const predictedLifespanDays = isOff
    ? 999
    : Math.max(1, Math.round(180 - t.structuralStress * 14 - Math.max(0, t.amplitude - 0.3) * 90));

  const maintenanceFlag =
    !isOff && (efficiencyDropPercent > EFFICIENCY_DROP_WARNING_PCT || predictedLifespanDays < LOW_LIFESPAN_WARNING_DAYS);

  let tier: Tier;
  if (isOff) {
    tier = 1;
  } else if (!structuralSafe || protectionProlonged) {
    tier = 4;
  } else if (maintenanceFlag) {
    tier = 3;
  } else {
    tier = 2;
  }

  const tierMeta: Record<Tier, { tierName: DerivedState["tierName"]; statusColor: DerivedState["statusColor"]; statusText: string }> = {
    1: {
      tierName: "Mati",
      statusColor: "off",
      statusText: "Perangkat Tidak Aktif (Angin Tidak Cukup)",
    },
    2: {
      tierName: "Normal",
      statusColor: "normal",
      statusText: "Beroperasi Normal (Resonansi Aktif)",
    },
    3: {
      tierName: "Peringatan Dini",
      statusColor: "normal",
      statusText: "Beroperasi Normal (Resonansi Aktif)",
    },
    4: {
      tierName: "Kritis",
      statusColor: "critical",
      statusText: "PERINGATAN: Integritas Struktur Kritis",
    },
  };

  const batteryLabel: DerivedState["batteryLabel"] = t.batteryPercent >= 30 ? "Baik" : "Perlu Cek";

  return {
    tier,
    tierName: tierMeta[tier].tierName,
    statusText: tierMeta[tier].statusText,
    statusColor: tierMeta[tier].statusColor,
    vibrationSafe: tier !== 4,
    maintenanceFlag,
    structuralSafe,
    protectionModeActive,
    predictedLifespanDays,
    efficiencyDropPercent,
    batteryLabel,
  };
}

// --- notification helpers ---------------------------------------------------

function pushNotification(state: InternalState, tier: Tier) {
  if (!state.thresholds.pushNotificationsEnabled) return;
  const last = state.notifications[0];
  if (last && last.tier === tier && Date.now() - last.timestamp < 20_000) return;

  if (tier === 3) {
    const pick = WARNING_MESSAGES[Math.floor(Math.random() * WARNING_MESSAGES.length)];
    state.notifications.unshift({
      id: `n-${Date.now()}`,
      timestamp: Date.now(),
      tier,
      title: pick.title,
      message: pick.message,
    });
  } else if (tier === 4) {
    state.notifications.unshift({
      id: `n-${Date.now()}`,
      timestamp: Date.now(),
      tier,
      title: CRITICAL_MESSAGE.title,
      message: CRITICAL_MESSAGE.message,
    });
  }
  state.notifications = state.notifications.slice(0, 50);
}

// --- telemetry generation (simulated ESP32) ---------------------------------

function generateTelemetry(mode: DemoMode, prev: Telemetry): TelemetryInput {
  switch (mode) {
    case "off":
      return {
        windSpeed: round(randRange(0, 1.6)),
        amplitude: round(randRange(0, 0.05), 2),
        dutyCycle: 0,
        structuralStress: round(randRange(0.1, 0.4)),
        energyOutput: 0,
        batteryPercent: round(Math.max(5, prev.batteryPercent - randRange(0, 0.4)), 0),
      };
    case "warning": {
      const windSpeed = round(randRange(5, 8.5));
      return {
        windSpeed,
        // amplitude/structuralStress lower bounds are chosen so efficiencyDropPercent
        // always clears the >15% warning threshold while staying below the default
        // structural safety threshold (structuralSafe stays true).
        amplitude: round(randRange(0.48, 0.6), 2),
        dutyCycle: Math.round(randRange(10, 19)),
        structuralStress: round(randRange(3.8, 4.8)),
        energyOutput: round(windSpeed * randRange(0.11, 0.14)),
        batteryPercent: round(Math.min(100, Math.max(15, prev.batteryPercent + randRange(-0.5, 0.6))), 0),
      };
    }
    case "critical": {
      const windSpeed = round(randRange(10.5, 18));
      return {
        windSpeed,
        amplitude: round(randRange(0.55, 0.85), 2),
        dutyCycle: Math.round(randRange(20, 35)),
        structuralStress: round(randRange(5.4, 9.2)),
        energyOutput: round(windSpeed * randRange(0.04, 0.07)),
        batteryPercent: round(Math.max(10, prev.batteryPercent - randRange(0, 0.8)), 0),
      };
    }
    case "normal":
    default: {
      const windSpeed = round(randRange(3, 8.5));
      return {
        windSpeed,
        amplitude: round(randRange(0.2, 0.36), 2),
        dutyCycle: Math.round(randRange(5, 16)),
        structuralStress: round(randRange(1.4, 3.3)),
        energyOutput: round(windSpeed * randRange(0.13, 0.17)),
        batteryPercent: round(Math.min(100, Math.max(40, prev.batteryPercent + randRange(-0.2, 0.7))), 0),
      };
    }
  }
}

function applyTelemetry(state: InternalState, input: TelemetryInput) {
  const telemetry: Telemetry = { ...input, timestamp: Date.now() };
  const protectionModeActive = telemetry.windSpeed > NORMAL_MAX_WIND_SPEED;
  state.protectionStreak = protectionModeActive ? state.protectionStreak + 1 : 0;

  state.telemetry = telemetry;
  state.derived = computeDerivedState(telemetry, state.thresholds, state.protectionStreak);

  if (state.derived.tier === 3 || state.derived.tier === 4) {
    pushNotification(state, state.derived.tier);
  }

  // Fire-and-forget: a SmartThings outage must never slow down or break local telemetry.
  void pushToSmartThings(state.telemetry, state.derived);

  state.emitter.emit("update");
}

export function ingestTelemetry(input: TelemetryInput) {
  const state = getState();
  applyTelemetry(state, input);
  return snapshot();
}

export function setDemoMode(mode: DemoMode) {
  const state = getState();
  state.demoMode = mode;
  if (mode === "normal") {
    state.protectionStreak = 0;
  }
  // Immediately generate one matching reading so the UI reacts without delay.
  const input = generateTelemetry(mode, state.telemetry);
  applyTelemetry(state, input);
  return snapshot();
}

export function updateThresholds(partial: Partial<Thresholds>) {
  const state = getState();
  state.thresholds = { ...state.thresholds, ...partial };
  state.derived = computeDerivedState(state.telemetry, state.thresholds, state.protectionStreak);
  state.emitter.emit("update");
  return state.thresholds;
}

function ensureSimulator() {
  const state = getState();
  if (state.timer) return;
  state.timer = setInterval(() => {
    const s = getState();
    const input = generateTelemetry(s.demoMode, s.telemetry);
    applyTelemetry(s, input);
  }, 3000);
  if (typeof state.timer.unref === "function") state.timer.unref();
}

export function snapshot(): StoreSnapshot {
  const state = getState();
  ensureSimulator();
  const monthlyTotal = round(
    state.monthly.reduce((a, p) => a + p.kwh, 0),
    1
  );
  return {
    telemetry: state.telemetry,
    derived: state.derived,
    thresholds: state.thresholds,
    demoMode: state.demoMode,
    notifications: state.notifications,
    history: {
      weekly: state.weekly,
      monthly: state.monthly,
      totalKwh: monthlyTotal,
      co2AvoidedKg: round(monthlyTotal * 0.85, 1),
      activeDays: 47,
    },
  };
}

export function subscribe(listener: () => void) {
  const state = getState();
  ensureSimulator();
  state.emitter.on("update", listener);
  return () => state.emitter.off("update", listener);
}

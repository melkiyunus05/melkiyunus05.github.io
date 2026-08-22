import type { DerivedState, Telemetry, Tier } from "./types";

const API = "https://api.smartthings.com/v1";

const TIER_TO_STATUS: Record<Tier, string> = {
  1: "mati",
  2: "normal",
  3: "peringatanDini",
  4: "kritis",
};

/**
 * Pushes the latest reading into the "Vortigen" SmartThings Virtual Device.
 * No-ops silently if SMARTTHINGS_* env vars aren't set (see scripts/smartthings-setup.mjs),
 * and never throws — a SmartThings outage must not break the local dashboard.
 */
export async function pushToSmartThings(telemetry: Telemetry, derived: DerivedState) {
  const pat = process.env.SMARTTHINGS_PAT;
  const deviceId = process.env.SMARTTHINGS_DEVICE_ID;
  const capabilityId = process.env.SMARTTHINGS_CAPABILITY_ID;
  if (!pat || !deviceId || !capabilityId) return;

  const predictedLifespan = derived.predictedLifespanDays >= 999 ? 999 : derived.predictedLifespanDays;

  const deviceEvents = [
    { component: "main", capability: capabilityId, attribute: "windSpeed", value: telemetry.windSpeed, unit: "m/s" },
    {
      component: "main",
      capability: capabilityId,
      attribute: "structuralStress",
      value: telemetry.structuralStress,
      unit: "kPa",
    },
    {
      component: "main",
      capability: capabilityId,
      attribute: "energyOutput",
      value: telemetry.energyOutput,
      unit: "kW",
    },
    {
      component: "main",
      capability: capabilityId,
      attribute: "predictedLifespan",
      value: predictedLifespan,
      unit: "days",
    },
    { component: "main", capability: capabilityId, attribute: "systemStatus", value: TIER_TO_STATUS[derived.tier] },
    { component: "main", capability: "battery", attribute: "battery", value: telemetry.batteryPercent, unit: "%" },
  ];

  try {
    const res = await fetch(`${API}/virtualdevices/${deviceId}/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pat}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ deviceEvents }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error("[smartthings] push failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("[smartthings] push error", err);
  }
}

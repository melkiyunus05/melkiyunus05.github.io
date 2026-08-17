"use client";

import { useEffect, useState } from "react";
import { Bell, SlidersHorizontal } from "lucide-react";
import { useVortigenStore } from "@/store/useVortigenStore";
import TopBar from "@/components/TopBar";
import DeviceNav from "@/components/DeviceNav";

export default function SettingsPage() {
  const { thresholds, connected } = useVortigenStore();
  const [localThreshold, setLocalThreshold] = useState(5.0);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (thresholds) {
      setLocalThreshold(thresholds.structuralStressWarningKPa);
      setPushEnabled(thresholds.pushNotificationsEnabled);
    }
  }, [thresholds]);

  async function persist(patch: { structuralStressWarningKPa?: number; pushNotificationsEnabled?: boolean }) {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <TopBar title="Pengaturan Ambang Batas" backHref="/device/vortigen" />

      {!connected ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-zinc-500">Memuat pengaturan...</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 pt-4">
          <div className="rounded-2xl bg-bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15">
                <SlidersHorizontal size={16} className="text-status-warning" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-50">Ambang Batas Peringatan</p>
                <p className="text-[11px] text-zinc-500">Beban struktur maksimum sebelum sistem masuk status kritis</p>
              </div>
            </div>

            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-zinc-50">{localThreshold.toFixed(1)}</span>
              <span className="text-xs text-zinc-500">kPa</span>
            </div>

            <input
              type="range"
              min={2}
              max={10}
              step={0.1}
              value={localThreshold}
              onChange={(e) => setLocalThreshold(parseFloat(e.target.value))}
              onMouseUp={() => persist({ structuralStressWarningKPa: localThreshold })}
              onTouchEnd={() => persist({ structuralStressWarningKPa: localThreshold })}
              className="w-full accent-status-warning"
            />
            <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
              <span>2.0 kPa</span>
              <span>10.0 kPa</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/15">
                <Bell size={16} className="text-sky-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-50">Notifikasi Push</p>
                <p className="text-[11px] text-zinc-500">Terima peringatan prediktif dari Cloud AI</p>
              </div>
            </div>
            <button
              onClick={() => {
                const next = !pushEnabled;
                setPushEnabled(next);
                persist({ pushNotificationsEnabled: next });
              }}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                pushEnabled ? "bg-emerald-500" : "bg-zinc-700"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  pushEnabled ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {saving && <p className="text-center text-[11px] text-zinc-600">Menyimpan...</p>}
        </div>
      )}

      <div className="mt-auto">
        <DeviceNav />
      </div>
    </div>
  );
}

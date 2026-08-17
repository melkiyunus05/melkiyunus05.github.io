"use client";

import { useRouter } from "next/navigation";
import { Settings, Gauge, Clock, Zap, Wind } from "lucide-react";
import { useVortigenStore } from "@/store/useVortigenStore";
import TopBar from "@/components/TopBar";
import StatusHero from "@/components/StatusHero";
import StatusIconRow from "@/components/StatusIconRow";
import MetricCard from "@/components/MetricCard";
import BatteryBar from "@/components/BatteryBar";
import CriticalBanner from "@/components/CriticalBanner";
import DeviceNav from "@/components/DeviceNav";

export default function VortigenDashboard() {
  const router = useRouter();
  const { telemetry, derived, connected } = useVortigenStore();

  if (!connected || !telemetry || !derived) {
    return (
      <div className="flex min-h-full flex-col">
        <TopBar title="Vortigen" backHref="/" />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-zinc-500">Menghubungkan ke perangkat...</p>
        </div>
      </div>
    );
  }

  const isCritical = derived.tier === 4;

  return (
    <div className="flex min-h-full flex-col">
      <TopBar
        title="Vortigen"
        backHref="/"
        rightIcon={Settings}
        onRightClick={() => router.push("/device/vortigen/settings")}
      />

      <div className="-mt-1 px-4 text-[11px] text-zinc-500">Pos 1</div>

      {isCritical && <CriticalBanner />}

      <StatusHero derived={derived} />

      <div className="px-4">
        <StatusIconRow derived={derived} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 px-4">
        <MetricCard
          icon={Gauge}
          label="Beban Struktur"
          value={telemetry.structuralStress.toFixed(1)}
          unit="kPa"
          sublabel={derived.structuralSafe ? "dalam batas aman" : "OVERLOAD"}
          sublabelColor={derived.structuralSafe ? "text-status-normal" : "text-status-critical"}
          accent={derived.structuralSafe ? "text-zinc-500" : "text-status-critical"}
        />
        <MetricCard
          icon={Clock}
          label="Prediksi Umur Pakai"
          value={derived.predictedLifespanDays >= 999 ? "—" : derived.predictedLifespanDays}
          unit={derived.predictedLifespanDays >= 999 ? undefined : "hari"}
          sublabel={derived.maintenanceFlag ? "menurun, perlu cek" : "stabil"}
          sublabelColor={derived.maintenanceFlag ? "text-status-warning" : "text-zinc-500"}
          accent={derived.maintenanceFlag ? "text-status-warning" : "text-zinc-500"}
        />
        <MetricCard icon={Zap} label="Energi Aktif" value={telemetry.energyOutput.toFixed(2)} unit="kW" />
        <MetricCard icon={Wind} label="Kecepatan Angin" value={telemetry.windSpeed.toFixed(1)} unit="m/s" />
      </div>

      <div className="mt-3 px-4">
        <BatteryBar percent={telemetry.batteryPercent} label={derived.batteryLabel} />
      </div>

      {derived.protectionModeActive && (
        <div className="mx-4 mt-3 rounded-2xl bg-bg-card px-4 py-3">
          <p className="text-xs font-semibold text-status-warning">Mode Proteksi Badai Aktif</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
            Edge AI membatasi duty cycle osilasi untuk melindungi struktur dari beban angin ekstrem.
          </p>
        </div>
      )}

      <div className="h-4" />
      <div className="mt-auto">
        <DeviceNav />
      </div>
    </div>
  );
}

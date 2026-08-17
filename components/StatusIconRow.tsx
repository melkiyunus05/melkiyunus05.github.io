import { Activity, CheckCircle2, Wrench } from "lucide-react";
import type { DerivedState } from "@/lib/types";

export default function StatusIconRow({ derived }: { derived: DerivedState }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex items-center gap-3 rounded-2xl bg-bg-card p-3.5">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full ${
            derived.vibrationSafe ? "bg-status-normal/15" : "bg-status-critical/15"
          }`}
        >
          {derived.vibrationSafe ? (
            <CheckCircle2 size={18} className="text-status-normal" />
          ) : (
            <Activity size={18} className="text-status-critical animate-pulseSoft" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-zinc-500">Analisis Getaran</p>
          <p className={`truncate text-xs font-semibold ${derived.vibrationSafe ? "text-status-normal" : "text-status-critical"}`}>
            {derived.vibrationSafe ? "Aman" : "Tidak Aman"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-bg-card p-3.5">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full ${
            derived.maintenanceFlag ? "bg-status-warning/15" : "bg-zinc-500/10"
          }`}
        >
          <Wrench size={18} className={derived.maintenanceFlag ? "text-status-warning" : "text-zinc-500"} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-zinc-500">Pemeliharaan</p>
          <p className={`truncate text-xs font-semibold ${derived.maintenanceFlag ? "text-status-warning" : "text-zinc-400"}`}>
            {derived.maintenanceFlag ? "Perlu Perhatian" : "Tidak Ada Isu"}
          </p>
        </div>
      </div>
    </div>
  );
}

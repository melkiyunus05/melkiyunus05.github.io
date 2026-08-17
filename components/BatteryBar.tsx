import { BatteryFull } from "lucide-react";

export default function BatteryBar({ percent, label }: { percent: number; label: "Baik" | "Perlu Cek" }) {
  const barColor = label === "Baik" ? "bg-status-normal" : "bg-status-warning";
  const labelColor = label === "Baik" ? "text-status-normal" : "text-status-warning";

  return (
    <div className="rounded-2xl bg-bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BatteryFull size={16} className="text-zinc-400" />
          <span className="text-xs font-medium text-zinc-400">Baterai Sistem</span>
        </div>
        <span className={`text-[11px] font-semibold ${labelColor}`}>{label}</span>
      </div>
      <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-bg-soft">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-700 ease-out`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      <span className="text-lg font-semibold text-zinc-50">{percent}%</span>
    </div>
  );
}

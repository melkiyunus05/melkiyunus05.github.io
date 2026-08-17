import type { LucideIcon } from "lucide-react";

export default function MetricCard({
  icon: Icon,
  label,
  value,
  unit,
  sublabel,
  sublabelColor = "text-zinc-500",
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  unit?: string;
  sublabel?: string;
  sublabelColor?: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400">{label}</span>
        <Icon size={16} className={accent ?? "text-zinc-500"} strokeWidth={2} />
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-tight text-zinc-50">{value}</span>
        {unit && <span className="text-xs font-medium text-zinc-500">{unit}</span>}
      </div>
      {sublabel && <span className={`text-[11px] font-medium ${sublabelColor}`}>{sublabel}</span>}
    </div>
  );
}

import { Wind } from "lucide-react";
import { statusColorMap } from "@/lib/format";
import type { DerivedState } from "@/lib/types";

export default function StatusHero({ derived }: { derived: DerivedState }) {
  const color = statusColorMap[derived.statusColor];
  const isCritical = derived.tier === 4;

  return (
    <div className="flex flex-col items-center px-6 py-6 text-center">
      <div
        className={`relative mb-4 flex h-24 w-24 items-center justify-center rounded-full ${color.bg} ring-4 ${color.ring}`}
      >
        <Wind
          size={40}
          className={`${color.text} ${derived.tier !== 1 ? "animate-[spin_3s_linear_infinite]" : ""}`}
          strokeWidth={1.75}
        />
      </div>
      <p className={`max-w-[280px] text-lg font-bold leading-tight ${isCritical ? "text-status-critical" : "text-zinc-50"}`}>
        {derived.statusText}
      </p>
      <p className="mt-1 text-xs font-medium text-zinc-500">
        Tier {derived.tier} · {derived.tierName}
      </p>
    </div>
  );
}

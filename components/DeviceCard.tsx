"use client";

import Link from "next/link";
import { Wind, MapPin } from "lucide-react";
import { statusColorMap } from "@/lib/format";
import type { DerivedState } from "@/lib/types";

export default function DeviceCard({ derived, connected }: { derived?: DerivedState; connected: boolean }) {
  const color = derived ? statusColorMap[derived.statusColor] : statusColorMap.off;
  const statusLabel = !connected || !derived ? "Menghubungkan..." : derived.tierName === "Kritis" ? "Kritis — Segera Periksa" : derived.statusText;

  return (
    <Link
      href="/device/vortigen"
      className="flex items-center gap-4 rounded-2xl bg-bg-card p-4 shadow-sm transition active:scale-[0.98]"
    >
      <div className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${color.bg} ring-1 ${color.ring}`}>
        <Wind size={26} className={color.text} strokeWidth={2} />
        <span className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full ${color.dot} ring-2 ring-bg-card ${derived?.statusColor === "critical" ? "animate-pulseSoft" : ""}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[11px] text-zinc-500">
          <MapPin size={11} />
          <span>Pos 1</span>
        </div>
        <p className="truncate text-base font-semibold text-zinc-50">Vortigen</p>
        <p className={`truncate text-xs font-medium ${color.text}`}>{statusLabel}</p>
      </div>
    </Link>
  );
}

"use client";

import Link from "next/link";
import { Settings2, Sparkles } from "lucide-react";
import { useVortigenStore } from "@/store/useVortigenStore";
import DeviceCard from "@/components/DeviceCard";

export default function HomePage() {
  const { derived, connected } = useVortigenStore();

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex items-center justify-between px-4 pb-2 pt-5">
        <div>
          <p className="text-xs font-medium text-zinc-500">Rumahku</p>
          <h1 className="text-2xl font-bold text-zinc-50">VORTIGEN Site</h1>
        </div>
        <Link
          href="/demo-control"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-card text-zinc-300 active:bg-white/10"
          aria-label="Panel Demo"
        >
          <Settings2 size={18} />
        </Link>
      </div>

      <div className="mx-4 mb-5 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-bg-card px-4 py-3">
        <Sparkles size={16} className="shrink-0 text-emerald-400" />
        <p className="text-xs leading-relaxed text-zinc-300">
          Edge AI &amp; Cloud AI aktif memantau turbin bladeless Anda secara real-time.
        </p>
      </div>

      <div className="px-4">
        <p className="mb-2 px-0.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Perangkat (1)</p>
        <DeviceCard derived={derived} connected={connected} />
      </div>

      <div className="mt-auto px-4 py-6 text-center">
        <p className="text-[11px] text-zinc-600">Prototipe untuk Samsung Solve for Tomorrow 2026</p>
      </div>
    </div>
  );
}

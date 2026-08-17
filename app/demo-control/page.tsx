"use client";

import { useState } from "react";
import { CloudLightning, Leaf, PowerOff, RotateCcw, TriangleAlert } from "lucide-react";
import { useVortigenStore } from "@/store/useVortigenStore";
import { statusColorMap } from "@/lib/format";
import TopBar from "@/components/TopBar";
import type { DemoMode } from "@/lib/types";

const SCENARIOS: {
  mode: DemoMode;
  title: string;
  description: string;
  icon: typeof Leaf;
  activeClass: string;
}[] = [
  {
    mode: "normal",
    title: "Simulasikan Kondisi Normal",
    description: "Angin 3-8.5 m/s, resonansi stabil, semua sistem aman.",
    icon: Leaf,
    activeClass: "border-status-normal bg-status-normal/10",
  },
  {
    mode: "warning",
    title: "Simulasikan Peringatan Dini",
    description: "Cloud AI mendeteksi efisiensi turun >15%, struktur masih aman.",
    icon: TriangleAlert,
    activeClass: "border-status-warning bg-status-warning/10",
  },
  {
    mode: "critical",
    title: "Simulasikan Badai / Kritis",
    description: "Angin ekstrem, beban struktur melebihi ambang aman, Mode Proteksi aktif.",
    icon: CloudLightning,
    activeClass: "border-status-critical bg-status-critical/10",
  },
  {
    mode: "off",
    title: "Simulasikan Perangkat Mati",
    description: "Kecepatan angin di bawah 2 m/s, tidak ada daya dihasilkan.",
    icon: PowerOff,
    activeClass: "border-zinc-500 bg-zinc-500/10",
  },
];

export default function DemoControlPage() {
  const { demoMode, derived, triggerDemo, connected } = useVortigenStore();
  const [pending, setPending] = useState<DemoMode | null>(null);

  async function handleTrigger(mode: DemoMode) {
    setPending(mode);
    try {
      await triggerDemo(mode);
    } finally {
      setPending(null);
    }
  }

  const color = derived ? statusColorMap[derived.statusColor] : statusColorMap.off;

  return (
    <div className="flex min-h-full flex-col">
      <TopBar title="Panel Kontrol Demo" backHref="/" />

      <div className="px-4 pt-4">
        <div className={`mb-4 rounded-2xl border ${color.ring} bg-bg-card p-4`}>
          <p className="text-[11px] text-zinc-500">Status Live Saat Ini</p>
          <p className={`text-base font-bold ${color.text}`}>
            {connected && derived ? derived.statusText : "Menghubungkan..."}
          </p>
          {derived && <p className="mt-0.5 text-[11px] text-zinc-600">Mode simulasi aktif: {demoMode}</p>}
        </div>

        <p className="mb-2 px-0.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Skenario Demo
        </p>

        <div className="flex flex-col gap-3">
          {SCENARIOS.map((s) => {
            const Icon = s.icon;
            const isActive = demoMode === s.mode;
            const isPending = pending === s.mode;
            return (
              <button
                key={s.mode}
                onClick={() => handleTrigger(s.mode)}
                disabled={isPending}
                className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition active:scale-[0.98] ${
                  isActive ? s.activeClass : "border-white/5 bg-bg-card"
                } disabled:opacity-60`}
              >
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5">
                  <Icon size={18} className="text-zinc-200" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-50">{s.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{s.description}</p>
                </div>
                {isActive && (
                  <span className="mt-1 shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                    {isPending ? "..." : "AKTIF"}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => handleTrigger("normal")}
          disabled={pending !== null}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-100 py-3.5 text-sm font-semibold text-zinc-900 active:scale-[0.98] disabled:opacity-60"
        >
          <RotateCcw size={16} />
          Reset ke Normal
        </button>

        <p className="mt-4 px-1 text-center text-[11px] leading-relaxed text-zinc-600">
          Panel ini mensimulasikan data sensor ESP32 secara langsung ke dashboard — cocok untuk demo tanpa
          alat fisik menyala. Perubahan langsung tersiar ke semua halaman melalui koneksi real-time.
        </p>
      </div>
    </div>
  );
}

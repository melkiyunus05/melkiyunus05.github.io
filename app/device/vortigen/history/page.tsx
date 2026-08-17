"use client";

import { useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Leaf, CalendarCheck } from "lucide-react";
import { useVortigenStore } from "@/store/useVortigenStore";
import TopBar from "@/components/TopBar";
import DeviceNav from "@/components/DeviceNav";

type Range = "weekly" | "monthly";

export default function HistoryPage() {
  const { history, connected } = useVortigenStore();
  const [range, setRange] = useState<Range>("weekly");

  const data = range === "weekly" ? history?.weekly : history?.monthly;

  return (
    <div className="flex min-h-full flex-col">
      <TopBar title="Riwayat Produksi Energi" backHref="/device/vortigen" />

      {!connected || !history ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-zinc-500">Memuat data...</p>
        </div>
      ) : (
        <>
          <div className="px-4 pt-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500">Total Produksi Energi</p>
                <p className="text-2xl font-bold text-zinc-50">{history.totalKwh} kWh</p>
              </div>
              <div className="flex rounded-full bg-bg-card p-1">
                {(["weekly", "monthly"] as Range[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      range === r ? "bg-emerald-500 text-black" : "text-zinc-400"
                    }`}
                  >
                    {r === "weekly" ? "Mingguan" : "Bulanan"}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-bg-card p-4">
              <p className="mb-2 text-xs font-semibold text-zinc-400">
                {range === "weekly" ? "Produksi per Minggu (kWh)" : "Produksi per Bulan (kWh)"}
              </p>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#71717a", fontSize: 11 }}
                    />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#71717a", fontSize: 11 }} />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      contentStyle={{
                        background: "#1a1a1a",
                        border: "1px solid #2a2a2a",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "#a1a1aa" }}
                      itemStyle={{ color: "#22c55e" }}
                      formatter={(value: number) => [`${value} kWh`, "Produksi"]}
                    />
                    <Bar dataKey="kwh" fill="#22c55e" radius={[6, 6, 6, 6]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 px-4 pt-3">
            <div className="rounded-2xl bg-bg-card p-4">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15">
                <Leaf size={16} className="text-emerald-400" />
              </div>
              <p className="text-lg font-bold text-zinc-50">{history.co2AvoidedKg} kg</p>
              <p className="text-[11px] text-zinc-500">CO2e dihindari</p>
            </div>
            <div className="rounded-2xl bg-bg-card p-4">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/15">
                <CalendarCheck size={16} className="text-sky-400" />
              </div>
              <p className="text-lg font-bold text-zinc-50">{history.activeDays} hari</p>
              <p className="text-[11px] text-zinc-500">Alat aktif menyala</p>
            </div>
          </div>
        </>
      )}

      <div className="mt-auto">
        <DeviceNav />
      </div>
    </div>
  );
}

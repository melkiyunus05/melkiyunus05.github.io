"use client";

import { AlertTriangle, Bell, BellOff, CheckCircle2, TriangleAlert } from "lucide-react";
import { useVortigenStore } from "@/store/useVortigenStore";
import { formatClock, formatRelativeTime } from "@/lib/format";
import TopBar from "@/components/TopBar";
import DeviceNav from "@/components/DeviceNav";
import type { NotificationItem } from "@/lib/types";

function NotificationRow({ item }: { item: NotificationItem }) {
  const isCritical = item.tier === 4;
  const isWarning = item.tier === 3;
  const Icon = isCritical ? AlertTriangle : isWarning ? TriangleAlert : CheckCircle2;
  const iconBg = isCritical ? "bg-status-critical/15" : isWarning ? "bg-status-warning/15" : "bg-status-normal/15";
  const iconColor = isCritical ? "text-status-critical" : isWarning ? "text-status-warning" : "text-status-normal";

  return (
    <div className="flex gap-3 rounded-2xl bg-bg-card p-4">
      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
        <Icon size={17} className={iconColor} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-zinc-50">{item.title}</p>
          <span className="shrink-0 text-[10px] text-zinc-600">{formatClock(item.timestamp)}</span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{item.message}</p>
        <p className="mt-1.5 text-[10px] text-zinc-600">{formatRelativeTime(item.timestamp)}</p>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const { notifications, thresholds, connected } = useVortigenStore();

  return (
    <div className="flex min-h-full flex-col">
      <TopBar title="Log Notifikasi" backHref="/device/vortigen" />

      {!connected || !notifications ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-zinc-500">Memuat notifikasi...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
          <BellOff size={28} className="text-zinc-600" />
          <p className="text-sm text-zinc-500">Belum ada notifikasi.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-4 pt-4">
          {!thresholds?.pushNotificationsEnabled && (
            <div className="mb-1 flex items-center gap-2 rounded-2xl bg-bg-card px-4 py-2.5">
              <Bell size={14} className="text-zinc-500" />
              <p className="text-[11px] text-zinc-500">Notifikasi push sedang dimatikan di Pengaturan.</p>
            </div>
          )}
          {notifications.map((item) => (
            <NotificationRow key={item.id} item={item} />
          ))}
        </div>
      )}

      <div className="mt-auto">
        <DeviceNav />
      </div>
    </div>
  );
}

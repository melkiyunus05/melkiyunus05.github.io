import type { DerivedState } from "./types";

export const statusColorMap: Record<DerivedState["statusColor"], { text: string; bg: string; ring: string; dot: string }> = {
  off: { text: "text-zinc-400", bg: "bg-zinc-500/15", ring: "ring-zinc-500/30", dot: "bg-zinc-400" },
  normal: { text: "text-status-normal", bg: "bg-status-normal/15", ring: "ring-status-normal/30", dot: "bg-status-normal" },
  warning: { text: "text-status-warning", bg: "bg-status-warning/15", ring: "ring-status-warning/30", dot: "bg-status-warning" },
  critical: { text: "text-status-critical", bg: "bg-status-critical/15", ring: "ring-status-critical/30", dot: "bg-status-critical" },
};

export function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 5) return "Baru saja";
  if (diffSec < 60) return `${diffSec} detik lalu`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} hari lalu`;
}

export function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, History, Bell, Settings } from "lucide-react";

const items = [
  { href: "/device/vortigen", label: "Dashboard", icon: LayoutDashboard },
  { href: "/device/vortigen/history", label: "Riwayat", icon: History },
  { href: "/device/vortigen/notifications", label: "Notifikasi", icon: Bell },
  { href: "/device/vortigen/settings", label: "Pengaturan", icon: Settings },
];

export default function DeviceNav() {
  const pathname = usePathname();

  return (
    <div className="sticky bottom-0 z-10 grid grid-cols-4 gap-1 border-t border-white/5 bg-bg/95 px-2 py-2 backdrop-blur">
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-1 rounded-xl py-1.5 transition ${
              active ? "text-zinc-50" : "text-zinc-500"
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2.4 : 2} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

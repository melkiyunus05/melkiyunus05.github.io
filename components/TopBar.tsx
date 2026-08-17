"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export default function TopBar({
  title,
  backHref,
  rightIcon: RightIcon,
  onRightClick,
}: {
  title: string;
  backHref?: string;
  rightIcon?: LucideIcon;
  onRightClick?: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-bg/90 px-4 py-3.5 backdrop-blur">
      <div className="flex items-center gap-2">
        {backHref && (
          <Link
            href={backHref}
            className="-ml-1.5 flex h-8 w-8 items-center justify-center rounded-full text-zinc-300 active:bg-white/10"
          >
            <ChevronLeft size={22} />
          </Link>
        )}
        <span className="text-base font-semibold text-zinc-50">{title}</span>
      </div>
      {RightIcon && (
        <button
          onClick={onRightClick}
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-300 active:bg-white/10"
        >
          <RightIcon size={20} />
        </button>
      )}
    </div>
  );
}

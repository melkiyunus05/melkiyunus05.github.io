"use client";

import { create } from "zustand";
import type { DemoMode, StoreSnapshot } from "@/lib/types";

interface VortigenState extends Partial<StoreSnapshot> {
  connected: boolean;
  loading: boolean;
  setSnapshot: (s: StoreSnapshot) => void;
  setConnected: (c: boolean) => void;
  triggerDemo: (mode: DemoMode) => Promise<void>;
}

export const useVortigenStore = create<VortigenState>((set) => ({
  connected: false,
  loading: true,
  setSnapshot: (s) => set({ ...s, loading: false }),
  setConnected: (c) => set({ connected: c }),
  triggerDemo: async (mode) => {
    const res = await fetch("/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    if (res.ok) {
      // Apply immediately instead of waiting for the next poll tick, so a
      // button press feels instant during a live demo.
      const data: StoreSnapshot = await res.json();
      useVortigenStore.getState().setSnapshot(data);
    }
  },
}));

const POLL_INTERVAL_MS = 2000;
let started = false;

export function startVortigenPolling() {
  if (started || typeof window === "undefined") return;
  started = true;

  const tick = async () => {
    try {
      const res = await fetch("/api/telemetry", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: StoreSnapshot = await res.json();
      useVortigenStore.getState().setSnapshot(data);
      useVortigenStore.getState().setConnected(true);
    } catch {
      useVortigenStore.getState().setConnected(false);
    }
  };

  tick();
  setInterval(tick, POLL_INTERVAL_MS);
}

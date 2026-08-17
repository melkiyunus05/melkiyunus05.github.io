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
    await fetch("/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
  },
}));

let started = false;

export function startVortigenStream() {
  if (started || typeof window === "undefined") return;
  started = true;

  const connect = () => {
    const es = new EventSource("/api/stream");
    es.onopen = () => useVortigenStore.getState().setConnected(true);
    es.onmessage = (evt) => {
      try {
        const data: StoreSnapshot = JSON.parse(evt.data);
        useVortigenStore.getState().setSnapshot(data);
      } catch {
        // ignore malformed frame
      }
    };
    es.onerror = () => {
      useVortigenStore.getState().setConnected(false);
      es.close();
      setTimeout(connect, 2000);
    };
  };

  connect();
}

"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // PWA install still works without a service worker; just skip offline caching.
      });
    }
  }, []);

  return null;
}

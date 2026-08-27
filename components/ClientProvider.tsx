"use client";

import { useEffect } from "react";
import { startVortigenPolling } from "@/store/useVortigenStore";

export default function ClientProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    startVortigenPolling();
  }, []);

  return <>{children}</>;
}

"use client";

import { useEffect } from "react";
import { startVortigenStream } from "@/store/useVortigenStore";

export default function ClientProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    startVortigenStream();
  }, []);

  return <>{children}</>;
}

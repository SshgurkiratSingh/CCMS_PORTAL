"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth-provider";

export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

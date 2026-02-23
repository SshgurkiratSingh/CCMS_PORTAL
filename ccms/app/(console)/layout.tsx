import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}

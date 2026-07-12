"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button, Chip } from "@heroui/react";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/panels",    label: "Panels"    },
  { href: "/analytics", label: "Analytics" },
  { href: "/alerts",    label: "Alerts"    },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { session, logout } = useAuth();

  return (
    <div className="min-h-screen text-[#e4e4f0]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-5 md:px-8">

        {/* Header */}
        <header className="rounded-2xl border border-[#26263a] border-t-white/[0.06] bg-[#111118]/90 px-4 py-4 shadow-2xl shadow-black/70 backdrop-blur-md md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-violet-400 font-semibold">
                CCMS Command Console
              </p>
              <h1 className="text-xl font-bold text-white">
                Streetlight Fleet Operations
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <Chip color="accent" size="sm" variant="soft">
                {session?.role ?? "Viewer"}
              </Chip>
              <Button
                variant="outline"
                size="sm"
                onPress={() => void logout()}
                className="border-[#26263a] bg-[#18181f] text-[#a0a0c0] hover:bg-[#1f1f2a] hover:text-white transition-colors"
              >
                Logout
              </Button>
            </div>
          </div>

          <nav className="mt-4 flex flex-wrap gap-1.5">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? "bg-violet-600 text-white shadow-[0_0_14px_rgba(124,58,237,0.5)]"
                      : "bg-[#18181f] text-[#8080a0] hover:bg-[#1f1f2a] hover:text-[#e4e4f0]"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </header>

        {/* Main */}
        <main className="flex-1 rounded-2xl border border-[#26263a] border-t-white/[0.04] bg-[#111118]/80 p-4 shadow-xl shadow-black/60 backdrop-blur-sm md:p-6">
          {children}
        </main>

      </div>
    </div>
  );
}

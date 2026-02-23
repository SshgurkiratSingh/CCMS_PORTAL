"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/panels", label: "Panels" },
  { href: "/analytics", label: "Analytics" },
  { href: "/alerts", label: "Alerts" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#1e293b_0%,#020617_58%)] text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8">
        <header className="rounded-2xl border border-slate-700/70 bg-slate-900/70 px-4 py-4 shadow-2xl shadow-slate-950/60 backdrop-blur md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">
                CCMS Command Console
              </p>
              <h1 className="text-xl font-semibold text-slate-100">
                Streetlight Fleet Operations
              </h1>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <span>{session?.username ?? "Unknown Operator"}</span>
              <span className="rounded-full border border-cyan-600/70 px-2 py-1 text-xs text-cyan-200">
                {session?.role ?? "Viewer"}
              </span>
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.replace("/login");
                }}
                className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-100 hover:bg-slate-700"
              >
                Logout
              </button>
            </div>
          </div>
          <nav className="mt-4 flex flex-wrap gap-2">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-cyan-500 text-slate-950"
                      : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="flex-1 rounded-2xl border border-slate-800/80 bg-slate-900/65 p-4 shadow-xl shadow-slate-950/55 backdrop-blur md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

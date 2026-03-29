"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboardKey, setDashboardKey] = useState("");
  const [adminKey, setAdminKey] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  const onContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dashboardKey.trim()) {
      setError("Dashboard Key is required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(dashboardKey.trim(), adminKey.trim() || undefined);
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Unable to login.",
      );
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#334155_0%,#020617_66%)] px-4 py-10 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">
          Authentication Gateway
        </p>
        <h1 className="mt-1 text-2xl font-semibold">CCMS Operator Login</h1>
        <p className="mt-2 text-sm text-slate-300">
          Sign-in is handled by local Dashboard Key. The key is stored locally
          and sent as a header to the API.
        </p>

        <form onSubmit={onContinue} className="mt-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Dashboard Key *
            </label>
            <input
              type="password"
              value={dashboardKey}
              onChange={(e) => setDashboardKey(e.target.value)}
              className="mt-1 block w-full rounded-md border-slate-600 bg-slate-800 text-slate-100 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm p-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Admin Key (Optional)
            </label>
            <input
              type="password"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              className="mt-1 block w-full rounded-md border-slate-600 bg-slate-800 text-slate-100 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm p-2"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-md bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {error && (
          <p className="mt-4 rounded-md border border-rose-700 bg-rose-900/30 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

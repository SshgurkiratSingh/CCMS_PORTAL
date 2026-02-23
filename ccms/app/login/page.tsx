"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { login, forgotPassword } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      await login(username, password);
      router.replace("/dashboard");
    } catch (authError) {
      setError(
        authError instanceof Error ? authError.message : "Login request failed."
      );
    } finally {
      setLoading(false);
    }
  };

  const onForgotPassword = async () => {
    setError(null);
    setMessage(null);

    try {
      await forgotPassword(username);
      setMessage(
        "Password reset initiated. Check your registered email or SMS channel for code delivery."
      );
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Unable to process password reset."
      );
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
          Access token is stored in-memory and added to API requests as
          `Authorization: Bearer &lt;token&gt;`.
        </p>

        <form onSubmit={onLogin} className="mt-6 space-y-4">
          <label className="block space-y-1 text-sm">
            <span>Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-cyan-400 transition focus:ring-2"
              required
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span>Password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-cyan-400 transition focus:ring-2"
              required
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Authenticating..." : "Login"}
          </button>
        </form>

        <button
          type="button"
          onClick={onForgotPassword}
          className="mt-3 text-sm text-cyan-300 underline decoration-cyan-700 underline-offset-4 hover:text-cyan-200"
        >
          Forgot password?
        </button>

        {message && (
          <p className="mt-4 rounded-md border border-emerald-700 bg-emerald-900/30 px-3 py-2 text-sm text-emerald-200">
            {message}
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-md border border-rose-700 bg-rose-900/30 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

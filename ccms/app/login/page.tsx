"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, loginWithRedirect } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  const onContinue = async () => {
    setLoading(true);
    setError(null);

    try {
      await loginWithRedirect();
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Unable to start Cognito login redirect."
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
          Sign-in is handled by Cognito Hosted UI with OAuth2 Authorization Code
          + PKCE. Access token is held in-memory for API calls.
        </p>

        <button
          type="button"
          onClick={() => void onContinue()}
          disabled={loading}
          className="mt-6 w-full rounded-md bg-cyan-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Redirecting..." : "Continue with Cognito"}
        </button>

        <p className="mt-3 text-xs text-slate-400">
          Use the Cognito login page for forgot-password and challenge flows.
        </p>

        {error && (
          <p className="mt-4 rounded-md border border-rose-700 bg-rose-900/30 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

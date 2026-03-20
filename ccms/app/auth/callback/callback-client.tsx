"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

export function CallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeLoginFromCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const complete = async () => {
      const oauthError = searchParams.get("error");
      const oauthErrorDescription = searchParams.get("error_description");
      if (oauthError) {
        if (mounted) {
          setError(oauthErrorDescription ?? oauthError);
        }
        return;
      }

      const code = searchParams.get("code");
      const state = searchParams.get("state");
      if (!code || !state) {
        if (mounted) {
          setError("Missing authorization code or state in callback.");
        }
        return;
      }

      try {
        await completeLoginFromCallback(code, state);
        router.replace("/dashboard");
      } catch (callbackError) {
        if (mounted) {
          setError(
            callbackError instanceof Error
              ? callbackError.message
              : "Unable to complete Cognito login callback."
          );
        }
      }
    };

    void complete();

    return () => {
      mounted = false;
    };
  }, [completeLoginFromCallback, router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#334155_0%,#020617_66%)] px-4 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">
          Authentication Gateway
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Finalizing Login</h1>
        {!error && (
          <p className="mt-3 text-sm text-slate-300">
            Completing OAuth callback with Cognito, please wait...
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-md border border-rose-700 bg-rose-900/30 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

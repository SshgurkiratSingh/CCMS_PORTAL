import { Suspense } from "react";
import { CallbackClient } from "@/app/auth/callback/callback-client";

function CallbackFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#334155_0%,#020617_66%)] px-4 text-slate-100">
      <div className="w-full max-w-md rounded-2xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">
          Authentication Gateway
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Finalizing Login</h1>
        <p className="mt-3 text-sm text-slate-300">
          Preparing callback context...
        </p>
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackFallback />}>
      <CallbackClient />
    </Suspense>
  );
}

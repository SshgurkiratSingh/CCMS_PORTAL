import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-2xl border border-[#26263a] border-t-white/[0.07] bg-[#111118]/90 p-8 text-[#e4e4f0] shadow-2xl shadow-black/80 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.22em] text-violet-400 font-semibold">
          CCMS Portal
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          Centralized Command &amp; Monitoring
        </h1>
        <p className="mt-3 text-sm text-[#8080a0] leading-relaxed">
          Real-time streetlight fleet operations — monitor nodes, triage alerts,
          and dispatch commands from a single console.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:bg-violet-500 hover:shadow-[0_0_28px_rgba(124,58,237,0.55)] transition-all"
          >
            Login
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-[#26263a] bg-[#18181f] px-4 py-2 text-sm font-medium text-[#a0a0c0] hover:bg-[#1f1f2a] hover:text-white transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

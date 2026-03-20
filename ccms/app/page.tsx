import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900/70 p-6 text-slate-100">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">
          CCMS Portal
        </p>
        <h1 className="mt-2 text-2xl font-semibold">
          Static Frontend Deployment
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          This build can be hosted on Vercel as static files with no Vercel
          backend API.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/login"
            className="rounded bg-cyan-400 px-3 py-1.5 text-sm font-semibold text-slate-950"
          >
            Login
          </Link>
          <Link
            href="/dashboard"
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

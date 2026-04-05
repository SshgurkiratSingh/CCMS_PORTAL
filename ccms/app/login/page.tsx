"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button, Card, Chip, Input } from "@heroui/react";

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
      <Card className="w-full max-w-md border border-slate-700/70 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/70 backdrop-blur">
        <div className="space-y-2">
          <Chip
            className="uppercase tracking-[0.2em]"
            color="accent"
            size="sm"
            variant="soft"
          >
            Authentication Gateway
          </Chip>
          <h1 className="text-2xl font-semibold">CCMS Operator Login</h1>
          <p className="text-sm text-slate-300">
            Sign-in is handled by local Dashboard Key. The key is stored locally
            and sent as a header to the API.
          </p>
        </div>

        <form onSubmit={onContinue} className="mt-6 flex flex-col gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-300">
              Dashboard Key *
            </p>
            <Input
              type="password"
              variant="secondary"
              value={dashboardKey}
              onChange={(e) => setDashboardKey(e.target.value)}
              required
              placeholder="Enter dashboard key"
            />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-300">
              Admin Key (Optional)
            </p>
            <Input
              type="password"
              variant="secondary"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              placeholder="Enter admin key"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            isDisabled={loading}
            isPending={loading}
            className="mt-2 w-full"
          >
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>

        {error && (
          <p className="mt-4 rounded-md border border-rose-700 bg-rose-900/30 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}

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
    <div className="flex min-h-screen items-center justify-center px-4 py-10 text-[#e4e4f0]">
      <Card className="w-full max-w-md border border-[#26263a] border-t-white/[0.07] bg-[#111118]/95 p-8 shadow-2xl shadow-black/80 backdrop-blur">
        <div className="space-y-2">
          <Chip
            className="uppercase tracking-[0.2em] font-semibold"
            color="accent"
            size="sm"
            variant="soft"
          >
            Authentication Gateway
          </Chip>
          <h1 className="text-2xl font-bold text-white">CCMS Operator Login</h1>
          <p className="text-sm text-[#8080a0] leading-relaxed">
            Sign-in is handled by local Dashboard Key. The key is stored locally
            and sent as a header to the API.
          </p>
        </div>

        <form onSubmit={onContinue} className="mt-7 flex flex-col gap-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-[#c0c0d8]">
              Dashboard Key <span className="text-rose-400">*</span>
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
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-[#c0c0d8]">
              Admin Key <span className="text-[#6060808]">( Optional)</span>
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
            className="mt-1 w-full shadow-[0_0_18px_rgba(124,58,237,0.3)] hover:shadow-[0_0_24px_rgba(124,58,237,0.5)] transition-shadow"
          >
            {loading ? "Logging in..." : "Login"}
          </Button>
        </form>

        {error && (
          <p className="mt-4 rounded-lg border border-rose-700/50 bg-rose-950/50 px-3 py-2.5 text-sm text-rose-300">
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}

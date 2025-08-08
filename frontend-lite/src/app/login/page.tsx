"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authLogin, type Profile } from "../../lib/apiClient";
import Link from "next/link";
import { Button, Card, Input } from "@kiff/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@kiff.dev");
  const [password, setPassword] = useState("demo12345");
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (busy) return;
    try {
      setBusy(true);
      const profile: Profile = await authLogin({ email, password });
      router.replace(profile.role === "admin" ? "/admin" : "/");
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-200">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Sign in to Kiff</h1>
          <p className="text-slate-500 dark:text-slate-400">Welcome back! Enter your details to continue.</p>
        </div>

        <Card padding="lg">
          {error ? (
            <div className="text-red-600 text-sm mb-2">{error}</div>
          ) : null}
          <form onSubmit={onSubmit} className="grid gap-3">
            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
            />
            <Button type="submit" loading={busy} fullWidth>
              {busy ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        </Card>
        <div className="text-center text-sm text-slate-500 dark:text-slate-400">
          Don’t have an account? <Link className="text-blue-600" href="/signup">Sign up</Link>
        </div>
      </div>
    </div>
  );
}

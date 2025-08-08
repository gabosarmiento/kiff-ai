"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authSignup, type Profile } from "../../lib/apiClient";
import { Button, Card, Input } from "@kiff/ui";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@kiff.dev");
  const [password, setPassword] = useState("demo12345");
  const [role, setRole] = useState<"admin" | "user">("user");
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (busy) return;
    try {
      setBusy(true);
      const profile: Profile = await authSignup({ email, password, role });
      router.replace(profile.role === "admin" ? "/admin" : "/");
    } catch (err: any) {
      setError(err?.message || "Signup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-200">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Create account</h1>
        </div>
        {error ? (
          <div className="text-red-600 text-sm">{error}</div>
        ) : null}
        <Card padding="lg">
          <form onSubmit={onSubmit} className="grid gap-3">
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => { setEmail("demo@kiff.dev"); setPassword("demo12345"); setRole("user"); }}>Use Demo (user)</Button>
              <Button type="button" variant="secondary" onClick={() => { setEmail("bob@kiff.dev"); setPassword("bob12345"); setRole("admin"); }}>Use Admin</Button>
            </div>
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required fullWidth />
            <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required fullWidth />
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">Role</label>
              <select className="border rounded-lg h-11 px-3" value={role} onChange={(e) => setRole(e.target.value as any)}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Button type="submit" loading={busy}> {busy ? "Creating…" : "Create account"} </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authLogout } from "../../../lib/apiClient";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        await authLogout();
      } catch {
        // ignore
      } finally {
        // Hard redirect to clear any client state
        router.replace("/auth/login");
        if (typeof window !== "undefined") window.location.reload();
      }
    })();
  }, [router]);

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <p>Signing you out…</p>
    </div>
  );
}

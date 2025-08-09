"use client";
import { Navbar } from "../../components/layout/Navbar";
import { AppSidebar } from "../../components/navigation/AppSidebar";
import { useLayoutState } from "../../components/layout/LayoutState";
import { getTenantId } from "../../lib/tenant";
import { useEffect, useState } from "react";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { deleteAccount } from "../../lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

export default function AccountPage() {
  const { user } = useAuth();
  const { collapsed } = useLayoutState();
  const leftWidth = collapsed ? 72 : 280;
  const [tenant, setTenant] = useState("");
  const [email, setEmail] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // hydrate tenant from local util
    setTenant(getTenantId());
    // hydrate email from auth context or backend /api/auth/me
    if (user?.email) {
      setEmail(user.email);
    } else {
      // best-effort fetch
      fetch((process.env.NEXT_PUBLIC_BACKEND_ORIGIN || "http://localhost:8000") + "/api/auth/me", {
        credentials: "include",
      })
        .then(async (r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.email) setEmail(data.email);
        })
        .catch(() => {});
    }
  }, [user?.email]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {}
  };

  // Password change removed for now per UX request

  return (
    <div className="app-shell">
      <Navbar />
      <AppSidebar />
      <main className="pane" style={{ padding: 16, paddingLeft: leftWidth + 32, marginTop: 80 }}>
          <div style={{ maxWidth: 1400, margin: "0 auto" }}>
            <h1 style={{ margin: 0, fontSize: 22 }}>Account</h1>
            <p className="label" style={{ marginTop: 8 }}>Manage your profile and account.</p>

            <section style={{ marginTop: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24 }}>
                {/* Profile (email is identifier, read-only) */}
                <div className="card" style={{ minWidth: 0 }}>
                  <div className="card-header">Profile</div>
                  <div className="card-body">
                    <div className="field">
                      <label className="label">Email</label>
                      <input className="input" type="email" placeholder="you@example.com" value={email} disabled readOnly />
                    </div>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="card" style={{ gridColumn: "1 / -1" }}>
                  <div className="card-header" style={{ color: "#dc2626" }}>Danger Zone</div>
                  <div className="card-body">
                    <p className="muted">Be careful—actions here can’t be undone.</p>
                    <div className="row" style={{ marginTop: 12 }}>
                      <button className="button danger" onClick={() => setConfirmOpen(true)} disabled={busy}>Delete Account</button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
          <ConfirmModal
            open={confirmOpen}
            title="Delete account?"
            message="This action is permanent and will remove all your data."
            confirmText={busy ? "Deleting…" : "Delete"}
            cancelText="Cancel"
            onCancel={() => !busy && setConfirmOpen(false)}
            onConfirm={async () => {
              if (busy) return;
              try {
                setBusy(true);
                await deleteAccount();
                setConfirmOpen(false);
                alert("Account deleted. Redirecting to home.");
                window.location.href = "/";
              } catch (e) {
                console.error(e);
                alert("Failed to delete account.");
              } finally {
                setBusy(false);
              }
            }}
            confirmMatch="DELETE MY ACCOUNT"
            confirmPlaceholder="Type DELETE MY ACCOUNT"
          />
      </main>
    </div>
  );
}

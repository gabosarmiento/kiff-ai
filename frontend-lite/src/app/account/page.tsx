"use client";
import { Navbar } from "../../components/layout/Navbar";
import { Sidebar } from "../../components/navigation/Sidebar";
import { BottomNav } from "../../components/navigation/BottomNav";
import { useLayoutState } from "../../components/layout/LayoutState";
import { getTenantId } from "../../lib/tenant";
import { useEffect, useState } from "react";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { deleteAccount } from "../../lib/apiClient";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AccountPage() {
  const { user } = useAuth();
  const { collapsed } = useLayoutState();
  const router = useRouter();
  const leftWidth = collapsed ? 72 : 280;
  const [tenant, setTenant] = useState("");
  const [email, setEmail] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    // hydrate tenant from local util
    setTenant(getTenantId());
    // hydrate email from NextAuth context
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user?.email]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {}
  };

  // Password change removed for now per UX request

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut({ redirect: false });
      router.push("/login");
    } catch (error) {
      console.error('Logout error:', error);
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="app-shell">
      <Navbar />
      <Sidebar />
      <main className="pane pane-with-sidebar" style={{ padding: 16, paddingLeft: leftWidth + 32, marginTop: 80 }}>
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

                {/* Session Management */}
                <div className="card" style={{ minWidth: 0 }}>
                  <div className="card-header">Session</div>
                  <div className="card-body">
                    <p className="muted">Sign out of your account on this device.</p>
                    <div className="row" style={{ marginTop: 12 }}>
                      <button 
                        className="button" 
                        onClick={handleLogout} 
                        disabled={loggingOut}
                      >
                        {loggingOut ? "Signing out..." : "Sign out"}
                      </button>
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
      <BottomNav />
    </div>
  );
}

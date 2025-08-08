"use client";
import { Navbar } from "../../components/layout/Navbar";
import { Sidebar } from "../../components/layout/Sidebar";
import { getTenantId, setTenantId } from "../../lib/tenant";
import { useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { deleteAccount } from "../../lib/apiClient";

export default function AccountPage() {
  const [tenant, setTenant] = useState("");
  const [email, setEmail] = useState("");
  const [apiKey, setApiKey] = useState("sk-••••••••••••");
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTenant(getTenantId());
  }, []);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {}
  };

  return (
    <div className="app-shell">
      <Navbar />
      <div className="dashboard-grid">
        <aside className="sidebar pane">
          <Sidebar />
        </aside>
        <main className="pane" style={{ padding: 16, maxWidth: 860 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>Account</h1>
          <p className="label" style={{ marginTop: 8 }}>Manage your profile, security, and API settings.</p>

          <section style={{ marginTop: 16 }}>
            {/* Profile */}
            <div className="card">
              <div className="card-header">Profile</div>
              <div className="card-body">
                <div className="field">
                  <label className="label">Email</label>
                  <input className="input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="button primary">Save Profile</button>
                </div>
              </div>
            </div>

            {/* Security */}
            <div className="card">
              <div className="card-header">Security</div>
              <div className="card-body">
                <div className="field">
                  <label className="label">Current Password</label>
                  <input className="input" type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} />
                </div>
                <div className="field">
                  <label className="label">New Password</label>
                  <input className="input" type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
                </div>
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="button primary">Update Password</button>
                </div>
              </div>
            </div>

            {/* API Settings */}
            <div className="card">
              <div className="card-header">
                <span>API Settings</span>
                <span className="muted">Use header: <strong>X-Tenant-ID</strong></span>
              </div>
              <div className="card-body">
                <div className="field">
                  <label className="label">API Key</label>
                  <div className="row">
                    <input className="input" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                    <button className="button" onClick={() => copy(apiKey)}>Copy</button>
                  </div>
                </div>
                <div className="field">
                  <label className="label">Tenant ID</label>
                  <div className="row">
                    <input className="input" value={tenant} onChange={(e) => setTenant(e.target.value)} />
                    <button className="button" onClick={() => copy(tenant)}>Copy</button>
                  </div>
                  <p className="muted">All API calls must include <code>X-Tenant-ID</code> header.</p>
                </div>
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="button primary" onClick={() => setTenantId(tenant)}>Save Settings</button>
                </div>
              </div>
            </div>

            {/* Billing */}
            <div className="card">
              <div className="card-header">Billing</div>
              <div className="card-body">
                <p className="muted">Billing details and invoices will appear here.</p>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="card">
              <div className="card-header" style={{ color: "#dc2626" }}>Danger Zone</div>
              <div className="card-body">
                <p className="muted">Be careful—actions here can’t be undone.</p>
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="button danger" onClick={() => setConfirmOpen(true)} disabled={busy}>Delete Account</button>
                </div>
              </div>
            </div>
          </section>
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
                alert("Account deleted (mock). Redirecting to dashboard.");
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
    </div>
  );
}

"use client";
import React from "react";

function getTenantId(): string {
  if (typeof window === "undefined") return "4485db48-71b7-47b0-8128-c6dca5be352d";
  const stored = localStorage.getItem("tenant_id") || localStorage.getItem("tenantId");
  return stored && stored.trim().length > 0 ? stored : "4485db48-71b7-47b0-8128-c6dca5be352d";
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  headers.set("X-Tenant-ID", getTenantId());
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

type UserRow = { email: string; role: "admin" | "user" };

export default function UsersAdmin() {
  const [rows, setRows] = React.useState<UserRow[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api<UserRow[]>("/api/users");
      setRows(data);
    } catch (e: any) {
      setError(e?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const updateRole = async (email: string, role: "admin" | "user") => {
    try {
      setLoading(true);
      await api<UserRow>(`/api/users/${encodeURIComponent(email)}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      });
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to update role");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Users</h2>
        <button className="button" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {error && (
        <div className="card" style={{ marginBottom: 8 }}>
          <div className="card-body" style={{ color: "#b91c1c" }}>{error}</div>
        </div>
      )}
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "10px 12px" }}>Email</th>
                <th style={{ textAlign: "left", padding: "10px 12px" }}>Role</th>
                <th style={{ textAlign: "right", padding: "10px 12px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((r) => (
                <tr key={r.email}>
                  <td style={{ padding: "10px 12px" }}>{r.email}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span className={`pill ${r.role === 'admin' ? '' : 'pill-muted'}`}>
                      {r.role}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}>
                    <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
                      <button
                        className="button"
                        disabled={r.role === "admin" || loading}
                        onClick={() => updateRole(r.email, "admin")}
                      >
                        Make admin
                      </button>
                      <button
                        className="button"
                        disabled={r.role === "user" || loading}
                        onClick={() => updateRole(r.email, "user")}
                      >
                        Make user
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!rows?.length && (
                <tr>
                  <td colSpan={3} style={{ padding: "16px", color: "#64748b" }}>
                    {loading ? "Loading users..." : "No users found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

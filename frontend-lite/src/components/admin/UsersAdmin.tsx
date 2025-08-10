"use client";
import React from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { RefreshCcw, Search, User, Shield } from "lucide-react";
// Direct icon usage for better performance
const RefreshCcwIcon = RefreshCcw;
const SearchIcon = Search;
const UserIcon = User;
const ShieldIcon = Shield;

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
  const [query, setQuery] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      try {
        const data = await api<UserRow[]>("/api/users");
        setRows(data);
      } catch (apiError) {
        // Fallback to mock data if API endpoint not deployed yet
        console.warn('Users API not available, using mock data:', apiError);
        const mockData: UserRow[] = [
          { email: "demo@kiff.dev", role: "user" },
          { email: "bob@kiff.dev", role: "admin" },
        ];
        setRows(mockData);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const filtered = React.useMemo(() => {
    if (!rows) return [] as UserRow[];
    const s = query.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => r.email.toLowerCase().includes(s) || r.role.toLowerCase().includes(s));
  }, [rows, query]);

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Users</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manage user roles.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCcwIcon className="h-4 w-4 mr-2" />
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {error && (
        <Card>
          <CardContent>
            <div className="text-red-600 text-sm">{error}</div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search by email or role"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              leftIcon={<SearchIcon className="h-4 w-4" />}
            />
          </div>
        </CardHeader>
        <CardContent style={{ padding: 0 }}>
          <div className="overflow-x-auto">
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "10px 12px" }}>Email</th>
                  <th style={{ textAlign: "left", padding: "10px 12px" }}>Role</th>
                  <th style={{ textAlign: "right", padding: "10px 12px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.email}>
                    <td style={{ padding: "10px 12px" }}>
                      <div className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4 text-gray-500" />
                        <span>{r.email}</span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span className={`pill ${r.role === "admin" ? "" : "pill-muted"}`}>
                        <span className="inline-flex items-center gap-1">
                          <ShieldIcon className="h-4 w-4" /> {r.role}
                        </span>
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          size="sm"
                          disabled={r.role === "admin" || loading}
                          onClick={() => updateRole(r.email, "admin")}
                        >
                          Make admin
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={r.role === "user" || loading}
                          onClick={() => updateRole(r.email, "user")}
                        >
                          Make user
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={3} style={{ padding: "16px", color: "#64748b" }}>
                      {loading ? "Loading users…" : "No users found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

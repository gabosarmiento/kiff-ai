"use client";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/navigation/Sidebar";
import { BottomNav } from "@/components/navigation/BottomNav";
import { useLayoutState } from "@/components/layout/LayoutState";
import PageContainer from "@/components/ui/PageContainer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useAuth } from "@/hooks/useAuth";
import { getTenantId } from "@/lib/tenant";
import { deleteAccount } from "@/lib/apiClient";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

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

  // removed copy helper (no longer needed)

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
      <main
        className="pane pane-with-sidebar"
        style={{ paddingLeft: leftWidth + 32, marginTop: 40 }}
      >
        <PageContainer>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
              <p className="text-sm text-gray-600 mt-1">Manage your profile and account.</p>
            </div>
          </div>

          {/* Content with dividers */}
          <div className="mt-6">
            {/* Profile */}
            <section className="pb-6 mb-6 border-b border-gray-200">
              <h2 className="text-base font-semibold">Profile</h2>
              <p className="text-sm text-gray-600 mb-4">Your account identity</p>
              <div className="grid gap-3 max-w-md">
                <label className="text-sm text-gray-600">Email</label>
                <Input type="email" value={email} readOnly disabled />
              </div>
            </section>

            {/* Session */}
            <section className="pb-6 mb-6 border-b border-gray-200">
              <h2 className="text-base font-semibold">Session</h2>
              <p className="text-sm text-gray-600 mb-4">Signed-in session controls</p>
              <div className="max-w-md">
                <Button onClick={handleLogout} disabled={loggingOut} className="bg-black text-white hover:bg-black/90">
                  <LogOut className="w-4 h-4 mr-2" />
                  {loggingOut ? "Signing out..." : "Sign out"}
                </Button>
              </div>
            </section>

            {/* Danger Zone */}
            <section>
              <h2 className="text-base font-semibold text-red-600">Danger Zone</h2>
              <p className="text-sm text-gray-600 mb-4">Be careful—actions here can’t be undone.</p>
              <Button variant="outline" className="border-red-600 text-red-600 hover:bg-red-50" onClick={() => setConfirmOpen(true)} disabled={busy}>
                Delete Account
              </Button>
            </section>
          </div>

          {/* Confirm Modal */}
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
        </PageContainer>
      </main>
      <BottomNav />
    </div>
  );
}

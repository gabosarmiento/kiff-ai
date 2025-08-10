import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Let client-side handle auth to avoid server-side complexity with NextAuth
  // The ProtectedRoute component on each page will handle the admin check
  return <>{children}</>;
}

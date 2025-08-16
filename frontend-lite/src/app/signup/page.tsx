import { SignUpPage } from "../../components/auth/SignUpPage";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

const DEFAULT_TENANT_ID = "4485db48-71b7-47b0-8128-c6dca5be352d";

export default async function SignupRoute() {
  // If a session cookie is present, try to resolve the user server-side and redirect
  const cookieStore = cookies();
  const sessionName = process.env.SESSION_COOKIE_NAME || "session";
  const token = cookieStore.get(sessionName)?.value;

  if (token) {
    const tenantId = process.env.NEXT_PUBLIC_TENANT_ID || DEFAULT_TENANT_ID;
    const cookieHeader = headers().get("cookie") || "";
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || "https://nkbdpyszym.eu-west-3.awsapprunner.com";
      const res = await fetch(`${base}/api/auth/me`, {
        method: "GET",
        headers: {
          cookie: cookieHeader,
          "X-Tenant-ID": tenantId,
        } as any,
        cache: "no-store",
      });
      if (res.ok) {
        const me = (await res.json().catch(() => null)) as { role?: string } | null;
        if (me?.role === "admin") redirect("/admin/users");
        redirect("/kiffs/launcher");
      }
    } catch {
      // fall through to render signup
    }
  }

  return <SignUpPage />;
}

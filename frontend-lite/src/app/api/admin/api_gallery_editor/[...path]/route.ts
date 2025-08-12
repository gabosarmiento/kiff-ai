import { NextRequest, NextResponse } from "next/server";

// Simple proxy to backend admin API, preserving cookies and headers for auth.
// Resolve backend base URL; avoid pointing to frontend origin to prevent 404 from Next
const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://rfn5agrmiw.eu-west-3.awsapprunner.com";
const API_BASE = RAW_API_BASE.includes("localhost:3000")
  ? RAW_API_BASE.replace("3000", "8000")
  : RAW_API_BASE;

async function forward(req: NextRequest, path: string) {
  const qs = req.nextUrl.search || "";
  const url = `${API_BASE}/admin/api_gallery_editor/${path}${qs}`.replace(/\/+$/, "");
  const method = req.method;
  const headers = new Headers();
  // Forward important headers
  // Tenant header is critical; forward as-is if present
  for (const [k, v] of req.headers.entries()) {
    const lower = k.toLowerCase();
    if (lower === "x-tenant-id") headers.set("X-Tenant-ID", v);
    if (lower === "authorization") headers.set("authorization", v);
    if (lower === "content-type") headers.set("content-type", v);
  }
  // Forward cookies for session-based admin guard
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);

  let body: BodyInit | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const json = await req.json().catch(() => undefined);
      body = json ? JSON.stringify(json) : undefined;
      headers.set("Content-Type", "application/json");
    } else {
      const blob = await req.blob().catch(() => undefined as any);
      body = blob as any;
    }
  }

  const res = await fetch(url, {
    method,
    headers,
    body,
    redirect: "manual",
  });

  // Pass through response body and status
  const text = await res.text();
  const out = new NextResponse(text, { status: res.status });
  // Copy content-type and any set-cookie headers
  const ct = res.headers.get("content-type");
  if (ct) out.headers.set("content-type", ct);
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) out.headers.set("set-cookie", setCookie);
  return out;
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, (params.path || []).join("/"));
}
export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, (params.path || []).join("/"));
}
export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return forward(req, (params.path || []).join("/"));
}

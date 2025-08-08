"use client";
import React, { useMemo, useState } from "react";
import { getTenantId } from "../lib/tenant";
import { generate, getStatus, getPreview, deleteAccount } from "../lib/apiClient";
import { API_BASE_URL } from "../lib/constants";

export function ApiGallery() {
  const tenantId = getTenantId();
  const [output, setOutput] = useState<string>("Select an endpoint and click Try.");
  const [busy, setBusy] = useState<string | null>(null);

  const endpoints = useMemo(
    () => [
      {
        id: "generate",
        method: "POST",
        path: "/generate",
        description: "Start a code generation job and get a jobId back.",
        tryIt: async () => {
          const res = await generate({ prompt: "Hello, world", model: "gpt-4o" } as any);
          return res;
        },
        buildCurl: (base: string) => `curl -X POST "${base}/generate" -H "Content-Type: application/json" -H "X-Tenant-ID: ${tenantId}" -d '{"prompt":"Hello, world","model":"gpt-4o"}'`,
      },
      {
        id: "status",
        method: "GET",
        path: "/status/:jobId",
        description: "Check the status of a generation job.",
        tryIt: async () => {
          // Use a mock jobId for demo purposes
          const jobId = "demo-job";
          const res = await getStatus(jobId);
          return res;
        },
        buildCurl: (base: string) => `curl "${base}/status/<jobId>" -H "X-Tenant-ID: ${tenantId}"`,
      },
      {
        id: "preview",
        method: "GET",
        path: "/preview/:jobId",
        description: "Retrieve the live preview URL for a completed job.",
        tryIt: async () => {
          const jobId = "demo-job";
          const res = await getPreview(jobId);
          return res;
        },
        buildCurl: (base: string) => `curl "${base}/preview/<jobId>" -H "X-Tenant-ID: ${tenantId}"`,
      },
      {
        id: "deleteAccount",
        method: "DELETE",
        path: "/account",
        description: "Danger zone: delete the current tenant account (mocked).",
        tryIt: async () => {
          const res = await deleteAccount();
          return res;
        },
        buildCurl: (base: string) => `curl -X DELETE "${base}/account" -H "X-Tenant-ID: ${tenantId}"`,
      },
    ],
    [tenantId]
  );

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

  return (
    <section style={{ marginTop: 16 }}>
      <div className="card">
        <div className="card-header">
          <span>API Gallery</span>
          <span className="muted">Include header: <strong>X-Tenant-ID</strong></span>
        </div>
        <div className="card-body">
          <div className="row" style={{ alignItems: "stretch" }}>
            <div style={{ flex: 1, minWidth: 300 }}>
              {endpoints.map((e) => (
                <div key={e.id} className="card" style={{ marginBottom: 12 }}>
                  <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", marginRight: 8 }}>{e.method}</span>
                      <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{e.path}</span>
                    </div>
                    <div className="row">
                      <button className="button" onClick={() => copy(e.buildCurl(API_BASE_URL))}>Copy CURL</button>
                      <button
                        className="button primary"
                        disabled={busy === e.id}
                        onClick={async () => {
                          try {
                            setBusy(e.id);
                            const res = await e.tryIt();
                            setOutput(JSON.stringify(res, null, 2));
                          } catch (err: any) {
                            setOutput(String(err?.message || err));
                          } finally {
                            setBusy(null);
                          }
                        }}
                      >
                        {busy === e.id ? "Running…" : "Try"}
                      </button>
                    </div>
                  </div>
                  <div className="card-body">
                    <p className="muted">{e.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 300 }}>
              <div className="card" style={{ height: "100%" }}>
                <div className="card-header">Response</div>
                <div className="card-body">
                  <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto", margin: 0 }}>
{output}
                  </pre>
                </div>
              </div>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>Tip: Set X-Tenant-ID in all requests. You can configure it from Account &gt; API Settings.</p>
        </div>
      </div>
    </section>
  );
}

"use client";
import React from "react";
import { RefreshCcw, Plus, Edit, Trash, Search, Cloud } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiJson } from "@/lib/api";

// Direct icon usage for better performance
const RefreshCcwIcon = RefreshCcw;
const PlusIcon = Plus;
const EditIcon = Edit;
const TrashIcon = Trash;
const SearchIcon = Search;
const CloudIcon = Cloud;

// Backend shape per app/routes/models.py
export type Modality = "text" | "vision" | "audio" | "multimodal";
export type ModelStatus = "active" | "preview" | "deprecated";

export interface ModelItem {
  id: string; // slug
  name: string;
  provider: string;
  object?: string; // default "model"
  created?: number; // epoch
  owned_by?: string;
  active?: boolean;
  public_apps?: any | null;
  modality: Modality;
  family?: string;
  context_window?: number;
  max_output_tokens?: number;
  speed_tps?: number | null;
  price_per_million_input?: number | null;
  price_per_million_output?: number | null;
  price_per_1k_input?: number | null;
  price_per_1k_output?: number | null;
  status?: ModelStatus;
  tags?: string[];
  notes?: string;
  model_card_url?: string;
}

function fmtUsd(n?: number | null) {
  if (n == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(n);
  } catch {
    return `$${n}`;
  }
}

function isValidUrl(u: string) {
  if (!u) return true;
  try {
    new URL(u);
    return true;
  } catch {
    return false;
  }
}

export default function ModelsAdmin() {
  const [models, setModels] = React.useState<ModelItem[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

  // Form state
  const emptyModel: ModelItem = {
    id: "",
    name: "",
    provider: "",
    modality: "text",
    family: "",
    context_window: undefined,
    max_output_tokens: undefined,
    price_per_million_input: undefined,
    price_per_million_output: undefined,
    price_per_1k_input: undefined,
    price_per_1k_output: undefined,
    status: "active",
    tags: [],
    notes: "",
    model_card_url: "",
  };
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<ModelItem>({ ...emptyModel });
  const [showForm, setShowForm] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const m = await apiJson<ModelItem[]>("/api/models");
      setModels(m);
    } catch (e: any) {
      setError(e?.message || "Failed to load models");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const filtered = React.useMemo(() => {
    if (!models) return [] as ModelItem[];
    const s = query.trim().toLowerCase();
    if (!s) return models;
    return models.filter((r) =>
      r.id.toLowerCase().includes(s) ||
      (r.name || "").toLowerCase().includes(s) ||
      (r.provider || "").toLowerCase().includes(s) ||
      (r.modality || "").toLowerCase().includes(s) ||
      (r.status || "").toLowerCase().includes(s)
    );
  }, [models, query]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyModel });
    setShowForm(true);
  }

  function openEdit(m: ModelItem) {
    setEditingId(m.id);
    setForm({
      ...emptyModel,
      ...m,
      // Normalize optional numbers to undefined so inputs show empty
      context_window: m.context_window ?? undefined,
      max_output_tokens: m.max_output_tokens ?? undefined,
      speed_tps: (m.speed_tps as any) ?? undefined,
      price_per_million_input: (m.price_per_million_input as any) ?? undefined,
      price_per_million_output: (m.price_per_million_output as any) ?? undefined,
      price_per_1k_input: (m.price_per_1k_input as any) ?? undefined,
      price_per_1k_output: (m.price_per_1k_output as any) ?? undefined,
      tags: m.tags || [],
    });
    setShowForm(true);
  }

  async function saveForm(e: React.FormEvent) {
    e.preventDefault();
    // basic validation
    if (!form.id || !/^[-a-z0-9_.]+$/.test(form.id)) {
      setError("Model id requerido (slug: minusculas, numeros, -, _, .)");
      return;
    }
    if (!form.provider) {
      setError("Provider es requerido");
      return;
    }
    if (!form.name) {
      setError("Model name es requerido");
      return;
    }
    if (!isValidUrl(form.model_card_url || "")) {
      setError("Model Card URL inválido");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const payload: ModelItem = {
        ...form,
        // Coerce numeric fields
        context_window: form.context_window != null && form.context_window !== ("" as any) ? Number(form.context_window) : undefined,
        max_output_tokens: form.max_output_tokens != null && form.max_output_tokens !== ("" as any) ? Number(form.max_output_tokens) : undefined,
        speed_tps: form.speed_tps != null && form.speed_tps !== ("" as any) ? Number(form.speed_tps) : undefined,
        price_per_million_input: form.price_per_million_input != null && form.price_per_million_input !== ("" as any) ? Number(form.price_per_million_input) : undefined,
        price_per_million_output: form.price_per_million_output != null && form.price_per_million_output !== ("" as any) ? Number(form.price_per_million_output) : undefined,
        price_per_1k_input: form.price_per_1k_input != null && form.price_per_1k_input !== ("" as any) ? Number(form.price_per_1k_input) : undefined,
        price_per_1k_output: form.price_per_1k_output != null && form.price_per_1k_output !== ("" as any) ? Number(form.price_per_1k_output) : undefined,
        tags: (form.tags || []).filter(Boolean),
      };

      if (editingId) {
        await apiJson(`/api/models/${encodeURIComponent(editingId)}`, {
          method: "PUT",
          body: payload as any,
        });
      } else {
        await apiJson(`/api/models`, {
          method: "POST",
          body: payload as any,
        });
      }
      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (e: any) {
      setError(e?.message || "Error guardando el modelo");
    } finally {
      setLoading(false);
    }
  }

  async function deleteModel(id: string) {
    if (!confirm(`Delete model ${id}?`)) return;
    try {
      setLoading(true);
      setError(null);
      await apiJson(`/api/models/${encodeURIComponent(id)}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      setError(e?.message || "Error eliminando el modelo");
    } finally {
      setLoading(false);
    }
  }

  async function syncGroq() {
    try {
      setLoading(true);
      setError(null);
      setInfo(null);
      const r = await apiJson<{ ok: boolean; created: number; updated: number; total: number }>(
        "/api/models/sync/groq",
        { method: "POST" }
      );
      setInfo(`Groq Sync: created ${r.created}, updated ${r.updated}, total ${r.total}`);
      await load();
    } catch (e: any) {
      setError(e?.message || "Sync Groq failed");
    } finally {
      setLoading(false);
    }
  }

  const priceline = (m: ModelItem) => {
    const inM = fmtUsd(m.price_per_million_input ?? undefined);
    const outM = fmtUsd(m.price_per_million_output ?? undefined);
    const in1k = m.price_per_1k_input != null ? fmtUsd(m.price_per_1k_input) : "(auto)";
    const out1k = m.price_per_1k_output != null ? fmtUsd(m.price_per_1k_output) : "(auto)";
    return `${inM} /M in · ${outM} /M out · ${in1k} /1k in · ${out1k} /1k out`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Models</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Create, edit and manage available models.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={syncGroq} disabled={loading}>
            <CloudIcon className="h-4 w-4 mr-2" /> Sync Groq Models
          </Button>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCcwIcon className="h-4 w-4 mr-2" />
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
          <Button onClick={openCreate} disabled={loading}>
            <PlusIcon className="h-4 w-4 mr-2" /> New Model
          </Button>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent>
            <div className="text-red-600 text-sm whitespace-pre-wrap">{error}</div>
          </CardContent>
        </Card>
      )}
      {info && (
        <Card>
          <CardContent>
            <div className="text-slate-700 text-sm whitespace-pre-wrap">{info}</div>
          </CardContent>
        </Card>
      )}

      {/* Search & List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search by id, name, provider, modality, status"
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
                  <th style={{ textAlign: "left", padding: "10px 12px" }}>ID</th>
                  <th style={{ textAlign: "left", padding: "10px 12px" }}>Name</th>
                  <th style={{ textAlign: "left", padding: "10px 12px" }}>Provider</th>
                  <th style={{ textAlign: "left", padding: "10px 12px" }}>Modality</th>
                  <th style={{ textAlign: "left", padding: "10px 12px" }}>Status</th>
                  <th style={{ textAlign: "left", padding: "10px 12px" }}>Pricing</th>
                  <th style={{ textAlign: "right", padding: "10px 12px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td style={{ padding: "10px 12px" }}><code>{m.id}</code></td>
                    <td style={{ padding: "10px 12px" }}>{m.name}</td>
                    <td style={{ padding: "10px 12px" }}>{m.provider}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span className="pill pill-muted">{m.modality}</span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span className={`pill ${m.status === "active" ? "" : m.status === "preview" ? "pill-muted" : "pill-danger"}`}>
                        {m.status || "active"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 12, color: "#475569" }}>{priceline(m)}</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <div className="flex items-center gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => openEdit(m)} disabled={loading}>
                          <EditIcon className="h-4 w-4 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteModel(m.id)} disabled={loading}>
                          <TrashIcon className="h-4 w-4 mr-1" /> Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={7} style={{ padding: "16px", color: "#64748b" }}>
                      {loading ? "Loading models…" : "No models found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Form Drawer (simple card overlay) */}
      {showForm && (
        <div className="fixed inset-0 z-50 grid grid-cols-[1fr] place-items-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{editingId ? "Edit Model" : "New Model"}</h3>
                    <p className="text-sm text-slate-500">Fill required fields. Prices per 1k are derived if omitted.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                    <Button onClick={saveForm} disabled={loading}>{editingId ? "Save" : "Create"}</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={saveForm}>
                  {/* Identity */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Model ID (slug)</label>
                      <Input
                        value={form.id}
                        onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                        placeholder="llama-3.1-8b-instant"
                        disabled={!!editingId}
                      />
                    </div>
                    <div>
                      <label className="label">Provider</label>
                      <Input
                        value={form.provider}
                        onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
                        placeholder="groq"
                      />
                    </div>
                    <div>
                      <label className="label">Model Name</label>
                      <Input
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Llama 3.1 8B Instant"
                      />
                    </div>
                    <div>
                      <label className="label">Family</label>
                      <Input
                        value={form.family || ""}
                        onChange={(e) => setForm((f) => ({ ...f, family: e.target.value }))}
                        placeholder="Llama 3.1"
                      />
                    </div>
                  </div>

                  {/* Capabilities */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="label">Modality</label>
                      <select
                        className="input"
                        value={form.modality}
                        onChange={(e) => setForm((f) => ({ ...f, modality: e.target.value as Modality }))}
                      >
                        <option value="text">text</option>
                        <option value="vision">vision</option>
                        <option value="audio">audio</option>
                        <option value="multimodal">multimodal</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Context Window</label>
                      <Input
                        type="number"
                        value={(form.context_window as any) ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, context_window: e.target.value === "" ? undefined : Number(e.target.value) }))}
                        placeholder="131072"
                      />
                    </div>
                    <div>
                      <label className="label">Max Output Tokens</label>
                      <Input
                        type="number"
                        value={(form.max_output_tokens as any) ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, max_output_tokens: e.target.value === "" ? undefined : Number(e.target.value) }))}
                        placeholder="131072"
                      />
                    </div>
                  </div>

                  {/* Pricing */}
                  <div>
                    <div className="text-sm font-medium mb-2">Pricing (USD)</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="label">Price per Million (Input)</label>
                        <Input
                          type="number"
                          step="0.0001"
                          value={(form.price_per_million_input as any) ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, price_per_million_input: e.target.value === "" ? undefined : Number(e.target.value) }))}
                          placeholder="0.10"
                        />
                      </div>
                      <div>
                        <label className="label">Price per Million (Output)</label>
                        <Input
                          type="number"
                          step="0.0001"
                          value={(form.price_per_million_output as any) ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, price_per_million_output: e.target.value === "" ? undefined : Number(e.target.value) }))}
                          placeholder="0.50"
                        />
                      </div>
                      <div>
                        <label className="label">Price per 1k (Input)</label>
                        <Input
                          type="number"
                          step="0.0001"
                          value={(form.price_per_1k_input as any) ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, price_per_1k_input: e.target.value === "" ? undefined : Number(e.target.value) }))}
                          placeholder="(auto)"
                        />
                      </div>
                      <div>
                        <label className="label">Price per 1k (Output)</label>
                        <Input
                          type="number"
                          step="0.0001"
                          value={(form.price_per_1k_output as any) ?? ""}
                          onChange={(e) => setForm((f) => ({ ...f, price_per_1k_output: e.target.value === "" ? undefined : Number(e.target.value) }))}
                          placeholder="(auto)"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Status</label>
                      <div className="row gap-4">
                        {(["active", "preview", "deprecated"] as ModelStatus[]).map((s) => (
                          <label className="inline-flex items-center gap-2 text-sm" key={s}>
                            <input
                              type="radio"
                              name="status"
                              value={s}
                              checked={(form.status || "active") === s}
                              onChange={() => setForm((f) => ({ ...f, status: s }))}
                            />
                            <span>{s}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="label">Tags (comma separated)</label>
                      <Input
                        value={(form.tags || []).join(", ")}
                        onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) }))}
                        placeholder="groq, fast, general"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="label">Model Card URL (Hugging Face)</label>
                      <Input
                        type="url"
                        value={form.model_card_url || ""}
                        onChange={(e) => setForm((f) => ({ ...f, model_card_url: e.target.value }))}
                        placeholder="https://huggingface.co/meta-llama/Llama-3.1-8B"
                      />
                    </div>
                  </div>

                  {/* Notes at the very end, compact */}
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="label">Notes</label>
                      <textarea
                        className="input"
                        rows={2}
                        value={form.notes || ""}
                        onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="Internal notes"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                    <Button type="submit" disabled={loading}>{editingId ? "Save" : "Create"}</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

import { USE_MOCKS } from "./constants";
import { apiJson } from "./api";
import type { GenerateRequest, GenerateResponse, StatusResponse, PreviewResponse } from "./types";
import { generateMock, getPreviewMock, getStatusMock, deleteAccountMock } from "./mocks";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // Preserve mock behavior here; delegate real network to apiJson for consistent headers/tenant/credentials
  return apiJson<T>(path, {
    ...(init || {}),
    asJson: true,
  } as any);
}

export async function generate(req: GenerateRequest): Promise<GenerateResponse> {
  if (USE_MOCKS) return generateMock(req);
  return request<GenerateResponse>("/generate", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function getStatus(jobId: string): Promise<StatusResponse> {
  if (USE_MOCKS) return getStatusMock(jobId);
  return request<StatusResponse>(`/status/${encodeURIComponent(jobId)}`);
}

export async function getPreview(jobId: string): Promise<PreviewResponse> {
  if (USE_MOCKS) return getPreviewMock(jobId);
  return request<PreviewResponse>(`/preview/${encodeURIComponent(jobId)}`);
}

export async function deleteAccount(): Promise<{ ok: true }>{
  if (USE_MOCKS) return deleteAccountMock();
  return request<{ ok: true }>(`/api/auth/delete`, { method: "DELETE" });
}

// Auth types
export type Profile = { email: string; role: "admin" | "user"; tenant_id: string; has_password: boolean };
export type LoginBody = { email: string; password: string; tenant_id?: string };
export type SignupBody = { email: string; password: string; role?: "admin" | "user"; tenant_id?: string };

// Auth endpoints
export async function authLogin(body: LoginBody): Promise<Profile> {
  return request<Profile>(`/api/auth/login`, { method: "POST", body: JSON.stringify(body) });
}

export async function authSignup(body: SignupBody): Promise<Profile> {
  return request<Profile>(`/api/auth/signup`, { method: "POST", body: JSON.stringify(body) });
}

export async function authLogout(): Promise<{ ok: boolean }>{
  return request<{ ok: boolean }>(`/api/auth/logout`, { method: "POST" });
}

export async function authMe(): Promise<Profile> {
  return request<Profile>(`/api/auth/me`);
}

export async function changePassword(current_password: string, new_password: string): Promise<{ ok: true }>{
  return request<{ ok: true }>(`/api/auth/password`, {
    method: "POST",
    body: JSON.stringify({ current_password, new_password }),
  });
}

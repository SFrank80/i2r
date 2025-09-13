// FILE: web/src/api/incidents.ts
// Small API client used by the Incident form. Exports API_BASE so UI can reuse it.

export const API_BASE: string = (import.meta as ImportMeta)?.env?.VITE_API_BASE ?? "http://localhost:5050";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type IncidentStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export interface Incident {
  id: number;
  title: string;
  description?: string | null;
  priority: Priority;
  status: IncidentStatus;
  assetId?: number | null;
  lon: number;
  lat: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListQuery {
  q?: string;
  status?: IncidentStatus[];
  priority?: Priority[];
  assetId?: number;
  page?: number;
  pageSize?: number;
  [key: string]: unknown;
}

function q(params: Record<string, unknown>): string {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    if (Array.isArray(v)) u.set(k, v.join(","));
    else u.set(k, String(v));
  });
  const s = u.toString();
  return s ? `?${s}` : "";
}

async function j<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function listIncidents(params: ListQuery) {
  return j<{ page: number; pageSize: number; total: number; items: Incident[] }>(
    `/incidents${q(params)}`
  );
}

export async function createIncident(input: Partial<Incident>) {
  return j<Incident>(`/incidents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateIncident(id: number, patch: Partial<Incident>) {
  return j<Incident>(`/incidents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export async function exportIncidentsCsv(params: ListQuery): Promise<Blob> {
  const res = await fetch(`${API_BASE}/incidents/export.csv${q(params)}`, {
    headers: { Accept: "text/csv" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

// FILE: web/src/api/incidents.ts
export type Incident = {
  id: number;
  title: string;
  description?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  reporterId: number;
  assetId?: number | null;
  lon: number;
  lat: number;
  createdAt: string;
  updatedAt: string;
};

export type Paged<T> = { page: number; pageSize: number; total: number; items: T[] };
const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:5050";

export async function listIncidents(params: { page?: number; pageSize?: number; q?: string } = {}): Promise<Paged<Incident>> {
  const url = new URL(`${BASE}/incidents`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).length) url.searchParams.set(k, String(v));
  });
  const r = await fetch(url.toString());
  if (!r.ok) throw new Error("failed");
  return r.json();
}

export async function updateIncident(id: number, patch: Partial<Incident>) {
  const r = await fetch(`${BASE}/incidents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-user-role": "DISPATCHER" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error("update failed");
  return r.json();
}

export async function createIncident(body: {
  title: string;
  description?: string;
  priority: Incident["priority"];
  status: Incident["status"];
  lon: number;
  lat: number;
}) {
  const r = await fetch(`${BASE}/incidents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-role": "DISPATCHER" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("create failed");
  return r.json();
}

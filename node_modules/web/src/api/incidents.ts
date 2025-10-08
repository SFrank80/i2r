// FILE: web/src/api/incidents.ts
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type IncidentStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export type Incident = {
  id: number;
  title: string;
  description: string | null;
  priority: Priority;
  status: IncidentStatus;
  assetId: number | null;
  lon: number | null;
  lat: number | null;
  createdAt: string; // ISO
};

const API_URL =
  (import.meta as ImportMeta).env?.VITE_API_URL || "http://localhost:5050";

/* ------------------------------- LIST ------------------------------- */
export async function listIncidents(opts: {
  q?: string;
  page?: number;
  pageSize?: number;
  assetId?: number;
}): Promise<{ total: number; items: Incident[] }> {
  const p = new URLSearchParams();
  if (opts.q) p.set("q", opts.q);
  if (opts.assetId) p.set("assetId", String(opts.assetId));
  p.set("page", String(opts.page ?? 1));
  p.set("pageSize", String(opts.pageSize ?? 10));

  const r = await fetch(`${API_URL}/incidents?${p.toString()}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/* ------------------------------ CREATE ------------------------------ */
export async function createIncident(body: {
  title: string;
  description?: string;
  priority: Priority;
  status: IncidentStatus;
  lon?: number | null;
  lat?: number | null;
  assetId?: number;
}): Promise<{ ok: boolean }> {
  const r = await fetch(`${API_URL}/incidents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/* ------------------------------ UPDATE ------------------------------ */
/** Allow description here so the modal can append notes */
export async function updateIncident(
  id: number,
  body: Partial<Pick<Incident, "status" | "assetId" | "description">>
): Promise<{ ok: boolean }> {
  const r = await fetch(`${API_URL}/incidents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/* ------------------------------ EXPORT ------------------------------ */
export async function exportIncidentsCsv(opts: {
  q?: string;
  assetId?: number;
}): Promise<Blob> {
  const p = new URLSearchParams();
  if (opts.q) p.set("q", opts.q);
  if (opts.assetId) p.set("assetId", String(opts.assetId));
  const r = await fetch(`${API_URL}/incidents/export.csv?${p.toString()}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.blob();
}

/* ------------------------------ ML ---------------------------------- */
export async function classify(text: {
  title: string;
  description: string;
}): Promise<{ priority: Priority; confidence?: number; inferredType?: string }> {
  const r = await fetch(`${API_URL}/ml/classify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(text),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function mlFeedback(payload: {
  action: "accept" | "override";
  suggested: { priority: Priority };
  final: { priority: Priority };
}) {
  try {
    await fetch(`${API_URL}/ml/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    /* ignore */
  }
}

/* ------------------------------ GEO --------------------------------- */
export async function geocode(q: string): Promise<{
  ok: boolean;
  lat?: number;
  lon?: number;
  label?: string;
}> {
  const r = await fetch(`${API_URL}/geo/geocode?q=${encodeURIComponent(q)}`);
  if (!r.ok) return { ok: false };
  return r.json();
}

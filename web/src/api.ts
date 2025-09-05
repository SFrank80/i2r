// web/src/api.ts
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5050";

/* =========================
 * Types
 * =======================*/

export type IncidentStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type Incident = {
  id: number;
  title: string;
  description?: string;
  priority: Priority;
  status: IncidentStatus;
  reporterId: number;
  assetId?: number | null;
  lon: number;
  lat: number;
  createdAt: string;
  updatedAt: string;
};

export type Paged<T> = {
  page: number;
  pageSize: number;
  total: number;
  items: T[];
};

export type ListIncidentsParams = {
  /** 1-based page index (default handled by API) */
  page?: number;
  /** page size (default handled by API) */
  pageSize?: number;
  /** pass "All" to omit the filter */
  priority?: Priority | "All";
  /** pass "All" to omit the filter */
  status?: IncidentStatus | "All";
  /** free text search (server expects `q`) */
  search?: string;
};

/* =========================
 * Small helpers
 * =======================*/

/** Role header for demo RBAC. Change as needed in your UI. */
export type UserRole = "ADMIN" | "DISPATCHER" | "FIELDTECH" | "VIEWER";

export function makeHeaders(role: UserRole = "DISPATCHER", extra?: HeadersInit): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-user-role": role,
    ...(extra ?? {}),
  };
}

/** Generic JSON request with tiny timeout + error extraction. */
async function request<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? 12000);

  try {
    const res = await fetch(`${BASE}${path}`, { ...init, signal: controller.signal });
    if (!res.ok) {
      // try to surface a useful error message from the API
      let msg = `HTTP ${res.status}`;
      try {
        const data = await res.json();
        msg = typeof data?.message === "string" ? data.message : JSON.stringify(data);
      } catch {
        /* ignore parse errors */
      }
      throw new Error(msg);
    }
    // health endpoint returns text; others return JSON
    const ct = res.headers.get("content-type") || "";
    return (ct.includes("application/json") ? res.json() : res.text()) as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

/* =========================
 * Public API
 * =======================*/

export async function getHealth() {
  // returns plain text "ok"
  return request<string>("/health");
}

/**
 * List incidents with optional filters + pagination.
 * - Omits "All" filters so the server doesn’t filter by that field
 * - Uses `q` for the free-text search (maps to `search` in your UI)
 */
export async function listIncidents(
  params: ListIncidentsParams = {},
  role: UserRole = "DISPATCHER"
): Promise<Paged<Incident>> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.priority && params.priority !== "All") qs.set("priority", params.priority);
  if (params.status && params.status !== "All") qs.set("status", params.status);
  if (params.search?.trim()) qs.set("q", params.search.trim());

  const query = qs.toString();
  return request<Paged<Incident>>(`/incidents${query ? `?${query}` : ""}`, {
    headers: makeHeaders(role),
  });
}

export type CreateIncidentDTO = {
  title: string;
  lon: number;
  lat: number;
  description?: string;
  assetId?: number;
  priority?: Priority;      // defaults server-side if omitted
  reporterId?: number;      // optional; server can derive/ignore for demo
};

export async function createIncident(
  data: CreateIncidentDTO,
  role: UserRole = "DISPATCHER"
): Promise<Incident> {
  return request<Incident>("/incidents", {
    method: "POST",
    headers: makeHeaders(role),
    body: JSON.stringify(data),
  });
}

/* =========================
 * (Optional) extras you might use soon
 * =======================*/

// Get single incident
export async function getIncident(id: number, role: UserRole = "DISPATCHER") {
  return request<Incident>(`/incidents/${id}`, { headers: makeHeaders(role) });
}

// Patch an incident (e.g., status, priority, description, assignment, etc.)
export async function updateIncident(
  id: number,
  patch: Partial<Pick<Incident, "title" | "description" | "priority" | "status" | "assetId" | "lon" | "lat">>,
  role: UserRole = "DISPATCHER"
) {
  return request<Incident>(`/incidents/${id}`, {
    method: "PATCH",
    headers: makeHeaders(role),
    body: JSON.stringify(patch),
  });
}

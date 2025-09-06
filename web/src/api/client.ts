// FILE: web/src/api/client.ts
// Keeps browser → API calls in one place.


export const BASE = import.meta.env.VITE_API_BASE || "http://localhost:5050";


export type Paged<T> = {
page: number;
pageSize: number;
total: number;
items: T[];
};


export async function http<T>(path: string, init?: RequestInit): Promise<T> {
const res = await fetch(`${BASE}${path}`, init);
if (!res.ok) {
const txt = await res.text().catch(() => "");
throw new Error(`HTTP ${res.status} on ${path}: ${txt}`);
}
return res.json();
}
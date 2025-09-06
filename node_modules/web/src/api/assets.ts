// FILE: web/src/api/assets.ts
import { http, type Paged } from "./client";


export type Asset = {
id: number;
name: string;
type: string;
status?: string; // tolerated if present in DB
lon?: number | null;
lat?: number | null;
createdAt: string;
updatedAt: string;
};


export async function listAssets(params: { q?: string; page?: number; pageSize?: number } = {}): Promise<Paged<Asset>> {
const usp = new URLSearchParams();
for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && String(v).length) usp.set(k, String(v));
return http(`/assets${usp.size ? `?${usp.toString()}` : ""}`);
}
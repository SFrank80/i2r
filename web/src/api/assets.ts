// FILE: web/src/api/assets.ts
import { http, type Paged } from "./client";

export type Asset = {
  id: number;
  name: string;
  type?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type ListParams = {
  q?: string;
  page?: number;
  pageSize?: number;
};

export async function listAssets(params: ListParams = {}): Promise<Paged<Asset>> {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || String(v).length === 0) continue;
    usp.set(k, String(v));
  }
  return http(`/assets${usp.size ? `?${usp.toString()}` : ""}`);
}

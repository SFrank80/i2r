// api/src/gis/arcgis.js
import fetch from "node-fetch";

const PORTAL = process.env.ARCGIS_PORTAL || "https://www.arcgis.com";
const INC_URL = process.env.ARCGIS_INCIDENTS_URL;
const ASSET_URL = process.env.ARCGIS_ASSETS_URL;
const CID = process.env.ARCGIS_CLIENT_ID;
const CSECRET = process.env.ARCGIS_CLIENT_SECRET;

async function getToken() {
  const res = await fetch(`${PORTAL}/sharing/rest/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CID,
      client_secret: CSECRET,
      grant_type: "client_credentials",
      expiration: "120",
      f: "json",
    }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error(j.error?.message || "token_failed");
  return j.access_token;
}

function toPoint({ lon, lat }) {
  if (lon == null || lat == null) return null;
  return { x: Number(lon), y: Number(lat), spatialReference: { wkid: 4326 } };
}

// Single applyEdits call
async function applyEdits(layerUrl, edits) {
  const token = await getToken();
  const res = await fetch(`${layerUrl}/applyEdits`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      f: "json",
      token,
      adds: JSON.stringify(edits.adds ?? []),
      updates: JSON.stringify(edits.updates ?? []),
      deletes: edits.deletes?.join(",") ?? "",
      rollbackOnFailure: "true",
    }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message);
  return j;
}

// Public helpers your routes can call
export async function pushIncidentAdd(row) {
  const geometry = toPoint(row);
  const attributes = {
    id: row.id,
    title: row.title ?? "",
    description: row.description ?? "",
    priority: row.priority,
    status: row.status,
    assetId: row.assetId ?? null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  return applyEdits(INC_URL, { adds: [{ geometry, attributes }] });
}

export async function pushIncidentUpdate(row) {
  const geometry = toPoint(row);
  const attributes = {
    id: row.id,
    title: row.title ?? "",
    description: row.description ?? "",
    priority: row.priority,
    status: row.status,
    assetId: row.assetId ?? null,
    updatedAt: Date.now(),
  };
  return applyEdits(INC_URL, { updates: [{ geometry, attributes }] });
}

export async function pushAssetUpsert(row) {
  const geometry = toPoint(row);
  const attributes = {
    id: row.id, name: row.name ?? "", type: row.type ?? "",
    updatedAt: Date.now(),
  };
  // Using updates with upsert-like behavior: add if not found
  return applyEdits(ASSET_URL, { updates: [{ geometry, attributes }] });
}

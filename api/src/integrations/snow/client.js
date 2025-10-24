// Lightweight ServiceNow Table API client (uses native fetch)
const { SN_INSTANCE_URL, SN_USER, SN_PASS, SN_TABLE } = process.env;

function requireEnv() {
  if (!SN_INSTANCE_URL || !SN_USER || !SN_PASS) {
    throw new Error("ServiceNow env missing (SN_INSTANCE_URL, SN_USER, SN_PASS)");
  }
}

function authHeader() {
  const token = Buffer.from(`${SN_USER}:${SN_PASS}`).toString("base64");
  return `Basic ${token}`;
}

function baseUrl() {
  const url = SN_INSTANCE_URL?.replace(/\/+$/, "");
  return `${url}/api/now/table`;
}

export async function snCreate(fields, tableName = SN_TABLE || "incident") {
  requireEnv();
  const r = await fetch(`${baseUrl()}/${encodeURIComponent(tableName)}`, {
    method: "POST",
    headers: {
      "Authorization": authHeader(),
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(fields),
  });
  if (!r.ok) throw new Error(`ServiceNow create failed: HTTP ${r.status}`);
  const json = await r.json();
  return json?.result;
}

export async function snUpdate(sysId, fields, tableName = SN_TABLE || "incident") {
  requireEnv();
  const r = await fetch(`${baseUrl()}/${encodeURIComponent(tableName)}/${encodeURIComponent(sysId)}`, {
    method: "PATCH",
    headers: {
      "Authorization": authHeader(),
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(fields),
  });
  if (!r.ok) throw new Error(`ServiceNow update failed: HTTP ${r.status}`);
  const json = await r.json();
  return json?.result;
}

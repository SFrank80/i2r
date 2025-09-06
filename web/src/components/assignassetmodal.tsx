// FILE: web/src/components/assignassetmodal.tsx
import { useEffect, useMemo, useState, type CSSProperties } from "react";
// Update the import paths to match the actual file location and casing
import { listAssets } from "../api/assets";
import type { Asset } from "../api/assets";

export type AssignAssetModalProps = {
  open: boolean;
  incidentId: number;
  currentAssetId?: number | null;
  onAssign: (assetId: number | null) => Promise<void> | void;
  onClose: () => void;
};

export default function AssignAssetModal({ open, incidentId, currentAssetId, onAssign, onClose }: AssignAssetModalProps) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [items, setItems] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const showing = useMemo(() => {
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);
    return { from, to };
  }, [page, pageSize, total]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = (await listAssets({ q, page, pageSize })) as { items: Asset[]; total: number };
        if (!cancelled) { setItems(res.items); setTotal(res.total); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, q, page, pageSize]);

  if (!open) return null;

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={rowBetween}>
          <h3 style={{ margin: 0 }}>Assign asset (Incident #{incidentId})</h3>
          <button style={btn} onClick={onClose}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
          <div>
            <label style={muted}>Search</label>
            <input style={input} placeholder="name/type…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
          </div>
          <div>
            <label style={muted}>Page size</label>
            <select style={input} value={pageSize} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}>
              {[5, 10, 20].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <div style={{ ...muted, marginBottom: 8 }}>Showing {showing.from}–{showing.to} of {total} assets</div>

        <div style={{ maxHeight: 320, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>ID</th>
                <th style={th}>Name</th>
                <th style={th}>Type</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td style={td} colSpan={4}>Loading…</td></tr>}
              {!loading && items.length === 0 && <tr><td style={td} colSpan={4}>No assets</td></tr>}
              {!loading && items.map((a) => (
                <tr key={a.id}>
                  <td style={td}>{a.id}</td>
                  <td style={td}>{a.name}</td>
                  <td style={td}>{a.type}</td>
                  <td style={td}><button style={btn} onClick={async () => { await onAssign(a.id); onClose(); }}>Assign</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <button style={btn} disabled={page === 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>◀ Prev</button>
          <span>Page {page}</span>
          <button style={btn} disabled={page * pageSize >= total || loading} onClick={() => setPage((p) => p + 1)}>Next ▶</button>
          <div style={{ marginLeft: "auto" }}>
            {currentAssetId ? (
              <button style={btn} onClick={async () => { await onAssign(null); onClose(); }}>Unassign current ({currentAssetId})</button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

const overlay: CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,.25)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 };
const modal: CSSProperties = { background: "#fff", width: "min(900px,96vw)", padding: 16, borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,.12)" };
const rowBetween: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 };
const input: CSSProperties = { padding: 6, borderRadius: 8, border: "1px solid #ddd" };
const btn: CSSProperties = { padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", background: "#f9fafb", cursor: "pointer" };
const th: CSSProperties = { textAlign: "left", padding: 8, borderBottom: "1px solid #eee" };
const td: CSSProperties = { padding: 8, borderBottom: "1px solid #f2f2f2" };
const muted: CSSProperties = { color: "#6b7280", fontSize: 12 };

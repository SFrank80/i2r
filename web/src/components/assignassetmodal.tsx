// FILE: web/src/components/assignassetmodal.tsx
import { useEffect, useMemo, useState } from "react";

type Asset = { id: number; name: string; type?: string };

interface Props {
  open: boolean;
  incidentId: number;
  currentAssetId: number | null;
  onClose: () => void;
  onAssign: (assetId: number | null) => Promise<void> | void;
}

const API =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5050";

export default function AssignAssetModal({
  open,
  incidentId,
  currentAssetId,
  onClose,
  onAssign,
}: Props) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<string>("");

  // keep local selection in sync when modal opens
  useEffect(() => {
    if (!open) return;
    setSelected(currentAssetId == null ? "" : String(currentAssetId));
  }, [open, currentAssetId]);

  // fetch assets only when the modal opens
  useEffect(() => {
    if (!open) return;
    (async () => {
      const res = await fetch(`${API}/assets?page=1&pageSize=200`);
      const data = await res.json();
      setAssets(Array.isArray(data?.items) ? data.items : []);
    })();
  }, [open]);

  const title = useMemo(
    () => `Assign asset to incident #${incidentId}`,
    [incidentId],
  );

  if (!open) return null;

  return (
    <div style={backdrop} onClick={onClose} aria-modal="true" role="dialog">
      <div style={card} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, marginBottom: 12 }}>{title}</h3>

        <label htmlFor="asset-select" style={{ display: "block", marginBottom: 6 }}>
          Asset
        </label>
        <select
          id="asset-select"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={select}
        >
          <option value="">— No asset —</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              #{a.id} • {a.name}{a.type ? ` (${a.type})` : ""}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" onClick={onClose} style={btnSecondary}>
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              const assetId = selected ? Number(selected) : null;
              await onAssign(assetId);
            }}
            style={btnPrimary}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- inline styles (kept minimal & self-contained) ---------- */
const backdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const card: React.CSSProperties = {
  width: 420,
  maxWidth: "90vw",
  background: "#111827",
  color: "#e5e7eb",
  border: "1px solid #374151",
  borderRadius: 12,
  boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
  padding: 16,
};

const select: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #374151",
  background: "#0b1220",
  color: "#e5e7eb",
};

const btnPrimary: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #d97706",
  background: "#f59e0b",
  color: "#111",
  fontWeight: 700,
  cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #374151",
  background: "#1f2937",
  color: "#e5e7eb",
  cursor: "pointer",
};

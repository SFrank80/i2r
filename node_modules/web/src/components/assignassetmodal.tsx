// FILE: web/src/components/assignassetmodal.tsx
import { useEffect, useMemo, useState } from "react";

type Props = {
  open?: boolean;          // supported
  isOpen?: boolean;        // also supported
  incidentId: number;
  currentAssetId: number | null;
  onAssign: (assetId: number | null) => void | Promise<void>;
  onClose: () => void;
};

type Asset = { id: number; name: string };

const API_URL = (import.meta as ImportMeta).env?.VITE_API_URL || "http://localhost:5050";

export default function AssignAssetModal(props: Props) {
  const show = props.open ?? props.isOpen ?? false;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<number | "none">(props.currentAssetId ?? "none");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { setSelected(props.currentAssetId ?? "none"); }, [props.currentAssetId]);
  const { onClose } = props;
  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    fetch(`${API_URL}/assets`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const list = await r.json();
        if (!cancelled) setAssets(list as Asset[]);
      })
      .catch((e) => !cancelled && setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onEsc);
    return () => { cancelled = true; window.removeEventListener("keydown", onEsc); };
  }, [show, onClose]);

  const canSave = useMemo(() => !loading, [loading]);

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}
    >
      <div className="md-card" style={{ maxWidth: 520, width: "92%", boxShadow: "0 10px 30px rgba(0,0,0,.35)" }}>
        <div className="md-header">
          <h3 className="md-title">Assign asset</h3>
        </div>
        <div className="md-content">
          {err && <div className="muted" style={{ color: "var(--danger)" }}>{err}</div>}
          <div className="md-field">
            <label htmlFor="assetSelect">Choose asset</label>
            <select
              id="assetSelect"
              className="md-select"
              value={selected === "none" ? "" : String(selected)}
              onChange={(e) => {
                const v = e.target.value;
                setSelected(v ? Number(v) : "none");
              }}
              disabled={loading}
            >
              <option value="">— no asset —</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>{a.id} · {a.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="md-actions" style={{ gap: 8, padding: 12 }}>
          <button className="btn" onClick={props.onClose}>Cancel</button>
          <button
            className="btn-primary"
            disabled={!canSave}
            onClick={() => props.onAssign(selected === "none" ? null : Number(selected))}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

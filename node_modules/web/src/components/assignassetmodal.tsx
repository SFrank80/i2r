import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  incidentId: number;
  currentAssetId: number | null | undefined;
  onClose: () => void;
  onAssign: (newAssetId: number | null) => Promise<void> | void;
};

type AssetOpt = { id: number; label: string };

export default function AssignAssetModal({
  open,
  incidentId,
  currentAssetId,
  onClose,
  onAssign,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<AssetOpt[]>([]);
  const [sel, setSel] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setAssets([]);
    setSel(currentAssetId ? String(currentAssetId) : "");
    fetch("/assets")
      .then((r) => r.json())
      .then((data) => setAssets(data.items || []))
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  }, [open, currentAssetId]);

  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3 className="md-title">Assign asset to incident #{incidentId}</h3>

        <div className="md-field">
          <label>Asset</label>
          <select
            className="md-select"
            value={sel}
            onChange={(e) => setSel(e.target.value)}
            disabled={loading}
          >
            <option value="">— No asset —</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
          {loading && <div className="muted" style={{ marginTop: 6 }}>Loading assets…</div>}
          {!loading && assets.length === 0 && (
            <div className="muted" style={{ marginTop: 6 }}>
              No assets found (seed may be empty).
            </div>
          )}
        </div>

        <div className="md-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary"
            onClick={() => onAssign(sel ? Number(sel) : null)}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// FILE: web/src/components/incidentdetailsmodal.tsx
import { useMemo, useState } from "react";
import type { Incident } from "../api/incidents";
import { updateIncident } from "../api/incidents";

type Props = {
  open: boolean;
  incident: Incident | null;
  onClose: () => void;
  onSaved: () => void;
  onCenterOnMap?: (lat: number, lon: number, sticky?: boolean) => void;
};

export default function IncidentDetailsModal({
  open,
  incident,
  onClose,
  onSaved,
  onCenterOnMap,
}: Props) {
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const canCenter = useMemo(
    () => !!(incident && incident.lat != null && incident.lon != null),
    [incident]
  );

  if (!open || !incident) return null;

  const { id, title, description, priority, status, assetId, lat, lon, createdAt } = incident;

  const osmUrl =
    lat != null && lon != null
      ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`
      : undefined;

  async function appendNote() {
    const trimmed = note.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      const stamp = new Date().toLocaleString();
      const newDescription = `${description ? description + "\n\n" : ""}[${stamp}] ${trimmed}`;
      // updateIncident type already allows "description" in this project file
      await updateIncident(id, { description: newDescription });
      setNote("");
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card md-card"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 720, maxWidth: "95vw" }}
      >
        <div className="md-header">
          <h3 className="md-title">Incident #{id}</h3>
          <button className="btn" onClick={onClose}>Close</button>
        </div>

        <div className="md-content" style={{ maxHeight: "70vh", overflow: "auto" }}>
          <div className="md-grid cols-2">
            <div className="md-field" style={{ gridColumn: "1 / -1" }}>
              <label>Title</label>
              <div className="md-readonly">{title}</div>
            </div>

            <div className="md-field">
              <label>Priority</label>
              <div className="md-readonly">{priority}</div>
            </div>
            <div className="md-field">
              <label>Status</label>
              <div className="md-readonly">{status.replace("_", " ")}</div>
            </div>

            <div className="md-field">
              <label>Asset</label>
              <div className="md-readonly">{assetId ?? "—"}</div>
            </div>

            <div className="md-field">
              <label>Created</label>
              <div className="md-readonly">
                {createdAt ? new Date(createdAt).toLocaleString() : "—"}
              </div>
            </div>

            <div className="md-field">
              <label>Location</label>
              <div className="md-readonly">
                {lat != null && lon != null ? `${(+lat).toFixed(6)}, ${(+lon).toFixed(6)}` : "—"}
              </div>
              <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
                {canCenter && onCenterOnMap && (
                  <button
                    className="btn"
                    onClick={() => onCenterOnMap(lat as number, lon as number, true)}
                  >
                    Center on Operations Map
                  </button>
                )}
                {osmUrl && (
                  <a className="btn" href={osmUrl} target="_blank" rel="noreferrer">
                    View in OpenStreetMap
                  </a>
                )}
              </div>
            </div>

            <div className="md-field" style={{ gridColumn: "1 / -1" }}>
              <label>Description (current)</label>
              <div className="md-textarea md-readonly" style={{ whiteSpace: "pre-wrap" }}>
                {description || "—"}
              </div>
            </div>

            <div className="md-field" style={{ gridColumn: "1 / -1" }}>
              <label>Add a note</label>
              <textarea
                className="md-textarea"
                rows={3}
                placeholder="Append a quick update…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="md-actions" style={{ marginTop: 8 }}>
                <button className="btn" onClick={onClose}>Cancel</button>
                <button className="btn-primary" disabled={saving || !note.trim()} onClick={appendNote}>
                  {saving ? "Saving…" : "Save note"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Keep the overlay styles here so we don't need to touch global CSS */}
      <style>{`
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.45);
          display: flex; align-items: center; justify-content: center; z-index: 60;
        }
        .modal-card { background: var(--bg); border-radius: 12px; }
      `}</style>
    </div>
  );
}

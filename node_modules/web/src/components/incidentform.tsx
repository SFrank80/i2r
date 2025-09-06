// FILE: web/src/incidentform.tsx
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import AssignAssetModal from "./assignassetmodal";
import { listIncidents, updateIncident, createIncident } from "../api/incidents";
import type { Incident } from "../api/incidents";
import { Toaster, toast } from "react-hot-toast";

// Local enums for UI
export type IncidentStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
const STATUSES: IncidentStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

function toNum(v: string): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function IncidentFormPage() {
  // list
  const [items, setItems] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);

  // assign modal
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<{ id: number; assetId: number | null } | null>(null);

  // create form
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [status, setStatus] = useState<IncidentStatus>("OPEN");
  const [lon, setLon] = useState("");
  const [lat, setLat] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res: { items: Incident[] } = await listIncidents({ page: 1, pageSize: 20 });
        setItems(res.items ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function openAssign(it: Incident) {
    setAssignFor({ id: it.id, assetId: it.assetId ?? null });
    setAssignOpen(true);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const lonNum = toNum(lon);
    const latNum = toNum(lat);
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (lonNum === null || latNum === null) {
      toast.error("Longitude/Latitude must be valid numbers");
      return;
    }

    try {
      const created = await createIncident({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        status,
        lon: lonNum,
        lat: latNum,
      });

      setItems((prev) => [{ ...created, assetId: created.assetId ?? null }, ...prev]);
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      setStatus("OPEN");
      setLon("");
      setLat("");
      toast.success("Incident created");
    } catch {
      toast.error("Failed to create incident");
    }
  }

  return (
    <div className="md-page">
      <div className="md-container">
        <header className="md-header">
          <h2>Incidents</h2>
        </header>

        {/* Create Incident (TOP) */}
        <div className="md-card" style={{ marginBottom: 16 }}>
          <h3 className="md-sectionTitle">Create Incident</h3>
          <form className="md-grid" onSubmit={handleCreate}>
            <label className="md-field">
              <span className="md-label">Title</span>
              <input
                className="md-input"
                value={title}
                required
                placeholder="Short incident title"
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>

            <label className="md-field">
              <span className="md-label">Priority</span>
              <select
                className="md-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>

            <label className="md-field">
              <span className="md-label">Status</span>
              <select
                className="md-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as IncidentStatus)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="md-field">
              <span className="md-label">Longitude</span>
              <input
                className="md-input"
                value={lon}
                required
                placeholder="-76.6122"
                onChange={(e) => setLon(e.target.value)}
              />
            </label>

            <label className="md-field">
              <span className="md-label">Latitude</span>
              <input
                className="md-input"
                value={lat}
                required
                placeholder="39.2904"
                onChange={(e) => setLat(e.target.value)}
              />
            </label>

            <label className="md-field md-wide">
              <span className="md-label">Description</span>
              <textarea
                className="md-input"
                rows={2}
                placeholder="Optional details…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <div className="md-rowRight">
              <button type="submit" className="md-btn md-btn-primary">
                Create incident
              </button>
            </div>
          </form>
        </div>

        {/* Table */}
        <div className="md-card">
          <div className="md-tableWrap">
            <table className="md-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Asset</th>
                  <th className="md-actionsCol">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6}>Loading…</td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={6}>No incidents</td>
                  </tr>
                )}
                {!loading &&
                  items.map((it) => (
                    <tr key={it.id}>
                      <td>{it.id}</td>
                      <td>{it.title}</td>
                      <td>
                        <span className={`md-badge md-${it.priority.toLowerCase()}`}>{it.priority}</span>
                      </td>
                      <td>
                        <select
                          className="md-select"
                          value={it.status}
                          onChange={async (e: ChangeEvent<HTMLSelectElement>) => {
                            const s = e.target.value as IncidentStatus;
                            try {
                              await updateIncident(it.id, { status: s } as Partial<Incident>);
                              setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, status: s } : x)));
                              toast.success("Status updated");
                            } catch {
                              toast.error("Update failed");
                            }
                          }}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>{it.assetId ?? "-"}</td>
                      <td className="md-actionsCol">
                        <button className="md-btn md-btn-outline" onClick={() => openAssign(it)}>
                          Assign asset
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <AssignAssetModal
          open={assignOpen}
          incidentId={assignFor?.id ?? 0}
          currentAssetId={assignFor?.assetId ?? null}
          onClose={() => setAssignOpen(false)}
          onAssign={async (assetId: number | null) => {
            if (!assignFor) return;
            try {
              await updateIncident(assignFor.id, { assetId } as Partial<Incident>);
              setItems((prev) => prev.map((x) => (x.id === assignFor.id ? { ...x, assetId: assetId ?? null } : x)));
              toast.success(assetId ? `Assigned #${assetId}` : "Asset unassigned");
            } catch {
              toast.error("Failed to assign");
            }
          }}
        />
      </div>
      <Toaster position="top-right" />
    </div>
  );
}

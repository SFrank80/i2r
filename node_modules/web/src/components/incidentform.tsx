// FILE: web/src/incidentform.tsx
import { useEffect, useMemo, useState, useCallback } from "react";
import AssignAssetModal from "./assignassetmodal";
import { listIncidents, updateIncident, createIncident, type Incident } from "../api/incidents";

export default function IncidentForm() {
  // ------- Create form state -------
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Incident["priority"]>("MEDIUM");
  const [status, setStatus] = useState<Incident["status"]>("OPEN");
  const [lon, setLon] = useState(-76.6122);
  const [lat, setLat] = useState(39.2904);

  // ------- List state -------
  const [items, setItems] = useState<Incident[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const pages = useMemo(
    () => Math.max(1, Math.ceil(total / Math.max(pageSize, 1))),
    [total, pageSize]
  );

  // ------- Assign modal -------
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<{ id: number; assetId: number | null } | null>(null);
  function openAssign(it: Incident) {
    setAssignFor({ id: it.id, assetId: it.assetId ?? null });
    setAssignOpen(true);
  }

  // ------- Load helpers -------

  const reload = useCallback(async () => {
    const res = await listIncidents({ page, pageSize });
    setItems(res.items);
    setTotal(res.total);
  }, [page, pageSize]);

  useEffect(() => { void reload(); }, [reload]);

  // ------- Create handler -------
  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) return;
    await createIncident({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      status,
      lon: Number(lon),
      lat: Number(lat),
    });
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setStatus("OPEN");
    await reload(); // keep UI in sync
  }

  // ------- Render -------
  return (
    <div className="md-page">
      {/* (No top H1 — removed per request) */}

      {/* Create card */}
      <div className="md-card">
        <div className="md-header">
          <h2 className="md-title">Create Incident</h2>
          {/* actions placeholder if needed later */}
        </div>

        <form onSubmit={onCreate} className="md-grid cols-2">
          <div className="md-field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="title">Title</label>
            <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short incident title" />
          </div>

          <div className="md-field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="desc">Description</label>
            <textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details…" />
          </div>

          <div className="md-field">
            <label htmlFor="priority">Priority</label>
            <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value as Incident["priority"])}>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>

          <div className="md-field">
            <label htmlFor="status">Status</label>
            <select id="status" value={status} onChange={(e) => setStatus(e.target.value as Incident["status"])}>
              <option value="OPEN">OPEN</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </div>

          <div className="md-field">
            <label htmlFor="lon">Longitude</label>
            <input id="lon" type="number" step="0.0001" value={lon} onChange={(e) => setLon(Number(e.target.value))} />
          </div>
          <div className="md-field">
            <label htmlFor="lat">Latitude</label>
            <input id="lat" type="number" step="0.0001" value={lat} onChange={(e) => setLat(Number(e.target.value))} />
          </div>

          <div className="md-actions" style={{ gridColumn: "1 / -1" }}>
            <button className="btn btn-primary" type="submit">Create incident</button>
            <button className="btn" type="button" onClick={() => void reload()}>Refresh</button>
          </div>
        </form>
      </div>

      {/* Incidents card */}
      <div className="md-card">
        <div className="md-header incidents-header">
          <h2 className="md-title">Incidents</h2>
          <div className="md-actions">
            <button className="btn btn-navy" onClick={() => void reload()}>Refresh</button>
          </div>
        </div>

        <div className="muted" style={{ marginBottom: 8 }}>
          Showing page {page} of {pages} • {total} total
        </div>

        <div className="md-table-wrap">
          <table className="md-table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>ID</th>
                <th>Title</th>
                <th style={{ width: 120 }}>Priority</th>
                <th style={{ width: 190 }}>Status</th>
                <th style={{ width: 90 }}>Asset</th>
                <th style={{ width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={6}>No incidents</td></tr>
              )}
              {items.map((it) => (
                <tr key={it.id}>
                  <td>{it.id}</td>
                  <td>{it.title}</td>
                  <td>
                    <span
                      className={
                        "badge " +
                        (it.priority === "LOW"
                          ? "low"
                          : it.priority === "MEDIUM"
                          ? "medium"
                          : it.priority === "HIGH"
                          ? "high"
                          : "critical")
                      }
                    >
                      {it.priority}
                    </span>
                  </td>
                  <td>
                    <select
                      value={it.status}
                      onChange={async (e) => {
                        const next = e.target.value as Incident["status"];
                        await updateIncident(it.id, { status: next });
                        await reload();
                      }}
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                  </td>
                  <td>{it.assetId ?? "-"}</td>
                  <td>
                    <button className="btn" onClick={() => openAssign(it)}>Assign asset</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pager */}
        <div className="md-header" style={{ marginTop: 10 }}>
          <div className="muted">Page {page} • Page size</div>
          <div className="md-actions">
            <select
              value={pageSize}
              onChange={(e) => {
                setPage(1);
                setPageSize(Number(e.target.value));
              }}
            >
              {[5, 10, 20].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <button className="btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</button>
            <button className="btn" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}>Next</button>
          </div>
        </div>
      </div>

      {/* Assign modal */}
      <AssignAssetModal
        open={assignOpen}
        incidentId={assignFor?.id ?? 0}
        currentAssetId={assignFor?.assetId ?? null}
        onClose={() => setAssignOpen(false)}
        onAssign={async (assetId: number | null) => {
          if (!assignFor) return;
          await updateIncident(assignFor.id, { assetId: assetId ?? null });
          await reload();
        }}
      />
    </div>
  );
}

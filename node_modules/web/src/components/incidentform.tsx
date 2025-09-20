// FILE: web/src/components/incidentform.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createIncident,
  listIncidents,
  updateIncident,
  exportIncidentsCsv,
} from "../api/incidents";
import type { Incident, IncidentStatus, Priority } from "../api/incidents";

import AssignAssetModal from "./assignassetmodal";
import CsvDownloadButtons from "./csvdownloadbuttons";

/* ---------- constants / helpers ---------- */
const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUSES: IncidentStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

function clsPriority(p: Priority) {
  return "badge " + (p === "LOW" ? "low" : p === "MEDIUM" ? "medium" : p === "HIGH" ? "high" : "critical");
}

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

/* ---------- component ---------- */
export default function IncidentForm() {
  /* Theme toggle */
  const [theme, setTheme] = useState<string>(() => localStorage.getItem("theme") || "light");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  /* Create form */
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [status, setStatus] = useState<IncidentStatus>("OPEN");
  const [lon, setLon] = useState("-76.6122");
  const [lat, setLat] = useState("39.2904");
  const [assetId, setAssetId] = useState<string>("");

  /* Filters / paging */
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  /* Data */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<Incident[]>([]);

  /* Assign modal state */
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<{ id: number; assetId: number | null } | null>(null);

  function openAssign(it: Incident) {
    setAssignFor({ id: it.id, assetId: it.assetId ?? null });
    setAssignOpen(true);
  }

  /* Fetch list */
  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listIncidents({
        q,
        page,
        pageSize,
        assetId: assetId ? Number(assetId) : undefined,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [q, page, pageSize, assetId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  /* Create */
  const onCreate = async () => {
    try {
      await createIncident({
        title,
        description,
        priority,
        status,
        lon: Number(lon),
        lat: Number(lat),
        assetId: assetId ? Number(assetId) : undefined,
      });
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      setStatus("OPEN");
      setLon("-76.6122");
      setLat("39.2904");
      setAssetId("");
      await fetchList();
    } catch (e: unknown) {
      alert(`Create failed: ${getErrorMessage(e)}`);
    }
  };

  const onResetCreate = () => {
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setStatus("OPEN");
    setLon("-76.6122");
    setLat("39.2904");
    setAssetId("");
  };

  /* Inline status update */
  const onStatusChange = async (id: number, s: IncidentStatus) => {
    try {
      await updateIncident(id, { status: s });
      await fetchList();
    } catch (e: unknown) {
      alert(`Update failed: ${getErrorMessage(e)}`);
    }
  };

  /* Filters */
  const onApply = async () => {
    setPage(1);
    await fetchList();
  };
  const onClear = async () => {
    setQ("");
    setAssetId("");
    setPage(1);
    await fetchList();
  };

  /* CSV export */
  const onExportCsv = async () => {
    try {
      const blob = await exportIncidentsCsv({
        q,
        assetId: assetId ? Number(assetId) : undefined,
        page,
        pageSize,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "incidents.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      alert(`Export CSV failed: ${getErrorMessage(e)}`);
    }
  };

  const pages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  /* ---------- render ---------- */
  return (
    <div className="md-page">
      {/* Create Incident */}
      <div className="md-card">
        <div className="md-header">
          <h2 className="md-title">Create Incident</h2>
          <button
            className="btn theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "🌞 Light" : "🌙 Dark"}
          </button>
        </div>

        <div className="md-content">
          <div className="md-grid cols-2">
            <div className="md-field">
              <label>Title</label>
              <input className="md-input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="md-field">
              <label>Priority</label>
              <select
                className="md-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="md-field" style={{ gridColumn: "1 / -1" }}>
              <label>Description</label>
              <textarea
                className="md-textarea"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="md-field">
              <label>Status</label>
              <select
                className="md-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as IncidentStatus)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="md-field">
              <label>Longitude</label>
              <input className="md-input" value={lon} onChange={(e) => setLon(e.target.value)} />
            </div>

            <div className="md-field">
              <label>Latitude</label>
              <input className="md-input" value={lat} onChange={(e) => setLat(e.target.value)} />
            </div>

            <div className="md-field" style={{ gridColumn: "1 / -1" }}>
              <label>Asset ID (optional)</label>
              <input
                className="md-input"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
              />
            </div>
          </div>

          <div className="md-actions" style={{ marginTop: 12 }}>
            <button className="btn-primary" onClick={onCreate} disabled={loading || !title}>
              Create Incident
            </button>
            <button className="btn" onClick={onResetCreate} disabled={loading}>
              Reset
            </button>
            <button className="btn" onClick={onExportCsv} disabled={loading}>
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="md-card" style={{ marginTop: 16 }}>
        <div className="md-header">
          <h3 className="md-title">Search</h3>
        </div>
        <div className="md-content">
          <div className="md-grid cols-2">
            <div className="md-field">
              <label>title or description...</label>
              <input
                className="md-input"
                placeholder="e.g. network"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="md-field">
              <label>Asset</label>
              <input
                className="md-input"
                placeholder="Asset ID or blank"
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
              />
            </div>

            <div className="md-field pg-size">
              <label>Page size</label>
              <select
                className="md-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="md-actions" style={{ marginTop: 12 }}>
            <button className="btn-primary" onClick={onApply} disabled={loading}>Apply</button>
            <button className="btn" onClick={onClear} disabled={loading}>Clear</button>
          </div>
        </div>
      </div>

      {/* Incidents table */}
      <div className="md-card" style={{ marginTop: 16 }}>
        <div className="md-header">
          <h3 className="md-title">Incidents</h3>
        </div>

        <div className="md-content">
          <div className="muted" style={{ marginBottom: 8 }}>
            Showing page {page} of {pages} • {total} total
          </div>

          {error && (
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 12,
                marginBottom: 12,
              }}
            >
              <div style={{ marginBottom: 8 }}>{error}</div>
              <button className="btn" onClick={() => setError(null)}>Dismiss</button>
            </div>
          )}

          <div className="md-table-wrap">
            <table className="md-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Asset</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">No incidents</td>
                  </tr>
                )}

                {items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.id}</td>
                    <td>{it.title}</td>

                    <td>
                      <span className={clsPriority(it.priority)}>{it.priority}</span>
                    </td>

                    <td>
                      <select
                        className="md-select md-select--compact"
                        value={it.status}
                        onChange={(e) => onStatusChange(it.id, e.target.value as IncidentStatus)}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>{s.replace("_", " ")}</option>
                        ))}
                      </select>
                    </td>

                    {/* Asset id number (or em-dash) */}
                    <td>{it.assetId ?? "—"}</td>

                    {/* Actions column */}
                    <td>
                      <button className="btn" onClick={() => openAssign(it)}>
                        {it.assetId ? "Reassign asset" : "Assign asset"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="md-actions" style={{ marginTop: 12 }}>
            <button
              className="btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ◀ Prev
            </button>
            <select
              className="md-select"
              value={page}
              onChange={(e) => setPage(Number(e.target.value))}
            >
              {Array.from({ length: pages }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  Page {i + 1} / {pages}
                </option>
              ))}
            </select>
            <button
              className="btn"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              Next ▶
            </button>
          </div>
        </div>
      </div>

      {/* CSV Downloads */}
      <div className="md-card" style={{ marginTop: 16 }}>
        <div className="md-header">
          <h3 className="md-title">Download Analytics CSVs</h3>
        </div>
        <div className="md-content">
          <CsvDownloadButtons />
        </div>
      </div>

      {/* Assign Asset modal (render only when ids are definite numbers) */}
      {assignOpen && assignFor && (
        <AssignAssetModal
          open={assignOpen}
          incidentId={assignFor.id}
          currentAssetId={assignFor.assetId ?? null}
          onClose={() => setAssignOpen(false)}
          onAssign={async (newAssetId: number | null) => {
            try {
              await updateIncident(assignFor.id, { assetId: newAssetId ?? null });
              await fetchList();
            } catch (e: unknown) {
              alert(`Asset assignment failed: ${getErrorMessage(e)}`);
            } finally {
              setAssignOpen(false);
            }
          }}
        />
      )}
    </div>
  );
}
/* ---------- end of file ---------- */
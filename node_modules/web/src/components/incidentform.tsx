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
  return (
    "badge " +
    (p === "LOW" ? "low" : p === "MEDIUM" ? "medium" : p === "HIGH" ? "high" : "critical")
  );
}

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try { return JSON.stringify(e); } catch { return String(e); }
}

const API_URL = (import.meta as ImportMeta).env?.VITE_API_URL || "http://localhost:5050";

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

  /* AI suggestion */
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<{ priority: Priority; confidence: number; inferredType?: string } | null>(null);

  useEffect(() => {
    if (!title && !description) {
      setAiSuggestion(null);
      setAiErr(null);
      return;
    }
    setAiErr(null);
    setAiLoading(true);
    const h = setTimeout(async () => {
      try {
        const r = await fetch(`${API_URL}/ml/classify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description }),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        setAiSuggestion({
          priority: data.priority,
          confidence: Math.round((data.confidence || 0) * 100) / 100,
          inferredType: data.inferredType,
        });
      } catch (e) {
        setAiErr(getErrorMessage(e));
        setAiSuggestion(null);
      } finally {
        setAiLoading(false);
      }
    }, 900);
    return () => clearTimeout(h);
  }, [title, description]);

  async function sendMlFeedback(
    action: "accept" | "override",
    suggested: { priority: Priority },
    final: { priority: Priority }
  ) {
    try {
      await fetch(`${API_URL}/ml/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, suggested, final }),
      });
    } catch {
      // Ignore errors from ML feedback
    }
  }

  function acceptAi() {
    if (!aiSuggestion) return;
    setPriority(aiSuggestion.priority);
    sendMlFeedback("accept", { priority: aiSuggestion.priority }, { priority: aiSuggestion.priority });
  }

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
    setAssignOpen(true); // <- this is what drives the modal now
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
      // NOTE: listIncidents returns { total, items }
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [q, page, pageSize, assetId]);

  useEffect(() => { fetchList(); }, [fetchList]);

  /* Create */
  const onCreate = async () => {
    try {
      if (aiSuggestion && aiSuggestion.priority !== priority) {
        sendMlFeedback("override", { priority: aiSuggestion.priority }, { priority });
      }
      await createIncident({
        title,
        description,
        priority,
        status,
        lon: Number(lon),
        lat: Number(lat),
        assetId: assetId ? Number(assetId) : undefined,
      });
      onReset();            // keep the page tidy after a create
      await fetchList();    // refresh list
    } catch (e) {
      alert(`Create failed: ${getErrorMessage(e)}`);
    }
  };

  /* NEW: Reset button behavior (restores defaults without touching the list) */
  const onReset = () => {
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setStatus("OPEN");
    setLon("-76.6122");
    setLat("39.2904");
    setAssetId("");
    setAiSuggestion(null);
    setAiErr(null);
  };

  /* Inline status update */
  const onStatusChange = async (id: number, s: IncidentStatus) => {
    try {
      await updateIncident(id, { status: s });
      await fetchList();
    } catch (e) {
      alert(`Update failed: ${getErrorMessage(e)}`);
    }
  };

  /* Filters */
  const onApply = async () => { setPage(1); await fetchList(); };
  const onClear = async () => { setQ(""); setAssetId(""); setPage(1); await fetchList(); };

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
      a.href = url; a.download = "incidents.csv";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
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
          <button className="btn theme-toggle" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "🌞 Light" : "🌙 Dark"}
          </button>
        </div>

        <div className="md-content">
          <div className="md-grid cols-2">
            <div className="md-field">
              <label htmlFor="title">Title</label>
              <input id="title" className="md-input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="md-field">
              <label>Priority</label>
              <select className="md-select" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                {PRIORITIES.map((p) => (<option key={p} value={p}>{p}</option>))}
              </select>

              {/* AI: suggestion */}
              <div className="muted" style={{ marginTop: 6 }}>
                {aiLoading && <span>AI analyzing…</span>}
                {!aiLoading && aiSuggestion && (
                  <span>
                    AI suggestion: <strong>{aiSuggestion.priority}</strong>
                    {typeof aiSuggestion.confidence === "number" && ` (${Math.round(aiSuggestion.confidence * 100)}%)`}
                    {aiSuggestion.inferredType && ` — type: ${aiSuggestion.inferredType}`}
                    <button className="btn" style={{ marginLeft: 8 }} type="button" onClick={acceptAi}>Accept</button>
                  </span>
                )}
                {!aiLoading && aiErr && <span style={{ color: "var(--danger)" }}>{aiErr}</span>}
              </div>
            </div>

            <div className="md-field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="desc">Description</label>
              <textarea id="desc" className="md-textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="md-field">
              <label>Status</label>
              <select className="md-select" value={status} onChange={(e) => setStatus(e.target.value as IncidentStatus)}>
                {STATUSES.map((s) => (<option key={s} value={s}>{s.replace("_", " ")}</option>))}
              </select>
            </div>

            <div className="md-field">
              <label htmlFor="lon">Longitude</label>
              <input id="lon" className="md-input" value={lon} onChange={(e) => setLon(e.target.value)} />
            </div>

            <div className="md-field">
              <label htmlFor="lat">Latitude</label>
              <input id="lat" className="md-input" value={lat} onChange={(e) => setLat(e.target.value)} />
            </div>

            <div className="md-field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="assetIdInput">Asset ID (optional)</label>
              <input id="assetIdInput" className="md-input" value={assetId} onChange={(e) => setAssetId(e.target.value)} />
            </div>
          </div>

          <div className="md-actions" style={{ marginTop: 12 }}>
            <button className="btn-primary" onClick={onCreate} disabled={loading || !title}>Create Incident</button>

            {/* NEW: Reset button (the one you asked to bring back) */}
            <button className="btn" onClick={onReset} disabled={loading}>Reset</button>

            <button className="btn" onClick={onExportCsv} disabled={loading}>Export CSV</button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="md-card" style={{ marginTop: 16 }}>
        <div className="md-header">
          <h3 className="md-title">Search</h3>
          <div className="muted">Showing page {page} of {pages} • {total} total</div>
        </div>
        <div className="md-content">
          <div className="md-grid cols-2">
            <div className="md-field">
              <label htmlFor="q">title or description…</label>
              <input id="q" className="md-input" placeholder="e.g. network" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="md-field">
              <label htmlFor="assetFilter">Asset</label>
              <input id="assetFilter" className="md-input" placeholder="Asset ID or blank" value={assetId} onChange={(e) => setAssetId(e.target.value)} />
            </div>
            <div className="md-field pg-size">
              <label htmlFor="pgSize">Page size</label>
              <select id="pgSize" className="md-select" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {[10, 20, 50, 100].map((n) => (<option key={n} value={n}>{n}</option>))}
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
          {loading && <div className="muted">Loading…</div>}
        </div>
        <div className="md-content">
          {error && (
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
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
                {items.length === 0 ? (
                  <tr><td colSpan={6} className="muted">No incidents found</td></tr>
                ) : (
                  items.map((it) => (
                    <tr key={it.id}>
                      <td>{it.id}</td>
                      <td>{it.title}</td>
                      <td><span className={clsPriority(it.priority)}>{it.priority}</span></td>

                      {/* Status selector */}
                      <td>
                        <select
                          className="md-select md-select--compact"
                          value={it.status}
                          onChange={(e) => onStatusChange(it.id, e.target.value as IncidentStatus)}
                        >
                          {STATUSES.map((s) => (<option key={s} value={s}>{s.replace("_", " ")}</option>))}
                        </select>
                      </td>

                      <td>{it.assetId ?? "—"}</td>

                      <td className="asset-cell">
                        <button className="btn" onClick={() => openAssign(it)}>
                          {it.assetId ? "Reassign asset" : "Assign asset"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="md-actions" style={{ marginTop: 12 }}>
            <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>◀ Prev</button>
            <select className="md-select" value={page} onChange={(e) => setPage(Number(e.target.value))}>
              {Array.from({ length: pages }).map((_, i) => (
                <option key={i + 1} value={i + 1}>Page {i + 1} / {pages}</option>
              ))}
            </select>
            <button className="btn" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Next ▶</button>
          </div>
        </div>
      </div>

      {/* CSV Downloads */}
      <div className="md-card" style={{ marginTop: 16 }}>
        <div className="md-header"><h3 className="md-title">Download Analytics CSVs</h3></div>
        <div className="md-content"><CsvDownloadButtons /></div>
      </div>

      {/* Assign Asset modal */}
      {assignFor && (
        <AssignAssetModal
          open={assignOpen}
          incidentId={assignFor.id}
          currentAssetId={assignFor.assetId}
          onClose={() => setAssignOpen(false)}
          onAssign={async (newAssetId: number | null) => {
            await updateIncident(assignFor.id, { assetId: newAssetId ?? null });
            await fetchList();
            setAssignOpen(false);
          }}
        />
      )}
    </div>
  );
}

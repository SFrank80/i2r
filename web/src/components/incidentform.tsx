// FILE: web/src/components/incidentform.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createIncident,
  listIncidents,
  updateIncident,
  exportIncidentsCsv,
  classify,
  mlFeedback,
  geocode,
  type Incident,
  type IncidentStatus,
  type Priority,
} from "../api/incidents";

import AssignAssetModal from "./assignassetmodal";
import CsvDownloadButtons from "./csvdownloadbuttons";
import MapPanel from "./mappanel";
import IncidentDetailsModal from "./incidentdetailsmodal";

/* ---------- constants / helpers ---------- */
const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUSES: IncidentStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

function clsPriority(p: Priority) {
  return "badge " + (p === "LOW" ? "low" : p === "MEDIUM" ? "medium" : p === "HIGH" ? "high" : "critical");
}
function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try { return JSON.stringify(e); } catch { return String(e); }
}

const API_URL = (import.meta as ImportMeta).env?.VITE_API_URL || "http://localhost:5050";

/** Map start */
const DEFAULT_CENTER: [number, number] = [39.29, -76.61];
const DEFAULT_ZOOM = 10;

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

  /* Address input (wide) + message */
  const [address, setAddress] = useState("");
  const [foundMsg, setFoundMsg] = useState<string>("");

  /* AI suggestion */
  const [aiLoading, setAiLoading] = useState(false);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<{ priority: Priority; confidence: number; inferredType?: string } | null>(null);

  useEffect(() => {
    if (!title && !description) { setAiSuggestion(null); setAiErr(null); return; }
    setAiErr(null);
    setAiLoading(true);
    const h = setTimeout(async () => {
      try {
        const data = await classify({ title, description });
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

  function acceptAi() {
    if (!aiSuggestion) return;
    setPriority(aiSuggestion.priority);
    if (aiSuggestion) {
      mlFeedback({
        action: "accept",
        suggested: { priority: aiSuggestion.priority },
        final: { priority: aiSuggestion.priority },
      });
    }
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
  const openAssign = (it: Incident) => { setAssignFor({ id: it.id, assetId: it.assetId ?? null }); setAssignOpen(true); };

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
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [q, page, pageSize, assetId]);

  useEffect(() => { fetchList(); }, [fetchList]);

  /* ---------- map focus + refresh ---------- */
  const [mapFocus, setMapFocus] = useState<{ lat: number; lon: number; ts: number } | null>(null);
  const [mapBump, setMapBump] = useState(0);

  /* Heuristic: geocode from Title */
  useEffect(() => {
    const titleTrim = title.trim();
    if (titleTrim.length < 8) return;
    const looksLikePlace = /\d{2,}|(corner| at | & )/i.test(titleTrim);
    if (!looksLikePlace) return;
    const runner = setTimeout(async () => {
      try {
        const j = await geocode(titleTrim);
        if (j.ok && typeof j.lat === "number" && typeof j.lon === "number") {
          setMapFocus({ lat: j.lat, lon: j.lon, ts: Date.now() });
        }
      } catch {
        // intentionally ignore geocode errors
      }
    }, 800);
    return () => clearTimeout(runner);
  }, [title]);

  /* Create */
  const onCreate = async () => {
    try {
      if (aiSuggestion && aiSuggestion.priority !== priority) {
        mlFeedback({ action: "override", suggested: { priority: aiSuggestion.priority }, final: { priority } });
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
      onReset();
      await fetchList();
      setMapBump((x) => x + 1); // refresh map layer
    } catch (e) {
      alert(`Create failed: ${getErrorMessage(e)}`);
    }
  };

  const onReset = () => {
    setTitle(""); setDescription("");
    setPriority("MEDIUM"); setStatus("OPEN");
    setLon("-76.6122"); setLat("39.2904");
    setAssetId(""); setAiSuggestion(null); setAiErr(null);
    setAddress(""); setFoundMsg("");
  };

  const onStatusChange = async (id: number, s: IncidentStatus) => {
    try { await updateIncident(id, { status: s }); await fetchList(); }
    catch (e) { alert(`Update failed: ${getErrorMessage(e)}`); }
  };

  const onApply = async () => { setPage(1); await fetchList(); };
  const onClear = async () => { setQ(""); setAssetId(""); setPage(1); await fetchList(); };

  const onExportCsv = async () => {
    try {
      const blob = await exportIncidentsCsv({
        q,
        assetId: assetId ? Number(assetId) : undefined,
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

  /* Use address -> geocode and fill lon/lat + focus map for 30s */
  async function onUseAddress() {
    const q = (address || title).trim();
    if (!q) { setFoundMsg("Enter an address first."); return; }
    try {
      const j = await geocode(q);
      if (!j.ok || typeof j.lat !== "number" || typeof j.lon !== "number") {
        setFoundMsg("No match found for that address.");
        return;
      }
      setFoundMsg(`Found: ${j.label || ""}`.trim());
      setLat(String(j.lat));
      setLon(String(j.lon));
      setMapFocus({ lat: j.lat, lon: j.lon, ts: Date.now() }); // MapPanel handles pulsing pin for ~30s
    } catch (e) {
      setFoundMsg(getErrorMessage(e));
    }
  }

  /* ---------- details modal (ID / Title click) ---------- */
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsIncident, setDetailsIncident] = useState<Incident | null>(null);

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
                {!aiLoading && aiErr && (<span style={{ color: "var(--danger)" }}>{aiErr}</span>)}
              </div>
            </div>

            <div className="md-field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="desc">Description</label>
              <textarea id="desc" className="md-textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            {/* Address row — wide input + compact button */}
            <div className="md-field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="addr">Address (optional — use to auto-fill lon/lat)</label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(320px, 1fr) 160px",
                  gap: 12,
                }}
              >
                <input
                  id="addr"
                  className="md-input"
                  placeholder="e.g. 10300 Little Patuxent Pkwy, Columbia MD"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  autoComplete="street-address"
                />
                <button type="button" className="btn" style={{ width: "auto" }} onClick={onUseAddress}>
                  Use address
                </button>
              </div>
              {!!foundMsg && <div className="muted" style={{ marginTop: 6 }}>{foundMsg}</div>}
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
                  <th>ID</th><th>Title</th><th>Priority</th><th>Status</th><th>Asset</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={6} className="muted">No incidents found</td></tr>
                ) : (
                  items.map((it) => (
                    <tr key={it.id}>
                      <td>
                        {/* Clickable but not blue link */}
                        <button
                          className="linklike"
                          onClick={() => { setDetailsIncident(it); setDetailsOpen(true); }}
                        >
                          {it.id}
                        </button>
                      </td>
                      <td>
                        <button
                          className="linklike"
                          onClick={() => { setDetailsIncident(it); setDetailsOpen(true); }}
                        >
                          {it.title}
                        </button>
                      </td>
                      <td><span className={clsPriority(it.priority)}>{it.priority}</span></td>
                      <td>
                        <select className="md-select md-select--compact" value={it.status}
                          onChange={(e) => onStatusChange(it.id, e.target.value as IncidentStatus)}>
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
              {Array.from({ length: pages }).map((_, i) => (<option key={i + 1} value={i + 1}>Page {i + 1} / {pages}</option>))}
            </select>
            <button className="btn" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>Next ▶</button>
          </div>
        </div>
      </div>

      {/* CSV Downloads (unchanged) */}
      <CsvDownloadButtons />

      {/* Operations Map */}
      <div className="md-card" style={{ marginTop: 16 }}>
        <div className="md-header"><h3 className="md-title">Operations Map</h3></div>
        <div className="md-content">
          <MapPanel
            incidentsUrl={`${API_URL}/incidents/geojson?t=${mapBump}`}
            assetsUrl={`${API_URL}/assets/geojson?t=${mapBump}`}
            center={DEFAULT_CENTER}
            zoom={DEFAULT_ZOOM}
            height={480}
            focus={mapFocus}
          />
        </div>
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

      {/* Incident Details modal (popup) */}
      <IncidentDetailsModal
        open={detailsOpen}
        incident={detailsIncident}
        onClose={() => setDetailsOpen(false)}
        onSaved={fetchList}
        onCenterOnMap={(plat, plon) => {
          setDetailsOpen(false);
          setMapFocus({ lat: plat, lon: plon, ts: Date.now() });
        }}
      />

      {/* Local styles for linklike cells so we don't touch global css */}
      <style>{`
        .linklike {
          background: none; border: none; padding: 0; font: inherit; color: inherit; cursor: pointer;
        }
        .linklike:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}

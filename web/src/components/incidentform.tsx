// FILE: web/src/components/incidentform.tsx
// Sprint 6: stable useEffect deps, compact pager select, CSV download, dark mode toggle
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  API_BASE,
  createIncident,
  listIncidents,
  updateIncident,
  exportIncidentsCsv,
} from "../api/incidents";
import type { Incident, IncidentStatus, Priority } from "../api/incidents";

// ⬇️ add the modal (same folder, lowercase path)
import AssignAssetModal from "./assignassetmodal";

// ---------- helpers ----------
const priorities: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const statuses: IncidentStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

function clsPriority(p: Priority) {
  return (
    "badge " +
    (p === "LOW" ? "low" : p === "MEDIUM" ? "medium" : p === "HIGH" ? "high" : "critical")
  );
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

export default function IncidentForm() {
  // ---------- theme ----------
  const [theme, setTheme] = useState<string>(() => localStorage.getItem("theme") || "light");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // ---------- create form ----------
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [status, setStatus] = useState<IncidentStatus>("OPEN");
  const [lon, setLon] = useState("-76.6122");
  const [lat, setLat] = useState("39.2904");

  // ---------- filters & paging ----------
  const [q, setQ] = useState("");
  const [assetId, setAssetId] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ---------- data / state ----------
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<Incident[]>([]);

  // ---------- assign asset modal state ----------
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<{ id: number; assetId: number | null } | null>(null);

  function openAssign(it: Incident) {
    setAssignFor({ id: it.id, assetId: it.assetId ?? null });
    setAssignOpen(true);
  }

  // Stable callback used by useEffect so dep list does not change between renders
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

  // ---------- actions ----------
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
      await fetchList();
    } catch (e: unknown) {
      alert(`Create failed: ${getErrorMessage(e)}`);
    }
  };

  const onStatusChange = async (id: number, s: IncidentStatus) => {
    try {
      await updateIncident(id, { status: s });
      await fetchList();
    } catch (e: unknown) {
      alert(`Update failed: ${getErrorMessage(e)}`);
    }
  };

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

  // ---------- ui ----------
  return (
    <div className="md-page">
      <div className="md-card">
        <div className="md-header">
          <h2 className="md-title">Create Incident</h2>
          <div className="md-actions theme-toggle">
            <button
              className="btn"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? "🌞 Light" : "🌙 Dark"}
            </button>
          </div>
        </div>
        <div className="md-content">
          <div className="md-grid cols-2">
            <div className="md-field">
              <label>Title</label>
              <input className="md-input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="md-field">
              <label>Description</label>
              <textarea
                className="md-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="md-field">
              <label>Priority</label>
              <select
                className="md-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                {priorities.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="md-field">
              <label>Status</label>
              <select
                className="md-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as IncidentStatus)}
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
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
          </div>

          <div className="md-actions" style={{ marginTop: 12 }}>
            <button className="btn-primary btn" onClick={onCreate} disabled={loading}>
              Create Incident
            </button>
            <button
              className="btn"
              onClick={() => {
                setTitle("");
                setDescription("");
                setPriority("MEDIUM");
                setStatus("OPEN");
                setLon("-76.6122");
                setLat("39.2904");
              }}
              disabled={loading}
            >
              Reset
            </button>
            <button className="btn" onClick={onExportCsv} disabled={loading}>
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="md-card">
        <div className="md-header">
          <div className="md-title" style={{ fontSize: 16 }}>
            Search
          </div>
        </div>
        <div className="md-content">
          <div className="md-grid cols-2">
            <div className="md-field">
              <label>title or description…</label>
              <input className="md-input" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="md-field">
              <label>Asset</label>
              <div className="md-grid" style={{ gridTemplateColumns: "1fr auto auto", gap: 8 }}>
                <input
                  className="md-input"
                  placeholder="Asset ID or blank"
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                />
                <button className="btn" onClick={onApply} disabled={loading}>
                  Apply
                </button>
                <button className="btn" onClick={onClear} disabled={loading}>
                  Clear
                </button>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 8 }} className="muted">
            Showing page {page} of {useMemo(() => pages, [pages])} • {total} total
          </div>

          {error && (
            <div className="alert error" role="alert" style={{ marginTop: 8 }}>
              {error}
            </div>
          )}

          <div className="md-table-wrap" style={{ marginTop: 8 }}>
            <table className="md-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>ID</th>
                  <th>Title</th>
                  <th style={{ width: 120 }}>Priority</th>
                  <th style={{ width: 160 }}>Status</th>
                  <th style={{ width: 80 }}>Asset</th>
                  <th style={{ width: 140 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td>{it.id}</td>
                    <td>{it.title}</td>
                    <td>
                      <span className={clsPriority(it.priority)}>{it.priority}</span>
                    </td>
                    <td>
                      <select
                        className="md-select"
                        value={it.status}
                        onChange={(e) => onStatusChange(it.id, e.target.value as IncidentStatus)}
                      >
                        {statuses.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{it.assetId ?? "-"}</td>
                    <td>
                      {/* ⬇️ wire the button */}
                      <button
                        type="button"
                        className="btn"
                        onClick={() => openAssign(it)}
                        aria-label={`Assign asset to incident ${it.id}`}
                      >
                        Assign asset
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">
                      No results
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="md-actions" style={{ marginTop: 12 }}>
            {/* compact page-size control */}
            <span className="pg-size">
              <select
                className="md-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
            </span>

            <div style={{ marginLeft: "auto" }} />
            <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Prev
            </button>
            <button className="btn" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}>
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ⬇️ modal lives once, outside the table */}
      <AssignAssetModal
        open={assignOpen}
        incidentId={assignFor?.id ?? 0}
        currentAssetId={assignFor?.assetId ?? null}
        onClose={() => setAssignOpen(false)}
        onAssign={async (newAssetId: number | null) => {
          if (!assignFor) return;
          await updateIncident(assignFor.id, { assetId: newAssetId });
          setItems((prev) =>
            prev.map((row) =>
              row.id === assignFor.id ? { ...row, assetId: newAssetId ?? null } : row
            )
          );
          setAssignOpen(false);
        }}
      />

      <div style={{ height: 32 }} />
      <div className="muted">API base: {API_BASE}</div>
    </div>
  );
}

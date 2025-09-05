import { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import {
  getHealth,
  listIncidents,
  updateIncident,
  createIncident,
  type Incident,
  type Priority,
  type IncidentStatus,
} from "./api";

/** filters persisted in localStorage */
type Query = {
  priority: Priority | "All";
  status: IncidentStatus | "All";
  search: string;
};

const FILTERS_KEY = "i2r.filters.v1";
const PAGE_KEY = "i2r.page.v1";
const PAGE_SIZE_KEY = "i2r.pageSize.v1";

export default function App() {
  /* --------- health ---------- */
  const [health, setHealth] = useState<string>("…");

  /* --------- create form ---------- */
  const [title, setTitle] = useState("");
  const [lon, setLon] = useState("-77.04");
  const [lat, setLat] = useState("39.04");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [status, setStatus] = useState<IncidentStatus>("OPEN"); // disabled; server creates OPEN
  const [description, setDescription] = useState("");

  /* --------- list + paging ---------- */
  const [items, setItems] = useState<Incident[]>([]);
  const [page, setPage] = useState<number>(() => {
    const raw = localStorage.getItem(PAGE_KEY);
    const n = raw ? Number(raw) : 1;
    return Number.isFinite(n) && n > 0 ? n : 1;
  });
  const [pageSize, setPageSize] = useState<number>(() => {
    const raw = localStorage.getItem(PAGE_SIZE_KEY);
    const n = raw ? Number(raw) : 10;
    return Number.isFinite(n) && n > 0 ? n : 10;
  });
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  /* --------- filters (persisted) ---------- */
  const [query, setQuery] = useState<Query>(() => {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      return raw ? (JSON.parse(raw) as Query) : { priority: "All", status: "All", search: "" };
    } catch {
      return { priority: "All", status: "All", search: "" };
    }
  });

  // debounced search input
  const [rawSearch, setRawSearch] = useState<string>(query.search);

  // persist filters/page/pageSize
  useEffect(() => {
    localStorage.setItem(FILTERS_KEY, JSON.stringify(query));
  }, [query]);
  useEffect(() => {
    localStorage.setItem(PAGE_KEY, String(page));
  }, [page]);
  useEffect(() => {
    localStorage.setItem(PAGE_SIZE_KEY, String(pageSize));
  }, [pageSize]);

  // debounce: update query.search 300ms after typing stops
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setQuery((q) => ({ ...q, search: rawSearch }));
    }, 300);
    return () => clearTimeout(t);
  }, [rawSearch]);

  /* --------- health check ---------- */
  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setHealth("unhealthy"));
  }, []);

  /* --------- load list whenever deps change ---------- */
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const res = await listIncidents({
          page,
          pageSize,
          priority: query.priority,
          status: query.status,
          search: query.search,
        });
        if (!cancel) {
          setItems(res.items);
          setTotal(res.total);
        }
      } catch (e: unknown) {
        if (e && typeof e === "object" && "message" in e) {
          toast.error((e as { message?: string }).message || "Failed to load incidents");
        } else {
          toast.error("Failed to load incidents");
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [page, pageSize, query.priority, query.status, query.search]);

  const showing = useMemo(() => {
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);
    return { from, to };
  }, [total, page, pageSize]);

  /* --------- handlers ---------- */
  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    const lonNum = Number(lon),
      latNum = Number(lat);
    if (!title.trim()) return toast.error("Title is required");
    if (!Number.isFinite(lonNum) || !Number.isFinite(latNum)) {
      return toast.error("Longitude and Latitude must be numbers");
    }
    try {
      await toast.promise(
        createIncident({
          title: title.trim(),
          lon: lonNum,
          lat: latNum,
          description: description.trim() || undefined,
          priority,
        }),
        { loading: "Creating incident...", success: "Incident created", error: "Create failed" }
      );
      // reset + reload to first page (keeps filters)
      setTitle("");
      setDescription("");
      setPage(1);
      const res = await listIncidents({
        page: 1,
        pageSize,
        priority: query.priority,
        status: query.status,
        search: query.search,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch {
      /* toast already handled */
    }
  }

  async function onChangeStatus(id: number, newStatus: IncidentStatus) {
    await toast.promise(updateIncident(id, { status: newStatus }), {
      loading: "Updating status...",
      success: "Status updated",
      error: "Update failed",
    });
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: newStatus } : it)));
  }

  function onAssignAsset() {
    toast("Assigning assets not wired yet (coming soon)", { icon: "🛠️" });
  }

  /* --------- render ---------- */
  return (
    <div className="page">
      <div className="container">
        <Toaster position="top-right" />

        <h1 style={{ margin: "4px 0 8px" }}>I2R Web</h1>
        <div className="muted" style={{ marginBottom: 12 }}>
          API health: <strong style={{ color: health === "ok" ? "#059669" : "#b91c1c" }}>{health}</strong>
        </div>

        {/* Create incident */}
        <div className="card">
          <form onSubmit={onCreate}>
            <div style={{ marginBottom: 10 }}>
              <label className="muted">Title*</label>
              <input
                className="input"
                value={title}
                placeholder="Short summary"
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="row" style={{ marginBottom: 10 }}>
              <div>
                <label className="muted">Longitude*</label>
                <input
                  className="input"
                  value={lon}
                  inputMode="decimal"
                  pattern="-?\d*(\.\d+)?"
                  placeholder="-77.04"
                  onChange={(e) => setLon(e.target.value)}
                />
              </div>
              <div>
                <label className="muted">Latitude*</label>
                <input
                  className="input"
                  value={lat}
                  inputMode="decimal"
                  pattern="-?\d*(\.\d+)?"
                  placeholder="39.04"
                  onChange={(e) => setLat(e.target.value)}
                />
              </div>
            </div>

            <div className="row" style={{ marginBottom: 10 }}>
              <div>
                <label className="muted">Priority*</label>
                <select
                  className="select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                >
                  <option>LOW</option>
                  <option>MEDIUM</option>
                  <option>HIGH</option>
                  <option>CRITICAL</option>
                </select>
              </div>
              <div>
                <label className="muted">Status</label>
                <select
                  className="select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as IncidentStatus)}
                  disabled
                >
                  {/* server always creates OPEN, left here for future */}
                  <option>OPEN</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="muted">Description</label>
              <textarea
                className="textarea"
                rows={3}
                value={description}
                placeholder="Optional details…"
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <button className="btn" type="submit">
              Create Incident
            </button>
          </form>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="toolbar">
            <div>
              <label className="muted">Priority</label>
              <select
                className="select"
                value={query.priority}
                onChange={(e) => {
                  setPage(1);
                  setQuery((q) => ({ ...q, priority: e.target.value as Priority | "All" }));
                }}
              >
                <option>All</option>
                <option>LOW</option>
                <option>MEDIUM</option>
                <option>HIGH</option>
                <option>CRITICAL</option>
              </select>
            </div>

            <div>
              <label className="muted">Status</label>
              <select
                className="select"
                value={query.status}
                onChange={(e) => {
                  setPage(1);
                  setQuery((q) => ({ ...q, status: e.target.value as IncidentStatus | "All" }));
                }}
              >
                <option>All</option>
                <option>OPEN</option>
                <option>IN_PROGRESS</option>
                <option>RESOLVED</option>
                <option>CLOSED</option>
              </select>
            </div>

            <div>
              <label className="muted">Search</label>
              <input
                className="input"
                value={rawSearch}
                placeholder="title or description…"
                onChange={(e) => setRawSearch(e.target.value)}
              />
            </div>

            <div>
              <label className="muted">Page size</label>
              <select
                className="select"
                value={pageSize}
                onChange={(e) => {
                  setPage(1);
                  setPageSize(Number(e.target.value));
                }}
              >
                {[5, 10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="muted" style={{ margin: "4px 0 8px" }}>
            Showing {showing.from}–{showing.to} of {total} incidents
          </div>

          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
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
                    <td colSpan={6}>No incidents match your filters.</td>
                  </tr>
                )}
                {!loading &&
                  items.map((it) => (
                    <tr key={it.id}>
                      <td>{it.id}</td>
                      <td>{it.title}</td>
                      <td>{it.priority}</td>
                      <td>
                        <select
                          className="select"
                          value={it.status}
                          onChange={(e) => onChangeStatus(it.id, e.target.value as IncidentStatus)}
                        >
                          <option>OPEN</option>
                          <option>IN_PROGRESS</option>
                          <option>RESOLVED</option>
                          <option>CLOSED</option>
                        </select>
                      </td>
                      <td>{new Date(it.createdAt).toLocaleString()}</td>
                      <td className="actions">
                        <button className="btn" onClick={onAssignAsset}>
                          Assign asset
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <button className="btn" disabled={page === 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ◀ Prev
            </button>
            <span>Page {page}</span>
            <button
              className="btn"
              disabled={page * pageSize >= total || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

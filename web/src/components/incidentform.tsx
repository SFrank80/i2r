// web/src/components/incidentform.tsx
import { useState } from "react";
import {
  createIncident,
  updateIncident,
  type Incident,
  type Priority,
  type IncidentStatus,
} from "../api";

type Props = {
  onCreated?: (incident: Incident) => void;
};

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUSES: IncidentStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export default function IncidentForm({ onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [lon, setLon] = useState<string>("");
  const [lat, setLat] = useState<string>("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [status, setStatus] = useState<IncidentStatus>("OPEN");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toNum(v: string): number | null {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    const lonNum = toNum(lon);
    const latNum = toNum(lat);
    if (lonNum === null || latNum === null) {
      setError("Longitude and Latitude must be valid numbers");
      return;
    }

    setBusy(true);
    try {
      // 1) Create with allowed fields only
      const created = await createIncident({
        title: title.trim(),
        lon: lonNum,
        lat: latNum,
        description: description.trim() || undefined,
        priority,
      });

      // 2) If user chose a status other than OPEN, update right away
      let finalIncident = created;
      if (status !== "OPEN") {
        finalIncident = await updateIncident(created.id, { status });
      }

      // reset form
      setTitle("");
      setLon("");
      setLat("");
      setDescription("");
      setPriority("MEDIUM");
      setStatus("OPEN");

      onCreated?.(finalIncident);
    } catch (err: unknown) {
      if (err && typeof err === "object" && "message" in err) {
        setError(String((err as { message?: string }).message) || "Create failed");
      } else {
        setError("Create failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={box}>
      <div style={row}>
        <label style={label} htmlFor="inc-title">Title*</label>
        <input
          id="inc-title"
          style={input}
          placeholder="Short summary"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div style={row}>
        <label style={label} htmlFor="inc-lon">Longitude*</label>
        <input
          id="inc-lon"
          style={input}
          placeholder="-77.04"
          inputMode="decimal"
          value={lon}
          onChange={(e) => setLon(e.target.value)}
          required
        />
        <label style={{ ...label, marginLeft: 12 }} htmlFor="inc-lat">Latitude*</label>
        <input
          id="inc-lat"
          style={input}
          placeholder="39.04"
          inputMode="decimal"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          required
        />
      </div>

      <div style={row}>
        <label style={label} htmlFor="inc-priority">Priority*</label>
        <select
          id="inc-priority"
          style={input}
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <label style={{ ...label, marginLeft: 12 }} htmlFor="inc-status">Status</label>
        <select
          id="inc-status"
          style={input}
          value={status}
          onChange={(e) => setStatus(e.target.value as IncidentStatus)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div style={row}>
        <label style={label} htmlFor="inc-desc">Description</label>
        <textarea
          id="inc-desc"
          style={{ ...input, height: 70 }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional details…"
        />
      </div>

      {error && <div style={{ color: "#b30000", marginBottom: 8 }}>{error}</div>}

      <button type="submit" disabled={busy} style={button}>
        {busy ? "Creating..." : "Create Incident"}
      </button>
    </form>
  );
}

/* ---------- styles (scoped to this file) ---------- */
const box: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 16,
  marginBottom: 16,
  background: "linear-gradient(180deg, #ffffff, #fafafa)",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 10,
  flexWrap: "wrap",
};

const label: React.CSSProperties = {
  width: 100,
  minWidth: 80,
  color: "#374151",
  fontSize: 14,
  fontWeight: 500,
};

const input: React.CSSProperties = {
  flex: 1,
  minWidth: 180,
  padding: "8px 10px",
  border: "1px solid #d1d5db",
  borderRadius: 8,
  outline: "none",
  background: "#fff",
};

const button: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid #111827",
  background: "#111827",
  color: "white",
  cursor: "pointer",
};

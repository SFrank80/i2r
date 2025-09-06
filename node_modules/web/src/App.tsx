// FILE: web/src/App.tsx
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

// all‑lowercase path per your preference
import AssignAssetModal from "./components/assignassetmodal";

// your project layout has incidents.ts in src/
import { listIncidents, updateIncident } from "./api/incidents";
import type { Incident } from "./api/incidents";

export default function App() {
  const [items, setItems] = useState<Incident[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<{ id: number; assetId: number | null } | null>(null);

  useEffect(() => {
    (async () => {
      const res = (await listIncidents({ page: 1, pageSize: 20 })) as { items: Incident[] };
      setItems(res.items.map((it) => ({ ...it, assetId: it.assetId ?? null })));
    })();
  }, []);

  function openAssign(it: Incident) {
    setAssignFor({ id: it.id, assetId: it.assetId ?? null });
    setAssignOpen(true);
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Incidents</h2>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>ID</th>
              <th style={th}>Title</th>
              <th style={th}>Priority</th>
              <th style={th}>Status</th>
              <th style={th}>Asset</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td style={td}>{it.id}</td>
                <td style={td}>{it.title}</td>
                <td style={td}>{it.priority}</td>
                <td style={td}>{it.status}</td>
                <td style={td}>{it.assetId ?? "-"}</td>
                <td style={td}>
                  <button style={btn} onClick={() => openAssign(it)}>Assign asset</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* NOTE: prop is `open`, not `isOpen` */}
      <AssignAssetModal
        open={assignOpen}
        incidentId={assignFor?.id ?? 0}
        currentAssetId={assignFor?.assetId ?? null}
        onClose={() => setAssignOpen(false)}
        onAssign={async (assetId: number | null) => {
          if (!assignFor) return;
          await updateIncident(assignFor.id, { assetId });
          setItems((prev) => prev.map((it) => (it.id === assignFor.id ? { ...it, assetId: assetId ?? null } : it)));
        }}
      />
    </div>
  );
}

const th: CSSProperties = { textAlign: "left", padding: 8, borderBottom: "1px solid #eee" };
const td: CSSProperties = { padding: 8, borderBottom: "1px solid #f2f2f2" };
const btn: CSSProperties = { padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", background: "#f9fafb", cursor: "pointer" };

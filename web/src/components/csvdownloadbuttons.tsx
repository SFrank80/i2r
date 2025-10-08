// FILE: web/src/components/csvdownloadbuttons.tsx
import { useState } from "react";

// Use the API base you already use elsewhere.
// Falls back to your local API during dev.
const API_URL =
  (import.meta as ImportMeta).env?.VITE_API_URL || "http://localhost:5050";

type DownloadDef = { name: string; path: string };

const downloads: DownloadDef[] = [
  { name: "Daily CSV",       path: "/analytics/daily.csv" },
  { name: "By Asset CSV",    path: "/analytics/by-asset.csv" },
  { name: "SLA Breaches CSV", path: "/analytics/sla.csv" },
];

// Utility: trigger a download with a guaranteed .csv filename
async function fetchAndSaveCsv(
  endpoint: string,
  filename: string
): Promise<void> {
  const res = await fetch(`${API_URL}${endpoint}`, { credentials: "omit" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const blob = await res.blob(); // server sends text/csv; we still force .csv filename
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename; // ensures a real .csv file rather than .htm
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

const CsvDownloadButtons = () => {
  // Optional: disable a button while its download is in progress
  const [busy, setBusy] = useState<string | null>(null);

  const onClick = async (dl: DownloadDef) => {
    try {
      setBusy(dl.path);
      // Keep a stable, nice filename (e.g., "daily.csv")
      const fname =
        dl.path.split("/").pop() /* e.g., "daily.csv" */ ??
        dl.name.replace(/\s+/g, "-").toLowerCase() + ".csv";
      await fetchAndSaveCsv(dl.path, fname);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Download failed: ${msg}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="md-page">
      <div className="md-card">
        <div className="md-header">
          <h2 className="md-title">Download Analytics CSVs</h2>
        </div>

        <div className="md-content">
          <div className="md-grid cols-2">
            {downloads.map((dl) => (
              <button
                key={dl.path}
                className="btn"
                onClick={() => onClick(dl)}
                disabled={busy === dl.path}
                type="button"
              >
                {busy === dl.path ? "Downloading…" : dl.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CsvDownloadButtons;

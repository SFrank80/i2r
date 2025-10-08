// FILE: web/src/components/mappanel.tsx
import { useEffect, useMemo, useRef } from "react";
import L, { type Map as LeafletMap, type LayerGroup } from "leaflet";

type Focus = { lat: number; lon: number; ts: number; durationMs?: number };

type Props = {
  incidentsUrl: string;
  assetsUrl?: string;
  center: [number, number]; // [lat, lon]
  zoom: number;
  height?: number;
  refreshKey?: number;
  /** When provided, the map zooms to this point and drops a pulsing pin */
  focus?: Focus | null;
};

function fetchJson(url: string) {
  return fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
}

/** Build a FiMapPin-like SVG marker as a Leaflet DivIcon (no extra deps). */
function makeFiPinIcon(options?: { size?: number; inner?: string; stroke?: string; pulse?: boolean }) {
  const size = options?.size ?? 36; // visual width of the SVG
  const inner = options?.inner ?? "#ff5a1f"; // neon orange-red fill
  const stroke = options?.stroke ?? "#000";  // black outline
  const pulse = options?.pulse ?? true;

  // Teardrop silhouette (now BLACK fill) + inner neon circle.
  const svg = `
    <div class="fi-pin ${pulse ? "pulse" : ""}">
      <svg viewBox="0 0 24 30" width="${size}" height="${Math.round(size * 1.3)}" aria-hidden="true">
        <g class="core">
          <path d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z"
                fill="#000" stroke="${stroke}" stroke-width="2" />
          <circle cx="12" cy="9.5" r="3.2" fill="${inner}" />
        </g>
      </svg>
    </div>
  `.trim();

  return L.divIcon({
    className: "fi-pin-wrap",
    html: svg,
    iconSize: [size, Math.round(size * 1.3)],
    iconAnchor: [size / 2, Math.round(size * 1.3)], // bottom-center
    popupAnchor: [0, -size * 0.65],
  });
}

export default function MapPanel({
  incidentsUrl,
  assetsUrl,
  center,
  zoom,
  height = 480,
  refreshKey = 0,
  focus,
}: Props) {
  const mapRef = useRef<LeafletMap | null>(null);
  const incidentsLayerRef = useRef<LayerGroup | null>(null);
  const assetsLayerRef = useRef<LayerGroup | null>(null);
  const focusMarkerRef = useRef<L.Marker | null>(null);
  const focusTimerRef = useRef<number | null>(null);

  // Styles for the FiMapPin + stronger pulse (scoped to this component).
  const pinCss = useMemo(
    () => `
      .fi-pin {
        position: relative;
        transform: translate(-50%, -100%); /* anchor bottom-center */
        filter: drop-shadow(0 2px 2px rgba(0,0,0,.25)) drop-shadow(0 0 8px rgba(255,90,31,.55));
        will-change: transform, opacity;
      }
      .fi-pin .core {
        transform-origin: 50% 100%;
        animation: pinThrob 1.1s ease-in-out infinite;
      }
      .fi-pin svg circle {
        filter: drop-shadow(0 0 6px rgba(255,90,31,.95));
      }

      /* dual pulsing rings for a stronger effect */
      .fi-pin.pulse::after,
      .fi-pin.pulse::before {
        content: "";
        position: absolute;
        left: 50%;
        top: 100%;
        width: 12px;
        height: 12px;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        background: radial-gradient(circle,
          rgba(255,90,31,.75) 0%,
          rgba(255,90,31,.35) 38%,
          rgba(255,90,31,0) 70%);
        pointer-events: none;
      }
      .fi-pin.pulse::after {
        animation: pinPulse 1.6s ease-out infinite;
      }
      .fi-pin.pulse::before {
        animation: pinPulse 1.6s ease-out .45s infinite; /* offset for intensity */
      }

      @keyframes pinPulse {
        0%   { opacity: .95; transform: translate(-50%, -50%) scale(.55); }
        60%  { opacity: .25; transform: translate(-50%, -50%) scale(2.4); }
        100% { opacity: 0;   transform: translate(-50%, -50%) scale(2.9); }
      }
      @keyframes pinThrob {
        0%   { transform: scale(.95); }
        50%  { transform: scale(1.10); } /* slightly larger for stronger throb */
        100% { transform: scale(.95); }
      }
    `,
    []
  );

  // Create map once
  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map("ops-map", {
      center,
      zoom,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 20,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    incidentsLayerRef.current = L.layerGroup().addTo(map);
    assetsLayerRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [center, zoom]);

  // Load incidents & assets whenever URLs or refreshKey changes
  useEffect(() => {
    const map = mapRef.current;
    const incidentsLayer = incidentsLayerRef.current;
    const assetsLayer = assetsLayerRef.current;
    if (!map || !incidentsLayer) return;

    incidentsLayer.clearLayers();
    assetsLayer?.clearLayers();

    let cancelled = false;

    (async () => {
      try {
        // incidents
        const inc = await fetchJson(incidentsUrl);
        if (!cancelled && inc?.features?.length) {
          for (const f of inc.features) {
            if (!f?.geometry?.coordinates) continue;
            const [lon, lat] = f.geometry.coordinates as [number, number];
            const title = f?.properties?.title ?? `Incident #${f?.properties?.id ?? ""}`;
            const priority = f?.properties?.priority ?? "";
            const status = f?.properties?.status ?? "";
            const color =
              priority === "CRITICAL" ? "#ff3b30" :
              priority === "HIGH"     ? "#ff9500" :
              priority === "MEDIUM"   ? "#34c759" :
                                        "#2dd4bf";

            L.circleMarker([lat, lon], {
              radius: 6,
              weight: 1.25,
              color: "#222",
              fillColor: color,
              fillOpacity: 0.95,
            })
              .bindTooltip(`${title}<br/>${priority} • ${status}`, { sticky: true })
              .addTo(incidentsLayer);
          }
        }

        // assets (optional)
        if (assetsUrl && assetsLayer) {
          const as = await fetchJson(assetsUrl);
          if (!cancelled && as?.features?.length) {
            for (const f of as.features) {
              if (!f?.geometry?.coordinates) continue;
              const [lon, lat] = f.geometry.coordinates as [number, number];
              const name = f?.properties?.name ?? `Asset #${f?.properties?.id ?? ""}`;
              L.circleMarker([lat, lon], {
                radius: 4,
                weight: 1,
                color: "#0b7285",
                fillColor: "#22b8cf",
                fillOpacity: 0.8,
              })
                .bindTooltip(name, { sticky: true })
                .addTo(assetsLayer);
            }
          }
        }
      } catch {
        // swallow; map remains usable
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [incidentsUrl, assetsUrl, refreshKey]);

  // Handle "focus" — zoom + pulsing FiMapPin for durationMs (default 30s)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;

    // clear previous timer/marker
    if (focusTimerRef.current) {
      window.clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
    focusMarkerRef.current?.remove();
    focusMarkerRef.current = null;

    // create a pulsing FiMapPin icon (black body + neon inner)
    const icon = makeFiPinIcon({ size: 38, inner: "#ff5a1f", stroke: "#000", pulse: true });
    const m = L.marker([focus.lat, focus.lon], { icon }).addTo(map);
    focusMarkerRef.current = m;

    // smooth center/zoom
    map.setView([focus.lat, focus.lon], Math.max(map.getZoom(), 17), { animate: true });

    // auto-remove after N ms (default 30s)
    const ttl = Number.isFinite(focus.durationMs as number) ? (focus.durationMs as number) : 30000;
    focusTimerRef.current = window.setTimeout(() => {
      focusMarkerRef.current?.remove();
      focusMarkerRef.current = null;
    }, ttl);

    return () => {
      if (focusTimerRef.current) {
        window.clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
      m.remove();
    };
  }, [focus, focus?.ts]); // re-run only when a *new* focus is emitted

  return (
    <>
      <style>{pinCss}</style>
      <div id="ops-map" style={{ height }} />
    </>
  );
}

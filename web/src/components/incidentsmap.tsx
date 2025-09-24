import { useEffect, useRef } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";

const INCIDENTS_URL = import.meta.env.VITE_ARCGIS_INCIDENTS_URL!;
const ASSETS_URL = import.meta.env.VITE_ARCGIS_ASSETS_URL!;
const API_KEY = import.meta.env.VITE_ARCGIS_API_KEY!;

export default function IncidentsMap() {
  const divRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // API key
    interface EsriConfig {
      apiKey?: string;
      [key: string]: unknown;
    }
    (window as { esriConfig?: EsriConfig }).esriConfig = (window as { esriConfig?: EsriConfig }).esriConfig || {};
    ((window as { esriConfig?: EsriConfig }).esriConfig as EsriConfig).apiKey = API_KEY;

    const map = new Map({ basemap: "arcgis-topographic" });

    const incidents = new FeatureLayer({
      url: INCIDENTS_URL,
      title: "Incidents",
      outFields: ["*"],
      popupTemplate: {
        title: "{title}",
        content: [
          { type: "text", text: "<b>Priority:</b> {priority}<br/><b>Status:</b> {status}<br/><b>Asset:</b> {assetId}" },
        ],
      },
    });

    const assets = new FeatureLayer({
      url: ASSETS_URL,
      title: "Assets",
      outFields: ["*"],
    });

    map.addMany([assets, incidents]);

    const view = new MapView({
      container: divRef.current as HTMLDivElement,
      map,
      center: [-76.6122, 39.2904],
      zoom: 10,
    });

    return () => view.destroy();
  }, []);

  return <div style={{ height: 520, borderRadius: 12 }} ref={divRef} />;
}

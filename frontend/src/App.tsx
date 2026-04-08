import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";

// 1. Strict TypeScript interface for our reports
interface Report {
  id: number;
  target_name: string;
  category: string;
  description: string;
  lat: number;
  lon: number;
  vote_count: number;
}

export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [reports, setReports] = useState<Report[]>([]);

  // 2. Logic for API and Map Paths
  // Local: http://localhost:3000 | Production: /api (routed by Nginx)
  const API_BASE = import.meta.env.VITE_API_URL || "/api";

  // Maps the PMTiles through the /tiles/ proxy path we set in nginx.conf
  const MAP_URL = `pmtiles://${window.location.host}/tiles/chile.pmtiles`;

  useEffect(() => {
    // Initialize PMTiles Protocol
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);

    if (!mapContainer.current || map.current) return;

    // 3. Initialize the Map
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      center: [-70.6483, -33.4489], // Santiago
      zoom: 11,
      style: {
        version: 8,
        glyphs:
          "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
        sources: {
          "chile-map": {
            type: "vector",
            url: MAP_URL,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#f3f4f6" },
          },
          {
            id: "water",
            type: "fill",
            source: "chile-map",
            "source-layer": "water",
            paint: { "fill-color": "#93c5fd" },
          },
          {
            id: "roads",
            type: "line",
            source: "chile-map",
            "source-layer": "roads",
            paint: { "line-color": "#ffffff", "line-width": 1 },
          },
          {
            id: "buildings",
            type: "fill",
            source: "chile-map",
            "source-layer": "buildings",
            paint: { "fill-color": "#e5e7eb" },
          },
        ],
      },
    });

    // 4. Load Data from Backend
    fetch(`${API_BASE}/reports`)
      .then((res) => res.json())
      .then((data: Report[]) => {
        setReports(data || []);

        data?.forEach((report) => {
          if (!map.current) return;

          // Create marker for each report
          new maplibregl.Marker({ color: "#dc2626" })
            .setLngLat([report.lon, report.lat])
            .setPopup(
              new maplibregl.Popup({ offset: 25 }).setHTML(`
              <div class="p-2 font-sans">
                <h3 class="font-bold text-gray-900 border-b pb-1 mb-1">${report.target_name}</h3>
                <p class="text-xs text-red-600 font-bold mb-1">${report.category}</p>
                <p class="text-sm text-gray-700 leading-tight mb-2">${report.description}</p>
                <div class="flex justify-between items-center text-[10px] text-gray-400">
                  <span>${report.vote_count} confirmaciones</span>
                  <button class="bg-gray-100 px-2 py-0.5 rounded hover:bg-gray-200 transition">Confirmar</button>
                </div>
              </div>
            `),
            )
            .addTo(map.current);
        });
      })
      .catch((err) => console.error("Error fetching reports:", err));

    return () => map.current?.remove();
  }, [API_BASE, MAP_URL]);

  return (
    <div className="relative w-full h-full font-sans bg-gray-100">
      {/* Map Element */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Floating UI Panel - Styled with Tailwind */}
      <div className="absolute top-6 left-6 z-10 w-80 bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-2xl border border-white/20">
        <header className="mb-6">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight leading-none">
            Denuncia Ambiental
          </h1>
          <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-[0.2em]">
            Chile • devverse.win
          </p>
        </header>

        <div className="space-y-4">
          <section className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-baseline justify-between">
            <span className="text-xs font-bold text-red-800 uppercase">
              Alertas
            </span>
            <span className="text-3xl font-black text-red-600 leading-none">
              {reports.length}
            </span>
          </section>

          <button className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl transition-all shadow-lg active:scale-95 text-sm uppercase tracking-widest">
            Generar Reporte
          </button>
        </div>
      </div>

      {/* Footer / Attribution */}
      <div className="absolute bottom-2 right-2 z-10 text-[10px] text-gray-500 bg-white/50 px-2 py-0.5 rounded">
        {window.location.hostname}
      </div>
    </div>
  );
}

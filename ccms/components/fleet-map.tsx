"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import type { PanelRecord } from "@/lib/api/types";
import { useRouter } from "next/navigation";
import L from "leaflet";

// Custom icons based on health status
const createIcon = (color: string) => {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};

const icons = {
  ONLINE: createIcon('green'),
  OFFLINE: createIcon('grey'),
  FAULT: createIcon('red'),
  UNKNOWN: createIcon('blue'),
};

export default function FleetMap({ panels }: { panels: PanelRecord[] }) {
  const router = useRouter();

  // Find center. If no panels, default to a generic view
  const validPanels = panels.filter(p => p.gpsLat !== 0 && p.gpsLng !== 0);
  const centerLat = validPanels.length > 0 ? validPanels[0].gpsLat : 51.505;
  const centerLng = validPanels.length > 0 ? validPanels[0].gpsLng : -0.09;
  const zoomLevel = validPanels.length > 0 ? 12 : 2;

  // Render
  return (
    <div className="h-[600px] w-full rounded-xl overflow-hidden border border-slate-700 shadow-xl relative z-0">
      <MapContainer 
        center={[centerLat, centerLng]} 
        zoom={zoomLevel} 
        scrollWheelZoom={true} 
        style={{ height: "100%", width: "100%" }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        {validPanels.map(panel => (
          <Marker 
            key={panel.panelId} 
            position={[panel.gpsLat, panel.gpsLng]}
            icon={icons[panel.status] || icons.UNKNOWN}
          >
            <Popup className="custom-popup">
              <div className="font-sans text-slate-800 p-1">
                <h3 className="font-bold text-sm mb-1">{panel.name !== panel.panelId ? `${panel.name} (${panel.panelId})` : panel.panelId}</h3>
                <p className="text-xs mb-1">Status: <span className={`font-semibold ${panel.status === 'ONLINE' ? 'text-emerald-600' : panel.status === 'FAULT' ? 'text-rose-600' : 'text-slate-500'}`}>{panel.status}</span></p>
                <div className="mt-2 text-xs border-t border-slate-200 pt-2 flex flex-col gap-1">
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      router.push(`/panel?id=${panel.panelId}`);
                    }}
                    className="bg-indigo-50 px-2 py-1 rounded text-indigo-700 hover:bg-indigo-100 transition-colors w-full text-center font-medium"
                  >
                    View Dashboard
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

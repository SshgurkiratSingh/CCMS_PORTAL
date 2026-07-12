"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import L from "leaflet";

const defaultIcon = new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png`,
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function LocationMarker({
  lat,
  lng,
  setPosition,
}: {
  lat: number;
  lng: number;
  setPosition: (lat: number, lng: number) => void;
}) {
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng.lat, e.latlng.lng);
    },
  });

  useEffect(() => {
    if (lat && lng) {
      map.flyTo([lat, lng], map.getZoom());
    }
  }, [lat, lng, map]);

  return lat || lng ? (
    <Marker position={[lat || 0, lng || 0]} icon={defaultIcon} />
  ) : null;
}

export default function LocationPickerMap({
  lat,
  lng,
  onChange,
  className = "h-64 w-full rounded-md overflow-hidden",
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  className?: string;
}) {
  const position: [number, number] =
    lat && lng ? [lat, lng] : [20.5937, 78.9629]; // Default to India roughly
  const zoom = lat && lng ? 14 : 4;

  return (
    <div className={className}>
      <MapContainer
        center={position}
        zoom={zoom}
        style={{ height: "100%", width: "100%", zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker lat={lat} lng={lng} setPosition={onChange} />
      </MapContainer>
    </div>
  );
}

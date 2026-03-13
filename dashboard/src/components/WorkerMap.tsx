'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface WorkerPin {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  isAvailable: boolean;
  lastSeen?: string;
}

function createWorkerIcon(name: string, isAvailable: boolean) {
  const color = isAvailable ? '#10b981' : '#64748b';
  const initial = name.charAt(0).toUpperCase();
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: 36px; height: 36px; border-radius: 50%;
        background: ${color}; border: 3px solid white;
        display: flex; align-items: center; justify-content: center;
        color: white; font-weight: 700; font-size: 14px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        font-family: system-ui, sans-serif;
      ">${initial}</div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

function FitBounds({ workers, selectedId }: { workers: WorkerPin[]; selectedId: string | null }) {
  const map = useMap();

  useEffect(() => {
    if (selectedId) {
      const w = workers.find((x) => x.id === selectedId);
      if (w) map.flyTo([w.latitude, w.longitude], 15, { duration: 0.5 });
      return;
    }
    if (workers.length > 0) {
      const bounds = L.latLngBounds(workers.map((w) => [w.latitude, w.longitude]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [workers.length, selectedId]);

  return null;
}

export default function WorkerMap({
  workers,
  selectedId,
  onSelect,
}: {
  workers: WorkerPin[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (workers.length === 0) return null;

  const center: [number, number] = [
    workers.reduce((s, w) => s + w.latitude, 0) / workers.length,
    workers.reduce((s, w) => s + w.longitude, 0) / workers.length,
  ];

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ width: '100%', height: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds workers={workers} selectedId={selectedId} />
      {workers.map((w) => (
        <Marker
          key={w.id}
          position={[w.latitude, w.longitude]}
          icon={createWorkerIcon(w.name, w.isAvailable)}
          eventHandlers={{
            click: () => onSelect(w.id === selectedId ? null : w.id),
          }}
        >
          <Popup>
            <div style={{ minWidth: 120 }}>
              <p style={{ fontWeight: 700, margin: 0 }}>{w.name}</p>
              <p style={{ fontSize: 12, color: '#666', margin: '4px 0 0' }}>
                {w.isAvailable ? 'Available' : 'Unavailable'}
              </p>
              {w.lastSeen && (
                <p style={{ fontSize: 11, color: '#999', margin: '2px 0 0' }}>
                  Last update: {new Date(w.lastSeen).toLocaleTimeString()}
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

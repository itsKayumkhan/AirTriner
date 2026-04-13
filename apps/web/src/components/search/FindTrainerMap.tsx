"use client";

import { useEffect, useRef, useState } from "react";

export interface TrainerPin {
  id: string;
  name: string;
  sport: string;
  rating: number;
  reviewCount: number;
  hourlyRate: number;
  lat: number;
  lng: number;
  avatarUrl?: string;
}

interface Props {
  trainers: TrainerPin[];
  centerLat?: number;
  centerLng?: number;
  onTrainerClick?: (id: string) => void;
  className?: string;
}

export default function FindTrainerMap({
  trainers,
  centerLat = 39.8,
  centerLng = -98.5,
  onTrainerClick,
  className = "",
}: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markersGroup = useRef<any>(null);
  const leafletLib = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);

  // Filter to only trainers with valid coordinates
  const validTrainers = trainers.filter((t) => t.lat && t.lng);

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapReady) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      // @ts-ignore -- CSS import handled by bundler
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !mapRef.current) return;
      leafletLib.current = L;

      const map = L.map(mapRef.current, {
        center: [centerLat, centerLng],
        zoom: 4,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { maxZoom: 18 }
      ).addTo(map);

      markersGroup.current = L.layerGroup().addTo(map);
      leafletMap.current = map;
      setMapReady(true);
    })();

    return () => {
      cancelled = true;
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
        markersGroup.current = null;
        leafletLib.current = null;
        setMapReady(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw markers
  useEffect(() => {
    const L = leafletLib.current;
    const map = leafletMap.current;
    const group = markersGroup.current;
    if (!L || !map || !group || !mapReady) return;
    group.clearLayers();

    const color = "#45D0FF";

    validTrainers.forEach((t) => {
      const icon = L.divIcon({
        className: "",
        html: `<div style="position:relative;">
          <div style="width:12px;height:12px;border-radius:50%;background:${color};box-shadow:0 0 0 3px ${color}30,0 0 16px ${color}50;"></div>
          <div style="position:absolute;top:-2px;left:-2px;width:16px;height:16px;border-radius:50%;border:2px solid ${color}80;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
        </div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      const avatarHtml = t.avatarUrl
        ? `<img src="${t.avatarUrl}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid ${color}40;" />`
        : `<div style="width:36px;height:36px;border-radius:50%;background:${color}18;display:flex;align-items:center;justify-content:center;border:2px solid ${color}40;">
            <span style="font-size:14px;font-weight:800;color:${color};">${t.name.charAt(0)}</span>
          </div>`;

      const stars = t.rating > 0 ? t.rating.toFixed(1) : "New";

      const popupHtml = `
        <div style="font-family:'Segoe UI',system-ui,sans-serif;padding:8px 4px;min-width:180px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            ${avatarHtml}
            <div>
              <div style="font-weight:800;font-size:14px;color:#fff;line-height:1.3;">${t.name}</div>
              <div style="font-size:11px;color:#94a3b8;font-weight:600;">${t.sport}</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:3px;">
              <span style="color:#facc15;font-size:13px;">&#9733;</span>
              <span style="font-size:12px;font-weight:700;color:#fff;">${stars}</span>
              <span style="font-size:11px;color:#64748b;">(${t.reviewCount})</span>
            </div>
            <div style="font-size:13px;font-weight:800;color:${color};">$${t.hourlyRate}<span style="font-size:10px;color:${color}99;font-weight:600;">/hr</span></div>
          </div>
          <button
            onclick="window.__findTrainerMapClick && window.__findTrainerMapClick('${t.id}')"
            style="width:100%;padding:8px 0;border:none;border-radius:12px;background:linear-gradient(135deg,${color},#0090d4);color:#0A0D14;font-weight:800;font-size:12px;cursor:pointer;letter-spacing:0.02em;"
          >View Profile</button>
        </div>`;

      L.marker([t.lat, t.lng], { icon })
        .addTo(group)
        .bindPopup(popupHtml, { className: "dark-popup", closeButton: false });
    });

    // fitBounds
    if (validTrainers.length > 0) {
      map.fitBounds(
        L.latLngBounds(validTrainers.map((t) => [t.lat, t.lng])),
        { padding: [60, 60], maxZoom: 12 }
      );
    }
  }, [validTrainers, mapReady]);

  // Register global click handler for popup buttons
  useEffect(() => {
    (window as any).__findTrainerMapClick = (id: string) => {
      onTrainerClick?.(id);
    };
    return () => {
      delete (window as any).__findTrainerMapClick;
    };
  }, [onTrainerClick]);

  return (
    <>
      <style jsx global>{`
        .dark-popup .leaflet-popup-content-wrapper {
          background: #1a1f2e !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          border-radius: 16px !important;
          box-shadow: 0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) !important;
          color: #fff !important;
        }
        .dark-popup .leaflet-popup-tip {
          background: #1a1f2e !important;
          border: 1px solid rgba(255,255,255,0.08) !important;
          box-shadow: none !important;
        }
        .leaflet-control-zoom a {
          background: #12141A !important;
          color: #fff !important;
          border-color: rgba(255,255,255,0.06) !important;
        }
        .leaflet-control-zoom a:hover {
          background: #1a1f2e !important;
        }
        @keyframes ping {
          75%, 100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>

      <div
        className={`relative h-[600px] rounded-2xl overflow-hidden border border-white/[0.06] ${className}`}
      >
        <div ref={mapRef} className="absolute inset-0" />
      </div>
    </>
  );
}

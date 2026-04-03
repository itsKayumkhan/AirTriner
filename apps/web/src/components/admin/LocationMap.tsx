"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { MapPin, Radio, Navigation, TrendingUp, TrendingDown, Globe2 } from "lucide-react";

type LocationPin = {
    id: string;
    name: string;
    lat: number;
    lng: number;
    role: "trainer" | "athlete";
    status?: string;
    sport?: string;
    city?: string;
    state?: string;
};

type HeatZone = {
    city: string;
    state: string;
    count: number;
    lat: number;
    lng: number;
};

interface LocationMapProps {
    pins: LocationPin[];
    title?: string;
    subtitle?: string;
}

export default function LocationMap({ pins, title = "Location Heatmap", subtitle }: LocationMapProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const leafletMap = useRef<any>(null);
    const markersGroup = useRef<any>(null);
    const leafletLib = useRef<any>(null);
    const [mapReady, setMapReady] = useState(false);
    const [view, setView] = useState<"pins" | "heatmap">("heatmap");

    const heatZones = useMemo(() => {
        const cityMap = new Map<string, { count: number; lats: number[]; lngs: number[]; state: string }>();
        pins.forEach(p => {
            if (!p.lat || !p.lng) return;
            const key = `${(p.city || "Unknown").toLowerCase()},${(p.state || "").toLowerCase()}`;
            if (!cityMap.has(key)) cityMap.set(key, { count: 0, lats: [], lngs: [], state: p.state || "" });
            const e = cityMap.get(key)!;
            e.count++; e.lats.push(p.lat); e.lngs.push(p.lng);
        });
        return Array.from(cityMap.entries())
            .map(([key, v]) => ({
                city: key.split(",")[0],
                state: v.state,
                count: v.count,
                lat: v.lats.reduce((a, b) => a + b, 0) / v.lats.length,
                lng: v.lngs.reduce((a, b) => a + b, 0) / v.lngs.length,
            }))
            .sort((a, b) => b.count - a.count);
    }, [pins]);

    const maxCount = Math.max(...heatZones.map(z => z.count), 1);
    const withLocation = pins.filter(p => p.lat && p.lng);
    const trainerCount = pins.filter(p => p.role === "trainer").length;
    const athleteCount = pins.filter(p => p.role === "athlete").length;
    const topZones = heatZones.slice(0, 5);
    const coldZones = heatZones.filter(z => z.count <= 2).slice(0, 3);

    // Init map
    useEffect(() => {
        if (!mapRef.current || mapReady) return;
        let cancelled = false;
        (async () => {
            const L = (await import("leaflet")).default;
            await import("leaflet/dist/leaflet.css");
            if (cancelled || !mapRef.current) return;
            leafletLib.current = L;

            const map = L.map(mapRef.current, {
                center: [39.8, -98.5],
                zoom: 4,
                zoomControl: false,
                attributionControl: false,
            });

            L.control.zoom({ position: "bottomright" }).addTo(map);
            L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 18 }).addTo(map);

            markersGroup.current = L.layerGroup().addTo(map);
            leafletMap.current = map;
            setMapReady(true);
        })();
        return () => { cancelled = true; if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; markersGroup.current = null; leafletLib.current = null; setMapReady(false); } };
    }, []);

    // Draw markers
    useEffect(() => {
        const L = leafletLib.current, map = leafletMap.current, group = markersGroup.current;
        if (!L || !map || !group || !mapReady) return;
        group.clearLayers();

        if (view === "pins") {
            const valid = pins.filter(p => p.lat && p.lng);
            valid.forEach(p => {
                const isTrainer = p.role === "trainer";
                const color = isTrainer ? "#45D0FF" : "#34d399";
                const icon = L.divIcon({
                    className: "",
                    html: `<div style="position:relative;">
                        <div style="width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 0 3px ${color}30,0 0 16px ${color}50;"></div>
                        <div style="position:absolute;top:-1px;left:-1px;width:12px;height:12px;border-radius:50%;border:1.5px solid ${color}80;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
                    </div>`,
                    iconSize: [10, 10], iconAnchor: [5, 5],
                });
                L.marker([p.lat, p.lng], { icon }).addTo(group).bindPopup(
                    `<div style="font-family:'Segoe UI',system-ui,sans-serif;padding:6px 2px;min-width:160px;">
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                            <div style="width:28px;height:28px;border-radius:8px;background:${color}18;display:flex;align-items:center;justify-content:center;">
                                <div style="width:8px;height:8px;border-radius:50%;background:${color};"></div>
                            </div>
                            <div>
                                <div style="font-weight:700;font-size:13px;color:#fff;line-height:1.2;">${p.name}</div>
                                <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:${color};font-weight:700;">${p.role}</div>
                            </div>
                        </div>
                        ${p.sport ? `<div style="font-size:11px;color:#94a3b8;margin-bottom:2px;">Sport: <span style="color:#e2e8f0;">${p.sport}</span></div>` : ""}
                        ${p.city ? `<div style="font-size:11px;color:#94a3b8;">Location: <span style="color:#e2e8f0;">${p.city}${p.state ? `, ${p.state}` : ""}</span></div>` : ""}
                    </div>`,
                    { className: "dark-popup", closeButton: false }
                );
            });
            if (valid.length > 0) map.fitBounds(L.latLngBounds(valid.map((p: any) => [p.lat, p.lng])), { padding: [60, 60], maxZoom: 6 });
        } else {
            heatZones.forEach(zone => {
                const intensity = zone.count / maxCount;
                const radius = Math.max(45000, intensity * 150000);
                const color = intensity > 0.6 ? "#45D0FF" : intensity > 0.3 ? "#f59e0b" : "#ef4444";
                const pulseColor = color;

                // Outer glow ring
                L.circle([zone.lat, zone.lng], {
                    radius: radius * 1.4,
                    color: "transparent",
                    fillColor: color,
                    fillOpacity: 0.04 + intensity * 0.06,
                    weight: 0,
                }).addTo(group);

                // Main circle
                L.circle([zone.lat, zone.lng], {
                    radius,
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.12 + intensity * 0.28,
                    weight: 1.5,
                    opacity: 0.5,
                    dashArray: intensity < 0.3 ? "4 4" : undefined,
                }).addTo(group).bindPopup(
                    `<div style="font-family:'Segoe UI',system-ui,sans-serif;padding:8px 4px;min-width:170px;">
                        <div style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:${color};font-weight:800;margin-bottom:6px;">Zone Report</div>
                        <div style="font-weight:800;font-size:18px;color:#fff;margin-bottom:2px;text-transform:capitalize;">${zone.city || "Unknown"}</div>
                        <div style="font-size:11px;color:#64748b;margin-bottom:10px;">${zone.state}</div>
                        <div style="display:flex;align-items:baseline;gap:4px;">
                            <span style="font-size:28px;font-weight:900;color:${color};line-height:1;">${zone.count}</span>
                            <span style="font-size:11px;color:#94a3b8;font-weight:600;">${zone.count === 1 ? "user" : "users"}</span>
                        </div>
                    </div>`,
                    { className: "dark-popup", closeButton: false }
                );

                // Small count label
                L.marker([zone.lat, zone.lng], {
                    icon: L.divIcon({
                        className: "",
                        html: `<div style="pointer-events:none;text-align:center;">
                            <div style="font-size:10px;font-weight:900;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,0.9);line-height:1;">${zone.count}</div>
                        </div>`,
                        iconSize: [20, 12], iconAnchor: [10, 6],
                    }),
                }).addTo(group);
            });
            if (heatZones.length > 0) map.fitBounds(L.latLngBounds(heatZones.map((z: any) => [z.lat, z.lng])), { padding: [60, 60], maxZoom: 6 });
        }
    }, [view, pins, mapReady, heatZones, maxCount]);


    const getZoneColor = (count: number) => {
        const intensity = count / maxCount;
        return intensity > 0.6 ? "text-primary" : intensity > 0.3 ? "text-amber-400" : "text-red-400";
    };
    const getZoneBg = (count: number) => {
        const intensity = count / maxCount;
        return intensity > 0.6 ? "bg-primary/10 border-primary/20" : intensity > 0.3 ? "bg-amber-400/10 border-amber-400/20" : "bg-red-400/10 border-red-400/20";
    };

    return (
        <>
            {/* Inject popup styles + ping animation */}
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

            <div className="relative rounded-[24px] overflow-hidden bg-[#0c0e14] border border-white/[0.06]">

                {/* ─── Header ─── */}
                <div className="relative z-10 flex items-center justify-between px-6 py-4 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                                <Globe2 size={18} className="text-primary" />
                            </div>
                            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary/80 border-2 border-[#0c0e14] animate-pulse" />
                        </div>
                        <div>
                            <h3 className="text-[15px] font-black text-white tracking-tight">{title}</h3>
                            {subtitle && <p className="text-[11px] text-white/30 font-medium mt-0.5">{subtitle}</p>}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* View toggle */}
                        <div className="flex bg-white/[0.03] border border-white/[0.06] rounded-2xl p-[3px]">
                            <button
                                onClick={() => setView("heatmap")}
                                className={`flex items-center gap-1.5 px-3.5 py-[7px] text-[10px] font-extrabold uppercase tracking-[0.12em] rounded-[13px] transition-all duration-300 ${
                                    view === "heatmap"
                                        ? "bg-primary text-[#0A0D14] shadow-[0_0_20px_rgba(69,208,255,0.25)]"
                                        : "text-white/35 hover:text-white/60"
                                }`}
                            >
                                <Radio size={12} />Zones
                            </button>
                            <button
                                onClick={() => setView("pins")}
                                className={`flex items-center gap-1.5 px-3.5 py-[7px] text-[10px] font-extrabold uppercase tracking-[0.12em] rounded-[13px] transition-all duration-300 ${
                                    view === "pins"
                                        ? "bg-primary text-[#0A0D14] shadow-[0_0_20px_rgba(69,208,255,0.25)]"
                                        : "text-white/35 hover:text-white/60"
                                }`}
                            >
                                <MapPin size={12} />Pins
                            </button>
                        </div>

                    </div>
                </div>

                {/* ─── Mini Stat Cards (hidden when expanded) ─── */}
                <div className="px-5 pb-3 grid grid-cols-3 gap-3">
                    <div className="bg-gradient-to-br from-[#12141A] to-[#0f1118] border border-white/[0.05] rounded-[16px] p-4 relative overflow-hidden group hover:border-white/[0.08] transition-all">
                        <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-primary rounded-r-full" />
                        <div className="flex justify-between items-start mb-3">
                            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white/30">Total Located</span>
                            <div className="p-1.5 rounded-lg bg-primary/10"><Navigation size={13} className="text-primary" /></div>
                        </div>
                        <div className="text-2xl font-black text-white tracking-tight">{withLocation.length}<span className="text-white/20 text-sm font-bold ml-0.5">/{pins.length}</span></div>
                    </div>

                    {trainerCount > 0 && (
                        <div className="bg-gradient-to-br from-[#12141A] to-[#0f1118] border border-white/[0.05] rounded-[16px] p-4 relative overflow-hidden group hover:border-white/[0.08] transition-all">
                            <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-primary/60 rounded-r-full" />
                            <div className="flex justify-between items-start mb-3">
                                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white/30">Trainers</span>
                                <div className="p-1.5 rounded-lg bg-primary/10"><MapPin size={13} className="text-primary" /></div>
                            </div>
                            <div className="text-2xl font-black text-primary tracking-tight">{trainerCount}</div>
                        </div>
                    )}

                    {athleteCount > 0 && (
                        <div className="bg-gradient-to-br from-[#12141A] to-[#0f1118] border border-white/[0.05] rounded-[16px] p-4 relative overflow-hidden group hover:border-white/[0.08] transition-all">
                            <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-emerald-500 rounded-r-full" />
                            <div className="flex justify-between items-start mb-3">
                                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white/30">Athletes</span>
                                <div className="p-1.5 rounded-lg bg-emerald-500/10"><MapPin size={13} className="text-emerald-400" /></div>
                            </div>
                            <div className="text-2xl font-black text-emerald-400 tracking-tight">{athleteCount}</div>
                        </div>
                    )}

                    {trainerCount === 0 && athleteCount === 0 && (
                        <>
                            <div className="bg-gradient-to-br from-[#12141A] to-[#0f1118] border border-white/[0.05] rounded-[16px] p-4 relative overflow-hidden">
                                <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-white/10 rounded-r-full" />
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white/30">Top City</span>
                                    <div className="p-1.5 rounded-lg bg-white/5"><TrendingUp size={13} className="text-white/30" /></div>
                                </div>
                                <div className="text-lg font-black text-white/80 capitalize tracking-tight">{heatZones[0]?.city || "—"}</div>
                            </div>
                            <div className="bg-gradient-to-br from-[#12141A] to-[#0f1118] border border-white/[0.05] rounded-[16px] p-4 relative overflow-hidden">
                                <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-white/10 rounded-r-full" />
                                <div className="flex justify-between items-start mb-3">
                                    <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white/30">Cities</span>
                                    <div className="p-1.5 rounded-lg bg-white/5"><Globe2 size={13} className="text-white/30" /></div>
                                </div>
                                <div className="text-2xl font-black text-white/80 tracking-tight">{heatZones.length}</div>
                            </div>
                        </>
                    )}
                </div>

                {/* ─── Map ─── */}
                <div className="relative h-[280px]">
                    <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-[#0c0e14] to-transparent z-[500] pointer-events-none" />
                    <div ref={mapRef} className="absolute inset-0" />
                    <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[#0c0e14] to-transparent z-[500] pointer-events-none" />
                </div>

                {/* ─── Bottom Panel (hidden when expanded) ─── */}
                <div className="relative z-10 border-t border-white/[0.06] bg-[#0a0c12]">
                    <div className={`grid gap-px bg-white/[0.04] ${heatZones.length >= 5 ? "grid-cols-5" : heatZones.length >= 3 ? "grid-cols-" + Math.min(heatZones.length, 5) : "grid-cols-2"}`} style={{ gridTemplateColumns: `repeat(${Math.min(heatZones.length, 5)}, 1fr)` }}>
                        {heatZones.slice(0, 5).map((z, i) => {
                            const intensity = z.count / maxCount;
                            const dotColor = intensity > 0.6 ? "bg-primary" : intensity > 0.3 ? "bg-amber-400" : "bg-red-400";
                            const textColor = intensity > 0.6 ? "text-primary" : intensity > 0.3 ? "text-amber-400" : "text-red-400";
                            return (
                                <div key={i} className="bg-[#0a0c12] px-5 py-5 flex items-center justify-between group hover:bg-white/[0.02] transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-9 h-9 rounded-xl ${dotColor}/15 flex items-center justify-center shrink-0`}>
                                            <span className={`text-sm font-black ${textColor}`}>{i + 1}</span>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[15px] font-bold text-white/90 capitalize leading-tight truncate">{z.city}</div>
                                            <div className="text-[11px] text-white/30 font-medium">{z.state}</div>
                                        </div>
                                    </div>
                                    <span className={`text-2xl font-black ${textColor} shrink-0 ml-3`}>{z.count}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Needs Focus warning + Legend */}
                    <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/[0.04]">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-primary" /><span className="text-[9px] text-white/25 font-semibold">Booming</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-400" /><span className="text-[9px] text-white/25 font-semibold">Growing</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-red-400" /><span className="text-[9px] text-white/25 font-semibold">Needs Focus</span></div>
                        </div>
                        {coldZones.length > 0 && (
                            <div className="flex items-center gap-2.5">
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/[0.08] border border-red-500/15">
                                    <TrendingDown size={10} className="text-red-400" />
                                    <span className="text-[9px] font-bold text-red-400/80">Needs Focus:</span>
                                    {coldZones.map((z, i) => (
                                        <span key={i} className="text-[10px] font-bold text-red-300 capitalize">{z.city}{i < coldZones.length - 1 ? "," : ""}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

        </>
    );
}

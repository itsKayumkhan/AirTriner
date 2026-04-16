"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { MapPin, AlertTriangle, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────

export type LocationValue = {
    city: string;
    state: string;
    country: string;
    lat: number | null;
    lng: number | null;
    zipCode?: string;
} | null;

export interface LocationAutocompleteProps {
    value: LocationValue;
    onChange: (v: LocationValue) => void;
    placeholder?: string;
    className?: string;
    required?: boolean;
}

type Prediction = { placeId: string; description: string };

const COUNTRY_NAMES: Record<string, string> = {
    US: "United States", CA: "Canada", GB: "United Kingdom", AU: "Australia",
    IN: "India", DE: "Germany", FR: "France", BR: "Brazil", MX: "Mexico",
};

// ── Component ──────────────────────────────────────────────────────

export default function LocationAutocomplete({
    value,
    onChange,
    placeholder = "City, State",
    className = "",
    required = false,
}: LocationAutocompleteProps) {
    const [query, setQuery] = useState(value?.city ?? "");
    const [predictions, setPredictions] = useState<Prediction[]>([]);
    const [open, setOpen] = useState(false);
    const [activeIdx, setActiveIdx] = useState(-1);
    const [loading, setLoading] = useState(false);
    const [notAvailable, setNotAvailable] = useState(false);
    const [blockedName, setBlockedName] = useState("");
    const [leadSaved, setLeadSaved] = useState(false);
    const [allowedCountries, setAllowedCountries] = useState<string[]>(["US", "CA"]);

    const abortRef = useRef<AbortController | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Load allowed countries
    useEffect(() => {
        supabase.from("platform_settings").select("allowed_countries").maybeSingle()
            .then(({ data }) => {
                if (data?.allowed_countries?.length) setAllowedCountries(data.allowed_countries);
            }).catch(() => {});
    }, []);

    // Sync external value
    useEffect(() => {
        if (value?.city) {
            setQuery([value.city, value.state].filter(Boolean).join(", "));
        } else {
            setQuery("");
        }
    }, [value?.city, value?.state]);

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // ── Fetch predictions (fast — no details yet) ──────────────────

    const fetchPredictions = useCallback((text: string) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (abortRef.current) abortRef.current.abort();

        if (text.length < 2) {
            setPredictions([]);
            setOpen(false);
            setNotAvailable(false);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            const controller = new AbortController();
            abortRef.current = controller;
            setLoading(true);

            try {
                const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(text)}`, {
                    signal: controller.signal,
                });
                const data: Prediction[] = await res.json();

                if (!controller.signal.aborted) {
                    setPredictions(data);
                    setOpen(data.length > 0);
                    setActiveIdx(-1);
                    setNotAvailable(false);

                    // If no results at all, show nothing
                    if (data.length === 0 && text.length >= 3) {
                        setOpen(false);
                    }
                }
            } catch {
                // Abort or network error
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }, 250);
    }, []);

    // ── Select prediction → fetch full details (1 call) ────────────

    const selectPrediction = useCallback(async (p: Prediction) => {
        setOpen(false);
        setPredictions([]);
        setQuery(p.description);
        setLoading(true);

        try {
            const res = await fetch(`/api/places/details?place_id=${encodeURIComponent(p.placeId)}`);
            const data = await res.json();

            if (data.error) {
                onChange({ city: p.description.split(",")[0]?.trim() || "", state: "", country: "", lat: null, lng: null });
                return;
            }

            // Check if country is allowed
            if (data.country && !allowedCountries.includes(data.country.toUpperCase())) {
                setNotAvailable(true);
                setBlockedName(data.displayName || p.description);
                setLeadSaved(false);
                setQuery("");
                onChange(null);
                return;
            }

            const display = [data.city, data.state].filter(Boolean).join(", ");
            setQuery(display);
            onChange({
                city: data.city,
                state: data.state,
                country: data.country,
                lat: data.lat,
                lng: data.lng,
                zipCode: data.zipCode || undefined,
            });
        } catch {
            onChange({ city: p.description.split(",")[0]?.trim() || "", state: "", country: "", lat: null, lng: null });
        } finally {
            setLoading(false);
        }
    }, [onChange, allowedCountries]);

    // ── Save lead ──────────────────────────────────────────────────

    const saveLead = async () => {
        if (leadSaved) return;
        try {
            await supabase.from("location_leads").insert({
                searched_city: blockedName,
                searched_country: "Unknown",
            });
            setLeadSaved(true);
        } catch {}
    };

    // ── Input handler ──────────────────────────────────────────────

    function handleInputChange(text: string) {
        setQuery(text);
        setNotAvailable(false);
        fetchPredictions(text);
    }

    function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (!open || predictions.length === 0) return;
        if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => (i < predictions.length - 1 ? i + 1 : 0)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => (i > 0 ? i - 1 : predictions.length - 1)); }
        else if (e.key === "Enter") { e.preventDefault(); if (activeIdx >= 0) selectPrediction(predictions[activeIdx]); }
        else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    }

    // ── Render ──────────────────────────────────────────────────────

    return (
        <div ref={wrapperRef} className={`relative ${className}`}>
            <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onFocus={() => { if (predictions.length > 0) setOpen(true); }}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    required={required}
                    autoComplete="off"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#12141A] border border-white/[0.06] text-white text-sm placeholder:text-white/30 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
                {loading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    </div>
                )}
            </div>

            {/* Predictions dropdown */}
            {open && predictions.length > 0 && (
                <ul className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-xl bg-[#12141A] border border-white/[0.06] shadow-xl">
                    {predictions.map((p, idx) => (
                        <li
                            key={p.placeId}
                            role="option"
                            aria-selected={idx === activeIdx}
                            onMouseDown={() => selectPrediction(p)}
                            onMouseEnter={() => setActiveIdx(idx)}
                            className={`flex items-center gap-2 px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                                idx === activeIdx ? "bg-primary/10 text-white" : "text-white/70 hover:bg-white/[0.04]"
                            }`}
                        >
                            <MapPin size={14} className="shrink-0 text-primary/60" />
                            <span className="truncate">{p.description}</span>
                        </li>
                    ))}
                </ul>
            )}

            {/* Not available in your area */}
            {notAvailable && (
                <div className="absolute z-50 mt-1 w-full rounded-xl bg-[#12141A] border border-amber-500/20 shadow-xl p-4">
                    <div className="flex items-start gap-3 mb-3">
                        <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-amber-400 mb-1">Not available in your area yet</p>
                            <p className="text-xs text-white/50 leading-relaxed">
                                AirTrainr is currently available in {allowedCountries.map(c => COUNTRY_NAMES[c] || c).join(", ")}.
                                We&apos;re expanding soon!
                            </p>
                        </div>
                    </div>
                    {!leadSaved ? (
                        <button
                            onMouseDown={saveLead}
                            className="w-full py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition-colors"
                        >
                            Notify me when AirTrainr launches here
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircle size={14} className="text-emerald-400" />
                            <span className="text-xs font-bold text-emerald-400">We&apos;ll notify you when we launch in your area!</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

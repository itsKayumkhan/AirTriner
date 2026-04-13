"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from "react";
import { MapPin } from "lucide-react";
import {
  getLocationProvider,
  type LocationResult,
} from "@/lib/location";

// ── Types ──────────────────────────────────────────────────────────

export type LocationValue = {
  city: string;
  state: string;
  country: string;
  lat: number | null;
  lng: number | null;
} | null;

export interface LocationAutocompleteProps {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

// ── Component ──────────────────────────────────────────────────────

export default function LocationAutocomplete({
  value,
  onChange,
  placeholder = "City, State",
  className = "",
  required = false,
}: LocationAutocompleteProps) {
  const provider = useRef(getLocationProvider());
  const configured = provider.current.isConfigured();

  const [query, setQuery] = useState(value?.city ?? "");
  const [results, setResults] = useState<LocationResult[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync external value changes into the text field.
  useEffect(() => {
    if (value?.city) {
      const display = [value.city, value.state].filter(Boolean).join(", ");
      setQuery(display);
    } else {
      setQuery("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.city, value?.state]);

  // Close dropdown on outside click.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Autocomplete with debounce ───────────────────────────────────

  const fetchSuggestions = useCallback(
    (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();

      if (!configured || text.length < 2) {
        setResults([]);
        setOpen(false);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortRef.current = controller;

        const items = await provider.current.autocomplete(
          text,
          controller.signal,
        );

        if (!controller.signal.aborted) {
          setResults(items);
          setOpen(items.length > 0);
          setActiveIdx(-1);
        }
      }, 300);
    },
    [configured],
  );

  // ── Handlers ─────────────────────────────────────────────────────

  function handleInputChange(text: string) {
    setQuery(text);

    if (!configured) {
      // Fallback: treat raw text as city.
      onChange({
        city: text,
        state: "",
        country: "",
        lat: null,
        lng: null,
      });
      return;
    }

    fetchSuggestions(text);
  }

  function selectResult(r: LocationResult) {
    setOpen(false);
    setResults([]);
    const display = [r.city, r.state].filter(Boolean).join(", ");
    setQuery(display);
    onChange({
      city: r.city,
      state: r.state,
      country: r.country,
      lat: r.lat,
      lng: r.lng,
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i < results.length - 1 ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i > 0 ? i - 1 : results.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < results.length) {
        selectResult(results[activeIdx]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <MapPin
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#12141A] border border-white/[0.06] text-white text-sm placeholder:text-white/30 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-colors"
        />
      </div>

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-xl bg-[#12141A] border border-white/[0.06] shadow-xl">
          {results.map((r, idx) => (
            <li
              key={`${r.lat}-${r.lng}-${idx}`}
              role="option"
              aria-selected={idx === activeIdx}
              onMouseDown={() => selectResult(r)}
              onMouseEnter={() => setActiveIdx(idx)}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                idx === activeIdx
                  ? "bg-primary/10 text-white"
                  : "text-white/70 hover:bg-white/[0.04]"
              }`}
            >
              <MapPin size={14} className="shrink-0 text-primary/60" />
              <span className="truncate">{r.displayName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

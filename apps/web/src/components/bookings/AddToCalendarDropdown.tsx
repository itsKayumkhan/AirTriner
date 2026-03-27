"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface AddToCalendarDropdownProps {
    bookingId: string;
}

interface BookingData {
    sport: string;
    scheduled_at: string;
    duration_minutes: number;
    address: string | null;
    athlete: { first_name: string; last_name: string };
    trainer: { first_name: string; last_name: string };
}

export function AddToCalendarDropdown({ bookingId }: AddToCalendarDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    async function fetchBookingData(): Promise<BookingData | null> {
        const { data: booking } = await supabase
            .from("bookings")
            .select("sport, scheduled_at, duration_minutes, address, athlete_id, trainer_id")
            .eq("id", bookingId)
            .single();

        if (!booking) return null;

        const { data: users } = await supabase
            .from("users")
            .select("id, first_name, last_name")
            .in("id", [booking.athlete_id, booking.trainer_id]);

        const usersMap = new Map((users || []).map((u: any) => [u.id, u]));
        const athlete = usersMap.get(booking.athlete_id) || { first_name: "Athlete", last_name: "" };
        const trainer = usersMap.get(booking.trainer_id) || { first_name: "Trainer", last_name: "" };

        return {
            sport: booking.sport,
            scheduled_at: booking.scheduled_at,
            duration_minutes: booking.duration_minutes,
            address: booking.address,
            athlete: { first_name: athlete.first_name, last_name: athlete.last_name },
            trainer: { first_name: trainer.first_name, last_name: trainer.last_name },
        };
    }

    function capitalize(str: string) {
        return str.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }

    function generateGoogleCalendarUrl(booking: BookingData): string {
        const start = new Date(booking.scheduled_at);
        const end = new Date(start.getTime() + booking.duration_minutes * 60 * 1000);

        const formatDate = (d: Date) =>
            d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

        const sportName = capitalize(booking.sport);
        const params = new URLSearchParams({
            action: "TEMPLATE",
            text: `Training Session: ${sportName}`,
            dates: `${formatDate(start)}/${formatDate(end)}`,
            details: `${sportName} training session\nAthlete: ${booking.athlete.first_name} ${booking.athlete.last_name}\nTrainer: ${booking.trainer.first_name} ${booking.trainer.last_name}\n\nBooked via AirTrainr`,
        });

        if (booking.address) {
            params.set("location", booking.address);
        }

        return `https://calendar.google.com/calendar/render?${params.toString()}`;
    }

    function generateICSContent(booking: BookingData): string {
        const start = new Date(booking.scheduled_at);
        const end = new Date(start.getTime() + booking.duration_minutes * 60 * 1000);
        const sportName = capitalize(booking.sport);

        const pad = (n: number) => n.toString().padStart(2, "0");
        const formatICS = (d: Date) =>
            `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

        return [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//AirTrainr//BookingCalendar//EN",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            "BEGIN:VEVENT",
            `UID:booking-${bookingId}@airtrainr.com`,
            `DTSTART:${formatICS(start)}`,
            `DTEND:${formatICS(end)}`,
            `SUMMARY:Training Session: ${sportName}`,
            `DESCRIPTION:${sportName} training session\\nAthlete: ${booking.athlete.first_name} ${booking.athlete.last_name}\\nTrainer: ${booking.trainer.first_name} ${booking.trainer.last_name}`,
            booking.address ? `LOCATION:${booking.address}` : "",
            "STATUS:CONFIRMED",
            "BEGIN:VALARM",
            "TRIGGER:-PT1H",
            "ACTION:DISPLAY",
            "DESCRIPTION:Training session in 1 hour",
            "END:VALARM",
            "BEGIN:VALARM",
            "TRIGGER:-P1D",
            "ACTION:DISPLAY",
            "DESCRIPTION:Training session in 24 hours",
            "END:VALARM",
            "END:VEVENT",
            "END:VCALENDAR",
        ].filter(Boolean).join("\r\n");
    }

    async function handleGoogleCalendar() {
        setLoading("google");
        try {
            const booking = await fetchBookingData();
            if (!booking) return;
            const url = generateGoogleCalendarUrl(booking);
            window.open(url, "_blank", "noopener,noreferrer");
        } catch (err) {
            console.error("Failed to generate Google Calendar URL:", err);
        } finally {
            setLoading(null);
            setIsOpen(false);
        }
    }

    async function handleICSDownload() {
        setLoading("ics");
        try {
            const booking = await fetchBookingData();
            if (!booking) return;

            const icsContent = generateICSContent(booking);
            const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `training-${bookingId.slice(0, 8)}.ics`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Failed to download ICS file:", err);
        } finally {
            setLoading(null);
            setIsOpen(false);
        }
    }

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="
                    flex items-center gap-2
                    px-3.5 py-2
                    bg-white/5 border border-white/10
                    rounded-xl
                    text-sm font-semibold text-text-main/70
                    hover:bg-white/10 hover:text-text-main
                    transition-all duration-200
                "
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                Add to Calendar
                <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-[#1E2130] border border-white/15 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="p-1.5">
                        {/* Google Calendar */}
                        <button
                            onClick={handleGoogleCalendar}
                            disabled={loading === "google"}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm text-text-main/80 hover:bg-white/5 hover:text-text-main transition-all disabled:opacity-50"
                        >
                            <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <rect x="3" y="4" width="18" height="18" rx="2" stroke="#4285F4" strokeWidth="1.5" />
                                    <line x1="3" y1="10" x2="21" y2="10" stroke="#4285F4" strokeWidth="1.5" />
                                    <line x1="9" y1="4" x2="9" y2="22" stroke="#4285F4" strokeWidth="1.5" opacity="0.3" />
                                    <line x1="15" y1="4" x2="15" y2="22" stroke="#4285F4" strokeWidth="1.5" opacity="0.3" />
                                </svg>
                            </span>
                            <div>
                                <p className="font-semibold">Google Calendar</p>
                                <p className="text-xs text-text-main/40">Opens in a new tab</p>
                            </div>
                            {loading === "google" && (
                                <div className="ml-auto w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            )}
                        </button>

                        {/* Apple / Outlook (.ics) */}
                        <button
                            onClick={handleICSDownload}
                            disabled={loading === "ics"}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm text-text-main/80 hover:bg-white/5 hover:text-text-main transition-all disabled:opacity-50"
                        >
                            <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                            </span>
                            <div>
                                <p className="font-semibold">Apple / Outlook</p>
                                <p className="text-xs text-text-main/40">Download .ics file</p>
                            </div>
                            {loading === "ics" && (
                                <div className="ml-auto w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

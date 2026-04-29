"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase, TrainerProfileRow } from "@/lib/supabase";
import { apiFetch } from "@/lib/api-fetch";
import { Star, MapPin, MessageSquare, BadgeCheck, ChevronLeft, ChevronRight, Trophy, Calendar as CalendarIcon, Clock, Sparkles, Award, Quote, ShieldCheck, Zap } from "lucide-react";
import { ReviewSection } from "@/components/trainers/ReviewSection";
import { FoundingBadgeTooltip } from "@/components/ui/FoundingBadge";
import { toast } from "@/components/ui/Toast";
import { formatSportName } from "@/lib/format";
import { normalizeSessionPricing, priceFor, enabledDurations } from "@/lib/session-pricing";
import { trainerPublicGate, publicGateAthleteMessage } from "@/lib/trainer-gate";

type Review = {
    id: string;
    reviewer_id: string;
    rating: number;
    review_text: string | null;
    created_at: string;
    reviewer: { first_name: string; last_name: string; avatar_url: string | null };
};

type TrainerWithUser = TrainerProfileRow & {
    user: { first_name: string; last_name: string; avatar_url: string | null };
    avg_rating: number;
    review_count: number;
    sessions_count: number;
    cover_image: string;
    recent_reviews: Review[];
    dispute_count: number;
    is_performance_verified: boolean;
};

type AvailabilitySlot = {
    id: string;
    start_time: string;
    end_time: string;
};

// Sports-specific wide images (NO GYM IMAGES to align with user's feedback)
const SPORT_COVERS: Record<string, string[]> = {
    tennis: [
        "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=1600&auto=format&fit=crop&q=80"
    ],
    soccer: [
        "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=1600&auto=format&fit=crop&q=80"
    ],
    basketball: [
        "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1600&auto=format&fit=crop&q=80"
    ],
    swimming: [
        "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=1600&auto=format&fit=crop&q=80"
    ],
    track_and_field: [
        "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1600&auto=format&fit=crop&q=80"
    ],
    hockey: [
        "https://images.unsplash.com/photo-1580748141549-71748dbe0bdc?w=1600&auto=format&fit=crop&q=80"
    ],
    golf: [
        "https://images.unsplash.com/photo-1535139262971-c51845709a48?w=1600&auto=format&fit=crop&q=80"
    ],
    martial_arts: [
        "https://images.unsplash.com/photo-1555597673-b21d5c935865?w=1600&auto=format&fit=crop&q=80"
    ],
    default: [
        "https://images.unsplash.com/photo-1526676037777-05a232554f77?w=1600&auto=format&fit=crop&q=80" // Stadium/track
    ]
};

/** Returns true if the Supabase error indicates the table does not exist. */
function isTableMissingError(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const e = err as Record<string, unknown>;
    const code = e.code as string | undefined;
    const msg = (e.message as string | undefined) ?? "";
    return code === "42P01" || msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("relation");
}

const getSportCover = (sports: string[]) => {
    if (!sports || sports.length === 0) return SPORT_COVERS.default[0];
    const sportStr = sports[0].toLowerCase().replace(/\s+&\s+/g, "_and_").replace(/\s+/g, "_");
    const arr = SPORT_COVERS[sportStr] || SPORT_COVERS.default;
    return arr[Math.floor(Math.random() * arr.length)];
};

const SPORT_LABELS: Record<string, string> = {
    hockey: "Hockey", baseball: "Baseball", basketball: "Basketball",
    football: "Football", soccer: "Soccer", tennis: "Tennis",
    golf: "Golf", swimming: "Swimming", track_and_field: "Track & Field",
    crossfit: "CrossFit", functional_mobility: "Functional Mobility",
    strength_conditioning: "Strength & Conditioning"
};



export default function BookTrainerPage() {
    const params = useParams();
    const router = useRouter();
    const trainerId = params.id as string;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [user, setUser] = useState<AuthUser | null>(null);
    const [trainer, setTrainer] = useState<TrainerWithUser | null>(null);
    const sessionPricing = useMemo(
        () => normalizeSessionPricing(trainer?.session_pricing ?? null, trainer?.hourly_rate),
        [trainer?.session_pricing, trainer?.hourly_rate]
    );
    const offeredDurations = useMemo(() => enabledDurations(sessionPricing), [sessionPricing]);
    const [trainerProfileId, setTrainerProfileId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState<string | null>(null);
    const [gateBlocked, setGateBlocked] = useState(false);
    const [gateMessage, setGateMessage] = useState<string>("");
    const [processing, setProcessing] = useState(false);
    const warning = toast.warning;
    const toastError = toast.error;
    const success = toast.success;

    // Available dates for calendar green highlights (date string → slot count)
    const [availableDates, setAvailableDates] = useState<Map<string, number>>(new Map());

    // Date generation state
    const [currentMonthDate, setCurrentMonthDate] = useState(new Date());

    const dates = useMemo(() => {
        const year = currentMonthDate.getFullYear();
        const month = currentMonthDate.getMonth();

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        const firstDayWeekday = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)

        const daysInPrevMonth = firstDayWeekday;
        const daysInMonth = lastDayOfMonth.getDate();

        const totalCells = Math.ceil((daysInPrevMonth + daysInMonth) / 7) * 7;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return Array.from({ length: totalCells }).map((_, i) => {
            const d = new Date(year, month, 1 - daysInPrevMonth + i);
            const isCurrentMonth = d.getMonth() === month;
            const isPastDate = d < today;

            const formatLocalDate = (date: Date) => {
                const yyyy = date.getFullYear();
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const dd = String(date.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            };

            return {
                fullDate: formatLocalDate(d),
                date: d.getDate(),
                isCurrentMonth,
                isPastDate
            };
        });
    }, [currentMonthDate]);

    const displayMonth = `${currentMonthDate.toLocaleDateString("en-US", { month: "long" })} ${currentMonthDate.getFullYear()}`;

    const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

    // Booking Form State
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    });
    const [selectedTime, setSelectedTime] = useState<string>("");
    const [selectedSport, setSelectedSport] = useState<string>("");
    const [slots, setSlots] = useState<string[]>([]);
    const [rawSlotCount, setRawSlotCount] = useState(0);
    const [maxSlotMinutes, setMaxSlotMinutes] = useState(0);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [durationMinutes, setDurationMinutes] = useState(60);
    const [selectedLocation, setSelectedLocation] = useState('');
    const [platformFeePct, setPlatformFeePct] = useState<number>(3);

    useEffect(() => {
        const session = getSession();
        if (!session) {
            router.push("/auth/login");
            return;
        }
        setUser(session);
        if (trainerId) loadTrainer();
        // Load platform fee % for the fee breakdown preview
        (async () => {
            const { data: s } = await supabase
                .from("platform_settings")
                .select("platform_fee_percentage")
                .maybeSingle();
            if (s?.platform_fee_percentage != null) {
                setPlatformFeePct(Number(s.platform_fee_percentage));
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trainerId, router]);

    // Fetch availability slots when date, trainerProfileId, or durationMinutes changes
    useEffect(() => {
        if (trainerProfileId && selectedDate) {
            loadAvailability(selectedDate, undefined, durationMinutes);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trainerProfileId, selectedDate, durationMinutes]);

    // Load available dates for calendar green highlights (next 60 days)
    useEffect(() => {
        if (!trainerProfileId || !trainer) return;
        const loadAvailableDates = async () => {
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const endWindow = new Date(today);
                endWindow.setDate(endWindow.getDate() + 60);

                const formatDate = (d: Date) => {
                    const yyyy = d.getFullYear();
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    return `${yyyy}-${mm}-${dd}`;
                };

                // 1. Fetch non-blocked availability_slots for this trainer
                const { data: slotsData, error: slotsErr } = await supabase
                    .from("availability_slots")
                    .select("day_of_week, start_time, end_time")
                    .eq("trainer_id", trainerProfileId)
                    .eq("is_blocked", false);

                if (slotsErr) throw slotsErr;

                // Build map: day_of_week → count of slots
                const slotsByDow = new Map<number, number>();
                (slotsData || []).forEach((s: { day_of_week: number }) => {
                    slotsByDow.set(s.day_of_week, (slotsByDow.get(s.day_of_week) || 0) + 1);
                });

                // 2. Try to fetch recurring availability (table may not exist yet)
                let recurringByDow = new Map<number, number>();
                try {
                    const { data: recurringData, error: recurringErr } = await supabase
                        .from("availability_recurring")
                        .select("day_of_week, start_time, end_time")
                        .eq("trainer_id", trainerProfileId)
                        .eq("is_active", true);

                    if (recurringErr) {
                        // Any error (missing table, missing RLS policy, network, etc.) — silently skip.
                        // Recurring availability is an enhancement; per-slot logic below still works.
                        if (!isTableMissingError(recurringErr)) {
                            console.warn("[calendar] recurring availability unavailable, falling back to per-slot only");
                        }
                    } else {
                        (recurringData || []).forEach((r: { day_of_week: number }) => {
                            recurringByDow.set(r.day_of_week, (recurringByDow.get(r.day_of_week) || 0) + 1);
                        });
                    }
                } catch {
                    // Fully silent: recurring availability is optional enhancement
                }

                // 3. Expand dates in the 60-day window that have at least one slot
                const dateSlotCounts = new Map<string, number>();
                for (let d = new Date(today); d <= endWindow; d.setDate(d.getDate() + 1)) {
                    const dow = d.getDay();
                    const slotsCount = (slotsByDow.get(dow) || 0) + (recurringByDow.get(dow) || 0);
                    if (slotsCount > 0) {
                        dateSlotCounts.set(formatDate(d), slotsCount);
                    }
                }

                // 4. Subtract fully-booked dates
                const trainerUserId = trainer.user_id;
                if (trainerUserId && dateSlotCounts.size > 0) {
                    const windowStart = new Date(today).toISOString();
                    const windowEnd = new Date(endWindow).toISOString();

                    const { data: bookingsData } = await supabase
                        .from("bookings")
                        .select("scheduled_at")
                        .eq("trainer_id", trainerUserId)
                        .in("status", ["pending", "confirmed"])
                        .gte("scheduled_at", windowStart)
                        .lte("scheduled_at", windowEnd);

                    // Count bookings per date
                    const bookingsByDate = new Map<string, number>();
                    (bookingsData || []).forEach((b: { scheduled_at: string }) => {
                        const bd = new Date(b.scheduled_at);
                        const dateStr = formatDate(bd);
                        bookingsByDate.set(dateStr, (bookingsByDate.get(dateStr) || 0) + 1);
                    });

                    // Remove dates where all slots are booked
                    for (const [dateStr, totalSlots] of dateSlotCounts) {
                        const booked = bookingsByDate.get(dateStr) || 0;
                        if (booked >= totalSlots) {
                            dateSlotCounts.delete(dateStr);
                        } else {
                            dateSlotCounts.set(dateStr, totalSlots - booked);
                        }
                    }
                }

                setAvailableDates(dateSlotCounts);
            } catch (err) {
                console.error("Failed to load available dates for calendar:", err);
            }
        };
        loadAvailableDates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trainerProfileId, trainer?.user_id]);

    const formatTimeTo12h = (time24: string) => {
        const [hours, minutes] = time24.split(':');
        let h = parseInt(hours, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12; // the hour '0' should be '12'
        return `${h.toString().padStart(2, '0')}:${minutes} ${ampm}`;
    };

    const loadAvailability = async (dateStr: string, profileId?: string, duration?: number) => {
        setSlotsLoading(true);
        try {
            // availability_slots stores trainer_id as trainer_profiles.id (not users.id)
            const slotTrainerId = profileId || trainerProfileId;
            if (!slotTrainerId) return;

            const date = new Date(dateStr + "T00:00:00");
            const dayOfWeek = date.getDay();

            // Fetch per-slot availability for this day
            const { data, error } = await supabase
                .from("availability_slots")
                .select("start_time, end_time")
                .eq("trainer_id", slotTrainerId)
                .eq("day_of_week", dayOfWeek)
                .eq("is_blocked", false)
                .order("start_time");

            if (error) throw error;

            // Also fetch recurring availability for this day of week
            let recurringSlots: { start_time: string; end_time: string }[] = [];
            try {
                const { data: recurData, error: recurErr } = await supabase
                    .from("availability_recurring")
                    .select("start_time, end_time, is_active")
                    .eq("trainer_id", slotTrainerId)
                    .eq("day_of_week", dayOfWeek)
                    .eq("is_active", true);

                if (!recurErr && recurData?.length) {
                    const activeDur = duration ?? durationMinutes;
                    recurData.forEach((r: { start_time: string; end_time: string }) => {
                        const startMins = parseInt(r.start_time.split(":")[0]) * 60 + parseInt(r.start_time.split(":")[1]);
                        const endMins = parseInt(r.end_time.split(":")[0]) * 60 + parseInt(r.end_time.split(":")[1]);
                        for (let t = startMins; t + activeDur <= endMins; t += activeDur) {
                            const sh = String(Math.floor(t / 60)).padStart(2, "0");
                            const sm = String(t % 60).padStart(2, "0");
                            const eh = String(Math.floor((t + activeDur) / 60)).padStart(2, "0");
                            const em = String((t + activeDur) % 60).padStart(2, "0");
                            recurringSlots.push({ start_time: `${sh}:${sm}`, end_time: `${eh}:${em}` });
                        }
                    });
                }
            } catch {
                // Recurring table may not exist — silently ignore
            }

            // Merge per-slot + recurring, deduplicate by start_time
            const allSlots = [...(data || [])];
            const existingStarts = new Set(allSlots.map(s => s.start_time.slice(0, 5)));
            recurringSlots.forEach(rs => {
                if (!existingStarts.has(rs.start_time)) {
                    allSlots.push(rs);
                    existingStarts.add(rs.start_time);
                }
            });
            allSlots.sort((a, b) => a.start_time.localeCompare(b.start_time));

            // Fetch already-booked times for this trainer on this date
            const dayStart = new Date(dateStr + "T00:00:00").toISOString();
            const dayEnd = new Date(dateStr + "T23:59:59").toISOString();

            // We need the trainer's users.id to query bookings — use the trainer state if loaded, otherwise skip
            let trainerUserId: string | null = null;
            if (trainer?.user_id) {
                trainerUserId = trainer.user_id;
            } else {
                // Look up user_id from profile id
                const { data: prof } = await supabase
                    .from("trainer_profiles")
                    .select("user_id")
                    .eq("id", slotTrainerId)
                    .maybeSingle();
                trainerUserId = prof?.user_id || null;
            }

            let bookedStartTimes: Set<string> = new Set();
            if (trainerUserId) {
                const { data: existingBookings } = await supabase
                    .from("bookings")
                    .select("scheduled_at, duration_minutes")
                    .eq("trainer_id", trainerUserId)
                    .in("status", ["pending", "confirmed", "reschedule_requested"])
                    .gte("scheduled_at", dayStart)
                    .lte("scheduled_at", dayEnd);

                // Build set of booked start times in "HH:MM" format (24h)
                (existingBookings || []).forEach((b: any) => {
                    const d = new Date(b.scheduled_at);
                    const hh = d.getHours().toString().padStart(2, "0");
                    const mm = d.getMinutes().toString().padStart(2, "0");
                    bookedStartTimes.add(`${hh}:${mm}`);
                });
            }

            // Track unfiltered slots so we can show a meaningful message if duration mismatch zeroes them out.
            const unbookedSlots = allSlots.filter(s => !bookedStartTimes.has(s.start_time.slice(0, 5)));
            setRawSlotCount(unbookedSlots.length);
            const longestSlot = unbookedSlots.reduce((max, s) => {
                const [sh, sm] = s.start_time.split(':').map(Number);
                const [eh, em] = s.end_time.split(':').map(Number);
                const dur = (eh * 60 + em) - (sh * 60 + sm);
                return dur > max ? dur : max;
            }, 0);
            setMaxSlotMinutes(longestSlot);

            // Filter out booked slots and slots too short for selected duration
            const activeDuration = duration ?? durationMinutes;
            const availableSlots = unbookedSlots.filter(s => {
                const [sh, sm] = s.start_time.split(':').map(Number);
                const [eh, em] = s.end_time.split(':').map(Number);
                const slotDuration = (eh * 60 + em) - (sh * 60 + sm);
                return slotDuration >= activeDuration;
            });

            const formattedSlots = availableSlots.map(s => formatTimeTo12h(s.start_time));
            setSlots(formattedSlots);

            // Clear selected time if it's no longer available
            if (selectedTime && !formattedSlots.includes(selectedTime)) {
                setSelectedTime("");
            }
        } catch (err) {
            console.error("Failed to load availability:", err);
        } finally {
            setSlotsLoading(false);
        }
    };

    const loadTrainer = async () => {
        try {
            // trainerId may be the trainer_profiles.id OR users.id (user_id)
            // Try user_id first (used when linking from bookings), then fall back to profile id
            let { data: profile } = await supabase
                .from("trainer_profiles")
                .select("*")
                .eq("user_id", trainerId)
                .maybeSingle();

            if (!profile) {
                // Fall back: maybe it's the trainer_profiles.id
                const { data: profileById } = await supabase
                    .from("trainer_profiles")
                    .select("*")
                    .eq("id", trainerId)
                    .maybeSingle();
                profile = profileById;
            }

            if (!profile) throw new Error("Trainer not found");

            // Store trainer_profiles.id (used for availability_slots queries)
            setTrainerProfileId(profile.id);

            const { data: userData } = await supabase
                .from("users")
                .select("id, first_name, last_name, avatar_url, is_suspended, deleted_at, phone, date_of_birth")
                .eq("id", profile.user_id)
                .single();

            // Public-visibility gate: ONLY athletes get blocked. Trainers viewing their
            // own profile get a preview pass-through (so they can see what their public
            // page WILL look like once everything is in order).
            const session = getSession();
            const isSelfView = !!session && session.id === profile.user_id;
            if (!isSelfView) {
                const gateResult = trainerPublicGate({
                    user: userData as any,
                    trainerProfile: profile as any,
                });
                if (!gateResult.ok) {
                    setGateBlocked(true);
                    setGateMessage(publicGateAthleteMessage(gateResult));
                    setLoading(false);
                    return;
                }
            }

            const { data: reviewsData } = await supabase
                .from("reviews")
                .select(`
                    id,
                    reviewer_id,
                    rating,
                    review_text,
                    created_at,
                    reviewer:users!reviews_reviewer_id_fkey (
                        first_name,
                        last_name,
                        avatar_url
                    )
                `)
                .eq("reviewee_id", profile.user_id)
                .order("created_at", { ascending: false })
                .limit(5);

            const { count: bookingsCount } = await supabase
                .from("bookings")
                .select("id", { count: "exact", head: true })
                .eq("trainer_id", profile.user_id)
                .eq("status", "completed");

            // Re-fetching dispute count more reliably via join
            const { data: disputesData } = await supabase
                .from("disputes")
                .select("id, booking:bookings!inner(trainer_id)")
                .eq("booking.trainer_id", profile.user_id);

            const finalDisputeCount = (disputesData || []).length;

            const isPerformanceVerified =
                (bookingsCount || 0) >= 3 &&
                finalDisputeCount === 0 &&
                Number(profile.completion_rate) >= 95 &&
                Number(profile.reliability_score) >= 95;

            setTrainer({
                ...profile,
                user: userData as TrainerWithUser["user"],
                avg_rating: profile.average_rating || 0,
                review_count: profile.total_reviews || 0,
                sessions_count: bookingsCount || 0,
                cover_image: (profile.banner_url as string | null) || getSportCover(profile.sports),
                recent_reviews: (reviewsData || []) as unknown as Review[],
                dispute_count: finalDisputeCount,
                is_performance_verified: isPerformanceVerified
            });

            // Set default duration from session_pricing (sessions, not camps).
            // Falls back to legacy session_lengths if pricing column missing.
            const profilePricing = normalizeSessionPricing(profile.session_pricing ?? null, profile.hourly_rate);
            const profileEnabled = enabledDurations(profilePricing);
            let defaultDuration = profileEnabled[0] ?? 60;
            setDurationMinutes(defaultDuration);
            if (profile.training_locations?.length) {
                setSelectedLocation(profile.training_locations[0]);
            }

            // Load availability now that we have profile.id
            loadAvailability(selectedDate, profile.id, defaultDuration);
        } catch (err) {
            console.error(err);
            setPageError("Trainer not found or failed to load.");
        } finally {
            setLoading(false);
        }
    };

    const handleBook = async () => {
        if (!user || !trainer) return;

        // Block trainer from booking their own profile
        if (user.id === trainer.user_id) {
            warning("Cannot Book Yourself", "You cannot book a session with your own profile.");
            return;
        }

        if (!selectedSport) {
            warning("Select a Sport", "Please choose a sport before booking.");
            return;
        }
        if (trainer?.training_locations?.length > 0 && !selectedLocation) {
            warning("Select Location", "Please select a training location.");
            return;
        }
        if (!selectedTime) {
            warning("Select a Time Slot", "Please choose an available time slot.");
            return;
        }

        // Block past time slot bookings
        const [chkTime, chkMod] = selectedTime.split(" ");
        const [chkH, chkM] = chkTime.split(":");
        let chkHrs = parseInt(chkH, 10);
        if (chkMod === "PM" && chkHrs < 12) chkHrs += 12;
        if (chkMod === "AM" && chkHrs === 12) chkHrs = 0;
        const checkDate = new Date(`${selectedDate}T${chkHrs.toString().padStart(2, "0")}:${chkM}:00`);
        if (checkDate <= new Date()) {
            warning("Past Time Slot", "Please select a future date and time.");
            return;
        }

        setProcessing(true);

        try {
            // Form timestamp
            // e.g. selectedDate = "2023-10-25", selectedTime = "08:00 AM"
            const [timeStr, modifier] = selectedTime.split(" ");
            const [hours, minutes] = timeStr.split(":");
            let hrs = parseInt(hours, 10);
            if (modifier === "PM" && hrs < 12) hrs += 12;
            if (modifier === "AM" && hrs === 12) hrs = 0;

            const scheduledAt = new Date(`${selectedDate}T${hrs.toString().padStart(2, "0")}:${minutes}:00`);

            // Server (POST /api/booking/create) handles: ownership/auth, self-booking
            // block, double-booking overlap check, price recompute (session +
            // platform + Stripe + tax) and inserts the row. Keep client logic
            // minimal — just submit the intent.
            const res = await apiFetch("/api/booking/create", {
                method: "POST",
                body: JSON.stringify({
                    trainerId: trainer.user_id,
                    sport: selectedSport,
                    scheduledAt: scheduledAt.toISOString(),
                    durationMinutes,
                    trainingLocation: selectedLocation || null,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "Booking failed");
            success("Booking Requested!", "Your session request has been sent to the trainer.");
            setTimeout(() => router.push("/dashboard/bookings"), 1200);
        } catch (error) {
            console.error("Booking failed:", error);
            const msg = error instanceof Error ? error.message : "Something went wrong. Please try again.";
            toastError("Booking Failed", msg);
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[60vh]">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    if (gateBlocked) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6">
                <div className="max-w-md w-full text-center rounded-3xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-8 sm:p-10">
                    <h2 className="text-xl sm:text-2xl font-black text-text-main mb-3" style={{ fontFamily: "var(--font-display)" }}>
                        Not available right now
                    </h2>
                    <p className="text-text-main/60 font-semibold text-sm sm:text-base mb-6">
                        {gateMessage || "This trainer isn't accepting bookings right now."}
                    </p>
                    <button
                        onClick={() => router.back()}
                        className="px-5 py-2.5 rounded-xl bg-primary/15 border border-primary/30 text-primary text-sm font-black uppercase tracking-[0.12em] hover:bg-primary/25 transition-all"
                    >
                        Back
                    </button>
                </div>
            </div>
        );
    }

    if (pageError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <p className="text-text-main/50 font-semibold">{pageError}</p>
                <button onClick={() => router.back()} className="px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-text-main/70 text-sm font-bold hover:bg-white/[0.10] transition-all">Go Back</button>
            </div>
        );
    }

    if (!trainer) {
        return <div className="text-text-main text-center mt-20 text-xl font-bold">Trainer not found</div>;
    }

    // Check if a time slot is in the past for the selected date
    const isSlotInPast = (time: string) => {
        const [timeStr, modifier] = time.split(" ");
        const [hours, minutes] = timeStr.split(":");
        let hrs = parseInt(hours, 10);
        if (modifier === "PM" && hrs < 12) hrs += 12;
        if (modifier === "AM" && hrs === 12) hrs = 0;

        const slotDate = new Date(`${selectedDate}T${hrs.toString().padStart(2, "0")}:${minutes}:00`);
        return slotDate <= new Date();
    };

    return (
        <>
        <div className="max-w-[1280px] mx-auto pb-20 px-2 sm:px-4 md:px-8 mt-4">
            {/* Back link — inline, sits above cover so it never overlaps the image */}
            <button
                onClick={() => router.back()}
                className="mb-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.16] text-text-main/70 hover:text-text-main transition-all text-xs font-semibold group"
            >
                <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                Back to Search
            </button>

            {/* Cover Banner — depth via parallax-like layered gradients + radial glow */}
            <div className="w-full h-[220px] sm:h-[360px] rounded-2xl sm:rounded-[32px] overflow-hidden relative mb-16 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.06]">
                <div
                    className="absolute inset-0 bg-cover bg-center scale-105"
                    style={{ backgroundImage: `url(${trainer.cover_image})` }}
                />
                {/* Vignette + bottom fade */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F1115] via-[#0F1115]/40 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0F1115]/60 via-transparent to-[#0F1115]/40" />
                {/* Soft primary glow blob */}
                <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

                {/* Floating verification pill (top-right of cover) */}
                {trainer.is_performance_verified && (
                    <div className="absolute top-4 right-4 sm:top-5 sm:right-5 z-10 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-primary/40 text-primary text-[10px] font-black uppercase tracking-[0.15em] shadow-lg whitespace-nowrap">
                        <ShieldCheck size={12} className="fill-primary/20 shrink-0" />
                        Verified Performance
                    </div>
                )}
            </div>

            {/* Profile Header — Avatar with glow ring + name block */}
            <div className="flex flex-col md:flex-row items-start md:items-end gap-5 sm:gap-7 px-2 sm:px-4 md:px-12 -mt-16 sm:-mt-32 md:-mt-40 relative z-10 mb-6">
                {/* Avatar with soft glow ring */}
                <div className="relative group">
                    {/* Outer glow halo */}
                    <div className="absolute inset-0 rounded-[20px] sm:rounded-[28px] bg-gradient-to-br from-primary/40 via-primary/10 to-transparent blur-xl opacity-70 group-hover:opacity-100 transition-opacity" />
                    {/* Ring layer */}
                    <div className="relative rounded-[20px] sm:rounded-[28px] p-[2px] bg-gradient-to-br from-primary/60 via-white/10 to-transparent shadow-[0_20px_40px_-10px_rgba(0,0,0,0.6)]">
                        <div className="w-28 h-28 sm:w-44 sm:h-44 rounded-[18px] sm:rounded-[26px] border-[3px] sm:border-[5px] border-[#0F1115] overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900 ring-2 ring-primary/30">
                            {trainer.user?.avatar_url ? (
                                <img src={trainer.user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-5xl font-black text-text-main bg-gradient-to-br from-indigo-500 via-purple-700 to-fuchsia-800">
                                    {trainer.user?.first_name?.[0]}{trainer.user?.last_name?.[0]}
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Verification checkmark */}
                    {trainer.is_performance_verified && (
                        <div className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 bg-gradient-to-br from-primary to-cyan-400 rounded-full p-1.5 border-[3px] sm:border-[4px] border-[#0F1115] shadow-[0_0_20px_rgba(69,208,255,0.6)]">
                            <BadgeCheck size={18} className="text-bg" />
                        </div>
                    )}
                </div>

                {/* Name & meta */}
                <div className="pb-1 sm:pb-3 flex-1 min-w-0">
                    {/* Status tag above name */}
                    <div className="mb-2 flex items-center gap-2 flex-wrap">
                        {trainer.is_performance_verified ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-[0.15em]">
                                <Sparkles size={10} /> Verified Performance
                            </span>
                        ) : trainer.sessions_count > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-400/10 border border-blue-400/30 text-blue-300 text-[10px] font-black uppercase tracking-[0.15em]">
                                <Zap size={10} /> Pro Trainer
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase tracking-[0.15em]">
                                <Sparkles size={10} /> New Trainer
                            </span>
                        )}
                    </div>
                    <h1
                        className="text-3xl sm:text-5xl md:text-6xl font-black text-text-main tracking-tight mb-2 flex items-center gap-3 flex-wrap leading-[1.05]"
                        style={{ fontFamily: "var(--font-display)" }}
                    >
                        {trainer.user?.first_name} {trainer.user?.last_name}
                        {trainer.is_founding_50 && <FoundingBadgeTooltip size={36} />}
                    </h1>
                    {trainer.city && (
                        <div className="flex items-center gap-1.5 text-text-main/60 text-sm font-semibold">
                            <MapPin size={14} className="text-primary/70" />
                            {trainer.city}{trainer.state ? `, ${trainer.state}` : ""}
                        </div>
                    )}
                </div>
            </div>

            {/* Sport pills — premium chips with gradient borders + hover lift */}
            <div className="px-2 sm:px-4 md:px-12 flex flex-wrap gap-2 sm:gap-3 mb-6 sm:mb-10">
                {trainer.sports.map((sport, i) => (
                    <span
                        key={i}
                        className="group relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.12em] text-text-main/85 bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.08] hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-8px_rgba(69,208,255,0.4)] transition-all duration-200 backdrop-blur-sm"
                    >
                        <Trophy size={11} className="text-primary/80 group-hover:text-primary transition-colors" />
                        {SPORT_LABELS[sport] || formatSportName(sport)}
                    </span>
                ))}
            </div>

            {/* Main Content Stack */}
            <div className="flex flex-col gap-8 sm:gap-12 px-2 sm:px-4 md:px-12 max-w-[850px] mx-auto">

                {/* Content */}
                <div className="flex flex-col gap-12">

                    {/* Stats — bento grid with glass cards + gradient highlights */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-4">
                        {/* Rating */}
                        <div className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-400/[0.08] via-white/[0.03] to-white/[0.01] border border-white/[0.07] hover:border-amber-300/30 transition-all p-4 sm:p-6 backdrop-blur-sm">
                            <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-amber-300/10 blur-2xl group-hover:bg-amber-300/20 transition-colors" />
                            <div className="relative">
                                <div className="flex items-center gap-1.5 text-amber-300/90 mb-2">
                                    <Star size={14} className="fill-current" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.15em]">Rating</span>
                                </div>
                                <div
                                    className="text-3xl sm:text-4xl font-black text-text-main leading-none mb-1"
                                    style={{ fontFamily: "var(--font-display)" }}
                                >
                                    {Number(trainer.avg_rating).toFixed(1)}
                                </div>
                                <div className="text-[10px] text-text-main/40 font-bold uppercase tracking-widest">{trainer.review_count} reviews</div>
                            </div>
                        </div>

                        {/* Years Experience */}
                        <div className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary/[0.08] via-white/[0.03] to-white/[0.01] border border-white/[0.07] hover:border-primary/30 transition-all p-4 sm:p-6 backdrop-blur-sm">
                            <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-primary/10 blur-2xl group-hover:bg-primary/20 transition-colors" />
                            <div className="relative">
                                <div className="flex items-center gap-1.5 text-primary/90 mb-2">
                                    <Award size={14} />
                                    <span className="text-[10px] font-black uppercase tracking-[0.15em]">Experience</span>
                                </div>
                                <div
                                    className="text-3xl sm:text-4xl font-black text-text-main leading-none mb-1"
                                    style={{ fontFamily: "var(--font-display)" }}
                                >
                                    {Math.max(0, trainer.years_experience || 0)}+
                                </div>
                                <div className="text-[10px] text-text-main/40 font-bold uppercase tracking-widest">years</div>
                            </div>
                        </div>

                        {/* Sessions */}
                        <div className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-400/[0.08] via-white/[0.03] to-white/[0.01] border border-white/[0.07] hover:border-emerald-300/30 transition-all p-4 sm:p-6 backdrop-blur-sm">
                            <div className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-emerald-300/10 blur-2xl group-hover:bg-emerald-300/20 transition-colors" />
                            <div className="relative">
                                <div className="flex items-center gap-1.5 text-emerald-300/90 mb-2">
                                    <CalendarIcon size={14} />
                                    <span className="text-[10px] font-black uppercase tracking-[0.15em]">Sessions</span>
                                </div>
                                <div
                                    className="text-3xl sm:text-4xl font-black text-text-main leading-none mb-1"
                                    style={{ fontFamily: "var(--font-display)" }}
                                >
                                    {trainer.sessions_count >= 1000
                                        ? (trainer.sessions_count / 1000).toFixed(1) + "k"
                                        : trainer.sessions_count}
                                </div>
                                <div className="text-[10px] text-text-main/40 font-bold uppercase tracking-widest">completed</div>
                            </div>
                        </div>
                    </div>

                    {/* About — quoted treatment with left accent border */}
                    <div className="relative">
                        <h2 className="text-xl sm:text-2xl font-black text-text-main mb-5 flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                            <span className="w-1 h-6 rounded-full bg-gradient-to-b from-primary to-primary/0" />
                            About {trainer.user?.first_name}
                        </h2>
                        <div className="relative rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white/[0.04] via-white/[0.02] to-transparent border border-white/[0.07] p-5 sm:p-7 backdrop-blur-sm overflow-hidden">
                            <div className="absolute top-0 left-0 w-[3px] h-full bg-gradient-to-b from-primary via-primary/40 to-transparent" />
                            <Quote size={28} className="absolute top-4 right-5 text-primary/15" />
                            <p className="text-text-main/75 text-base sm:text-[17px] leading-relaxed font-medium relative">
                                {trainer.bio || `Specializing in high-performance athletic training and metabolic conditioning. My approach combines data-driven science with old-school grit to help you push past plateaus and redefine your physical limits. Whether you're an elite athlete or just starting your journey, we'll build a foundation of functional strength and explosive power.`}
                            </p>
                        </div>
                    </div>

                    {/* Experience & Certifications */}
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-text-main mb-5 flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                            <span className="w-1 h-6 rounded-full bg-gradient-to-b from-primary to-primary/0" />
                            Experience & Certifications
                        </h2>
                        {(() => {
                            const certs = Array.isArray(trainer.certifications) ? trainer.certifications as string[] : [];
                            return certs.length > 0 ? (
                                <div className="flex flex-wrap gap-2.5">
                                    {certs.map((cert, i) => (
                                        <span
                                            key={i}
                                            className="group inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.08] hover:border-primary/30 rounded-xl text-sm font-semibold text-text-main/85 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.5)] transition-all backdrop-blur-sm"
                                        >
                                            <BadgeCheck size={15} className="text-primary/80 group-hover:text-primary shrink-0 transition-colors" />
                                            {cert}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-text-main/40 text-sm font-medium">No certifications listed.</p>
                            );
                        })()}
                    </div>

                    {/* Session Lengths & Pricing */}
                    {offeredDurations.length > 0 && (
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-text-main mb-5 flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                                <span className="w-1 h-6 rounded-full bg-gradient-to-b from-primary to-primary/0" />
                                Session Lengths & Pricing
                            </h2>
                            <div className="flex flex-wrap gap-2.5">
                                {offeredDurations.map((d, i) => (
                                    <span
                                        key={i}
                                        className="inline-flex items-center gap-1.5 bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.08] hover:border-primary/30 text-text-main/85 px-4 py-2 rounded-full text-xs font-black uppercase tracking-[0.12em] hover:-translate-y-0.5 transition-all backdrop-blur-sm"
                                    >
                                        <Clock size={11} className="text-primary/80" />
                                        {d < 60 ? `${d} min` : '1 hr'}
                                        <span className="text-primary font-black">${(priceFor(sessionPricing, d) ?? 0).toFixed(0)}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Training Locations */}
                    {trainer.training_locations?.length > 0 && (
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-text-main mb-5 flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                                <span className="w-1 h-6 rounded-full bg-gradient-to-b from-primary to-primary/0" />
                                Training Locations
                            </h2>
                            <div className="flex flex-wrap gap-2.5">
                                {trainer.training_locations.map((loc, i) => (
                                    <span
                                        key={i}
                                        className="inline-flex items-center gap-1.5 bg-gradient-to-br from-white/[0.05] to-white/[0.02] border border-white/[0.08] hover:border-primary/30 text-text-main/85 px-4 py-2 rounded-full text-xs font-black uppercase tracking-[0.12em] hover:-translate-y-0.5 transition-all backdrop-blur-sm"
                                    >
                                        <MapPin size={11} className="text-primary/80" />
                                        {loc}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Reviews */}
                    <ReviewSection
                        reviews={trainer.recent_reviews}
                        totalCount={trainer.review_count}
                    />

                </div>

                {/* Booking Widget — premium glass card */}
                <div className="w-full">
                    <div className="relative overflow-hidden bg-gradient-to-b from-[#15171D] to-[#0F1115] border border-white/[0.08] rounded-[24px] sm:rounded-[32px] p-4 sm:p-8 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl">
                        {/* Subtle ambient glow */}
                        <div className="absolute -top-32 -right-32 w-72 h-72 rounded-full bg-primary/[0.06] blur-3xl pointer-events-none" />
                        <div className="absolute -bottom-40 -left-32 w-80 h-80 rounded-full bg-indigo-500/[0.05] blur-3xl pointer-events-none" />

                        {/* Price & Rating */}
                        <div className="relative flex justify-between items-start mb-8 pb-8 border-b border-white/[0.06]">
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-text-main/40 mb-1.5">Starting at</div>
                                <div className="flex items-baseline gap-1.5">
                                    <span
                                        className="text-[44px] sm:text-[52px] font-black text-white leading-none bg-gradient-to-br from-white to-white/70 bg-clip-text"
                                        style={{ fontFamily: "var(--font-display)" }}
                                    >
                                        ${(priceFor(sessionPricing, durationMinutes) ?? 0).toFixed(0)}
                                    </span>
                                    <span className="text-zinc-400 text-xs ml-1 font-semibold">
                                        / {durationMinutes < 60 ? `${durationMinutes}min` : `${durationMinutes / 60}hr`}
                                    </span>
                                </div>
                            </div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-300/10 border border-amber-300/30 text-amber-300 text-[13px] font-black mt-2">
                                <Star size={14} className="fill-current" /> {Number(trainer.avg_rating).toFixed(1)}
                            </div>
                        </div>

                        {/* Date Picker */}
                        <div className="mb-10">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-white font-black text-[15px] tracking-wide">Select Date</h3>
                                <div className="flex items-center gap-1.5 bg-[#12141A] rounded-full border border-white/5 py-1 px-1.5 h-auto">
                                    <button
                                        onClick={() => {
                                            const newDate = new Date(currentMonthDate);
                                            newDate.setMonth(newDate.getMonth() - 1);
                                            setCurrentMonthDate(newDate);
                                        }}
                                        className="w-7 h-7 flex items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    >
                                        <ChevronLeft size={16} strokeWidth={3} />
                                    </button>
                                    <div className="text-[11px] font-black tracking-[0.1em] text-white uppercase min-w-[100px] text-center">
                                        {displayMonth}
                                    </div>
                                    <button
                                        onClick={() => {
                                            const newDate = new Date(currentMonthDate);
                                            newDate.setMonth(newDate.getMonth() + 1);
                                            setCurrentMonthDate(newDate);
                                        }}
                                        className="w-7 h-7 flex items-center justify-center rounded-full text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                                    >
                                        <ChevronRight size={16} strokeWidth={3} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-7 gap-y-2 gap-x-1 sm:gap-y-3 sm:gap-x-2">
                                {/* Days of week header */}
                                {WEEKDAYS.map((day, i) => (
                                    <div key={`col-${i}`} className="flex flex-col items-center mb-1">
                                        <div className="text-[10px] text-text-main/40 font-bold uppercase tracking-wider h-4 flex items-center justify-center">
                                            {day}
                                        </div>
                                    </div>
                                ))}

                                {/* Dates */}
                                {dates.map((d, i) => {
                                    const slotCount = availableDates.get(d.fullDate) || 0;
                                    const hasAvailability = slotCount > 0 && !d.isPastDate;
                                    const isSelected = selectedDate === d.fullDate && !d.isPastDate;
                                    return (
                                    <div key={`date-${d.fullDate}-${i}`} className="flex justify-center">
                                        <button
                                            onClick={() => {
                                                if (!d.isPastDate) {
                                                    setSelectedDate(d.fullDate);
                                                }
                                            }}
                                            disabled={d.isPastDate}
                                            title={hasAvailability ? `${slotCount} slot${slotCount !== 1 ? 's' : ''} available` : undefined}
                                            className={`w-8 h-8 sm:w-9 sm:h-10 rounded-[8px] sm:rounded-[10px] text-xs sm:text-sm font-black flex items-center justify-center transition-all duration-200
                                                ${!d.isCurrentMonth ? "opacity-30" : ""}
                                                ${d.isPastDate ? "opacity-20 cursor-not-allowed" : ""}
                                                ${isSelected
                                                    ? "bg-primary text-bg shadow-[0_4px_12px_rgba(69,208,255,0.3)] scale-105"
                                                    : hasAvailability && !isSelected
                                                        ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 hover:-translate-y-0.5"
                                                        : !d.isPastDate ? "text-white hover:bg-white/5 hover:-translate-y-0.5" : "text-white"}`}
                                        >
                                            {d.date}
                                        </button>
                                    </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Sport Selection */}
                        <div className="mb-10">
                            <h4 className="text-[10px] text-text-main/40 font-bold uppercase tracking-[0.15em] mb-3">Select Sport</h4>
                            <div className="flex flex-wrap gap-2">
                                {[...new Set(trainer.sports)].map(sport => (
                                    <button
                                        key={sport}
                                        onClick={() => setSelectedSport(sport)}
                                        className={`inline-flex items-center px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all border ${
                                            selectedSport === sport
                                                ? "bg-white/[0.10] border-white/[0.22] text-white"
                                                : "bg-white/[0.03] border-white/[0.07] text-text-main/60 hover:bg-white/[0.07] hover:text-text-main hover:border-white/[0.12]"
                                        }`}
                                    >
                                        {SPORT_LABELS[sport] || formatSportName(sport)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Training Location */}
                        {trainer?.training_locations?.length > 0 && (
                            <div className="mb-8">
                                <h4 className="text-[10px] text-text-main/40 font-bold uppercase tracking-[0.15em] mb-3">Training Location</h4>
                                <div className="flex flex-wrap gap-2">
                                    {trainer.training_locations.map(loc => (
                                        <button
                                            key={loc}
                                            type="button"
                                            onClick={() => setSelectedLocation(loc)}
                                            className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                                                selectedLocation === loc
                                                    ? 'bg-white text-black border-white'
                                                    : 'bg-white/4 text-white/60 border-white/10 hover:border-white/30'
                                            }`}
                                        >
                                            {loc}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Session Duration — show only enabled durations from session_pricing */}
                        {offeredDurations.length > 0 && (
                            <div className="mb-8">
                                <h4 className="text-[10px] text-text-main/40 font-bold uppercase tracking-[0.15em] mb-3">Session Duration</h4>
                                <div className="flex flex-wrap gap-2">
                                    {offeredDurations.map(d => (
                                        <button
                                            key={d}
                                            type="button"
                                            onClick={() => { setDurationMinutes(d); setSelectedTime(''); }}
                                            className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                                                durationMinutes === d
                                                    ? 'bg-white text-black border-white'
                                                    : 'bg-white/4 text-white/60 border-white/10 hover:border-white/30'
                                            }`}
                                        >
                                            {d < 60 ? `${d} min` : '1 hr'}
                                            <span className="ml-2 text-[10px] opacity-70">
                                                ${(priceFor(sessionPricing, d) ?? 0).toFixed(0)}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Time Slots */}
                        <div className="mb-8">
                            <h4 className="text-[10px] text-text-main/40 font-bold uppercase tracking-[0.15em] mb-4">AVAILABLE SLOTS</h4>
                            {slotsLoading ? (
                                <div className="flex justify-center py-4">
                                    <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                </div>
                            ) : slots.length === 0 ? (
                                <div className="text-center py-6 bg-[#12141A] rounded-2xl border border-white/5 px-4">
                                    <p className="text-text-main/40 text-[11px] font-bold uppercase tracking-widest">
                                        {rawSlotCount === 0
                                            ? "No slots available for this day"
                                            : "No slots fit this session length"}
                                    </p>
                                    {rawSlotCount > 0 && maxSlotMinutes > 0 && maxSlotMinutes < durationMinutes && (
                                        <p className="text-text-main/50 text-[11px] mt-2 normal-case tracking-normal">
                                            The trainer's slots are up to <span className="text-primary font-semibold">{maxSlotMinutes} min</span> long. Try a shorter session.
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3">
                                    {slots.map(time => {
                                        const pastSlot = isSlotInPast(time);
                                        if (pastSlot) return null; // Hide past slots as per user request
                                        return (
                                            <button
                                                key={time}
                                                onClick={() => setSelectedTime(time)}
                                                className={`py-3.5 rounded-xl text-xs font-black transition-all border
                                                    ${selectedTime === time
                                                        ? "bg-transparent border-primary border-[2px] text-white shadow-[0_0_15px_rgba(69,208,255,0.15)]"
                                                        : "bg-[#272A35] border-transparent text-white/80 hover:bg-[#323644]"}`}
                                            >
                                                {time}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Fee Breakdown Preview */}
                        {user?.id !== trainer?.user_id && (() => {
                            const sessionPrice = priceFor(sessionPricing, durationMinutes) ?? 0;
                            const pct = platformFeePct / 100;
                            const platformFeeAmt = Math.round(sessionPrice * pct * 100) / 100;
                            const stripeFeeAmt = Math.round(((sessionPrice + platformFeeAmt) * 0.029 + 0.30) * 100) / 100;
                            const isCA = /^(ca|can|canada)$/i.test(((trainer as unknown as { country?: string | null })?.country || "").trim());
                            const taxAmt = isCA
                                ? Math.round((sessionPrice + platformFeeAmt + stripeFeeAmt) * 0.13 * 100) / 100
                                : 0;
                            const total = sessionPrice + platformFeeAmt + stripeFeeAmt + taxAmt;
                            const fmt = (n: number) => `$${n.toFixed(2)}`;
                            return (
                                <div className="mb-4 bg-[#12141A] border border-white/5 rounded-2xl px-4 py-3 text-[12px]">
                                    <div className="flex justify-between text-white/80 py-1">
                                        <span>Session fee</span><span>{fmt(sessionPrice)}</span>
                                    </div>
                                    <div className="flex justify-between text-white/50 py-1">
                                        <span>Platform ({platformFeePct}%)</span><span>{fmt(platformFeeAmt)}</span>
                                    </div>
                                    <div className="flex justify-between text-white/50 py-1">
                                        <span>Stripe (2.9% + $0.30)</span><span>{fmt(stripeFeeAmt)}</span>
                                    </div>
                                    {isCA && (
                                        <div className="flex justify-between text-white/50 py-1">
                                            <span>HST (13%)</span><span>{fmt(taxAmt)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-white font-black text-[13px] pt-2 mt-1 border-t border-white/10">
                                        <span>Total</span><span>{fmt(total)}</span>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Actions */}
                        <div className="relative space-y-3">
                            {user?.id === trainer?.user_id ? (
                                <div className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl py-4 px-4 text-center">
                                    <p className="text-text-main/60 text-xs font-bold uppercase tracking-widest">This is your profile</p>
                                    <p className="text-text-main/30 text-[11px] mt-1">You cannot book yourself</p>
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={handleBook}
                                        disabled={processing}
                                        className="group relative w-full overflow-hidden bg-gradient-to-r from-primary via-cyan-300 to-primary bg-[length:200%_100%] hover:bg-[position:100%_0] text-bg font-black text-[15px] py-4 rounded-2xl shadow-[0_10px_30px_-10px_rgba(69,208,255,0.6)] hover:shadow-[0_15px_40px_-10px_rgba(69,208,255,0.8)] hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0"
                                    >
                                        <span className="relative inline-flex items-center justify-center gap-2">
                                            <Sparkles size={15} />
                                            {processing ? "Processing..." : "Book Session"}
                                        </span>
                                    </button>

                                    <button
                                        onClick={() => router.push(`/dashboard/messages?trainerId=${trainer?.id}`)}
                                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] hover:border-white/[0.15] text-text-main/85 hover:text-text-main font-bold text-[13px] transition-all"
                                    >
                                        <MessageSquare size={14} /> Message Trainer
                                    </button>
                                </>
                            )}

                            <div className="flex items-center justify-center gap-1.5 text-[9px] text-text-main/30 font-bold uppercase tracking-[0.18em] mt-4">
                                <ShieldCheck size={11} className="text-primary/40" />
                                Secure checkout via AirTrainr Pay
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
        </>
    );
}

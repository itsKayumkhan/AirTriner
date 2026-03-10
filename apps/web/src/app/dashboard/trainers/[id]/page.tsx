"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase, TrainerProfileRow } from "@/lib/supabase";
import { Star, MapPin, Award, GraduationCap, Clock, MessageSquare, BadgeCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { ReviewSection } from "@/components/trainers/ReviewSection";

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

const CERTIFICATIONS = [
    { icon: <Award size={20} className="text-primary" />, title: "NASM Certified", desc: "Personal Training Specialist" },
    { icon: <GraduationCap size={20} className="text-primary" />, title: "B.S. Kinesiology", desc: "Stanford University" },
    { icon: <BadgeCheck size={20} className="text-primary" />, title: "Olympic Weightlifting", desc: "USAW Level 2 Coach" },
    { icon: <Clock size={20} className="text-primary" />, title: "Pre/Post Natal", desc: "Specialized Certification" },
];

export default function BookTrainerPage() {
    const params = useParams();
    const router = useRouter();
    const trainerId = params.id as string;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [user, setUser] = useState<AuthUser | null>(null);
    const [trainer, setTrainer] = useState<TrainerWithUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

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
    const [slotsLoading, setSlotsLoading] = useState(false);

    useEffect(() => {
        const session = getSession();
        if (!session) {
            router.push("/auth/login");
            return;
        }
        setUser(session);
        if (trainerId) loadTrainer();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trainerId, router]);

    // Fetch availability slots when date changes
    useEffect(() => {
        if (trainerId && selectedDate) {
            loadAvailability(selectedDate);
        }
    }, [trainerId, selectedDate]);

    const formatTimeTo12h = (time24: string) => {
        const [hours, minutes] = time24.split(':');
        let h = parseInt(hours, 10);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12; // the hour '0' should be '12'
        return `${h.toString().padStart(2, '0')}:${minutes} ${ampm}`;
    };

    const loadAvailability = async (dateStr: string) => {
        setSlotsLoading(true);
        try {
            const date = new Date(dateStr);
            const dayOfWeek = date.getDay(); // 0 is Sunday, 1 is Monday...

            const { data, error } = await supabase
                .from("availability_slots")
                .select("start_time, end_time")
                .eq("trainer_id", trainerId)
                .eq("day_of_week", dayOfWeek)
                .eq("is_blocked", false)
                .order("start_time");

            if (error) throw error;

            const formattedSlots = (data || []).map(s => formatTimeTo12h(s.start_time));
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
            const { data: profile } = await supabase
                .from("trainer_profiles")
                .select("*")
                .eq("id", trainerId)
                .single();

            if (!profile) throw new Error("Trainer not found");

            const { data: userData } = await supabase
                .from("users")
                .select("id, first_name, last_name, avatar_url")
                .eq("id", profile.user_id)
                .single();

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
                cover_image: getSportCover(profile.sports),
                recent_reviews: (reviewsData || []) as unknown as Review[],
                dispute_count: finalDisputeCount,
                is_performance_verified: isPerformanceVerified
            });
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleBook = async () => {
        if (!selectedSport) {
            alert("Please select a sport.");
            return;
        }
        if (!selectedTime) {
            alert("Please select a time slot.");
            return;
        }
        if (!user || !trainer) return;

        // Block past time slot bookings
        const [chkTime, chkMod] = selectedTime.split(" ");
        const [chkH, chkM] = chkTime.split(":");
        let chkHrs = parseInt(chkH, 10);
        if (chkMod === "PM" && chkHrs < 12) chkHrs += 12;
        if (chkMod === "AM" && chkHrs === 12) chkHrs = 0;
        const checkDate = new Date(`${selectedDate}T${chkHrs.toString().padStart(2, "0")}:${chkM}:00`);
        if (checkDate <= new Date()) {
            alert("You cannot book a past time slot. Please select a future date and time.");
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
            const durationMinutes = 60;

            // === Double Booking Prevention ===
            // Check for overlapping bookings for this trainer
            const requestedStart = scheduledAt.getTime();
            const requestedEnd = requestedStart + durationMinutes * 60 * 1000;

            // Get all active bookings for this trainer on the same day (±1 day buffer)
            const dayStart = new Date(scheduledAt);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(scheduledAt);
            dayEnd.setHours(23, 59, 59, 999);

            const { data: existingBookings } = await supabase
                .from("bookings")
                .select("scheduled_at, duration_minutes")
                .eq("trainer_id", trainer.user_id)
                .in("status", ["pending", "confirmed", "reschedule_requested"])
                .gte("scheduled_at", dayStart.toISOString())
                .lte("scheduled_at", dayEnd.toISOString());

            // Check for time-range overlaps
            const hasOverlap = (existingBookings || []).some(b => {
                const existingStart = new Date(b.scheduled_at).getTime();
                const existingEnd = existingStart + (b.duration_minutes || 60) * 60 * 1000;
                return requestedStart < existingEnd && requestedEnd > existingStart;
            });

            if (hasOverlap) {
                alert("This trainer already has a booking during this time slot. Please select a different time.");
                setProcessing(false);
                return;
            }
            // === End Double Booking Prevention ===

            const insertData = {
                athlete_id: user.id,
                trainer_id: trainer.user_id,
                sport: selectedSport,
                scheduled_at: scheduledAt.toISOString(),
                duration_minutes: durationMinutes,
                status: 'pending',
                price: trainer.hourly_rate || 0,
                platform_fee: (trainer.hourly_rate || 0) * 0.1, // 10% fee example
                total_paid: trainer.hourly_rate || 0
            };

            const { error } = await supabase.from("bookings").insert(insertData);

            if (error) throw error;
            router.push("/dashboard/bookings");
        } catch (error) {
            console.error("Booking failed:", error);
            alert("Failed to create booking.");
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
        <div className="max-w-[1280px] mx-auto pb-20 px-4 md:px-8 mt-4">

            {/* Cover Image */}
            <div className="w-full h-[320px] rounded-[32px] overflow-hidden relative mb-16 shadow-2xl">
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${trainer.cover_image})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F1115] via-transparent to-transparent opacity-80" />
            </div>

            {/* Profile Header Overlapping */}
            <div className="flex flex-col md:flex-row items-start md:items-end gap-6 px-4 md:px-12 -mt-36 relative z-10 mb-8">
                {/* Avatar */}
                <div className="relative">
                    <div className="w-40 h-40 rounded-[24px] border-[6px] border-[#0F1115] overflow-hidden bg-gray-800 shadow-xl">
                        {trainer.user?.avatar_url ? (
                            <img src={trainer.user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-5xl font-black text-text-main bg-gradient-to-br from-indigo-500 to-purple-800">
                                {trainer.user?.first_name?.[0]}{trainer.user?.last_name?.[0]}
                            </div>
                        )}
                    </div>
                    {/* Verification checkmark - only if performance metrics are met */}
                    {trainer.is_performance_verified && (
                        <div className="absolute -bottom-2 -right-2 bg-primary rounded-full p-1 border-[4px] border-[#0F1115] shadow-[0_0_10px_rgba(163,255,18,0.5)]">
                            <BadgeCheck size={20} className="text-bg" />
                        </div>
                    )}
                </div>

                {/* Name & Titles */}
                <div className="pb-2">
                    <h1 className="text-5xl font-black text-text-main tracking-tight mb-2">
                        {trainer.user?.first_name} {trainer.user?.last_name}
                    </h1>
                    <div className="flex items-center gap-4 text-sm font-bold">
                        {trainer.is_performance_verified ? (
                            <span className="text-primary tracking-widest uppercase">Verified Performance</span>
                        ) : trainer.sessions_count > 0 ? (
                            <span className="text-blue-400 tracking-widest uppercase">Pro Trainer</span>
                        ) : (
                            <span className="text-emerald-400 tracking-widest uppercase">New Trainer</span>
                        )}
                        {trainer.city && (
                            <span className="text-text-main/60 flex items-center gap-1.5">
                                <MapPin size={14} /> {trainer.city}, {trainer.state}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Tags/Chips */}
            <div className="px-4 md:px-12 flex flex-wrap gap-3 mb-12">
                {trainer.sports.map((sport, i) => (
                    <span key={i} className="bg-surface border border-white/5 text-text-main/80 px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider">
                        {SPORT_LABELS[sport] || sport.replace(/_/g, " ")}
                    </span>
                ))}
            </div>

            {/* Main Content Stack */}
            <div className="flex flex-col gap-12 px-4 md:px-12 max-w-[850px] mx-auto">

                {/* Content */}
                <div className="flex flex-col gap-12">

                    {/* Stats Row */}
                    <div className="flex gap-12 border-b border-white/5 pb-10">
                        <div>
                            <div className="text-3xl font-black text-text-main mb-2">{trainer.avg_rating}</div>
                            <div className="flex gap-1 text-primary mb-2">
                                {[1, 2, 3, 4, 5].map(s => <Star key={s} size={14} className="fill-current" />)}
                            </div>
                            <div className="text-[10px] text-text-main/40 font-bold uppercase tracking-widest">{trainer.review_count} REVIEWS</div>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-text-main mb-3">{(trainer.years_experience || 0)}+</div>
                            <div className="text-[10px] text-text-main/40 font-bold uppercase tracking-widest mt-1">YEARS EXP.</div>
                        </div>
                        <div>
                            <div className="text-3xl font-black text-text-main mb-3">
                                {trainer.sessions_count >= 1000
                                    ? (trainer.sessions_count / 1000).toFixed(1) + "k"
                                    : trainer.sessions_count}
                            </div>
                            <div className="text-[10px] text-text-main/40 font-bold uppercase tracking-widest mt-1">SESSIONS</div>
                        </div>
                    </div>

                    {/* About */}
                    <div>
                        <h2 className="text-xl font-black text-text-main mb-4">About {trainer.user?.first_name}</h2>
                        <p className="text-text-main/60 text-[15px] leading-relaxed">
                            {trainer.bio || `Specializing in high-performance athletic training and metabolic conditioning. My approach combines data-driven science with old-school grit to help you push past plateaus and redefine your physical limits. Whether you're an elite athlete or just starting your journey, we'll build a foundation of functional strength and explosive power.`}
                        </p>
                    </div>

                    {/* Experience & Certifications */}
                    <div>
                        <h2 className="text-xl font-black text-text-main mb-6">Experience & Certifications</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {CERTIFICATIONS.map((cert, i) => (
                                <div key={i} className="bg-surface border border-white/5 rounded-2xl p-5 flex items-center gap-4">
                                    <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center flex-shrink-0">
                                        {cert.icon}
                                    </div>
                                    <div>
                                        <div className="text-text-main font-bold text-[15px] mb-0.5">{cert.title}</div>
                                        <div className="text-text-main/40 text-xs font-medium">{cert.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Reviews */}
                    <ReviewSection
                        reviews={trainer.recent_reviews}
                        totalCount={trainer.review_count}
                    />

                </div>

                {/* Booking Widget */}
                <div className="w-full">
                    <div className="bg-surface border border-white/5 rounded-[32px] p-8 shadow-2xl">

                        {/* Price & Rating */}
                        <div className="flex justify-between items-start mb-8 pb-8 border-b border-white/5">
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-[42px] font-black text-white leading-none">${trainer.hourly_rate}</span>
                                <span className="text-text-main/40 text-[11px] font-bold uppercase tracking-[0.15em] ml-1">/ hr</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-primary text-[15px] font-black mt-2">
                                <Star size={16} className="fill-current" /> {trainer.avg_rating}
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

                            <div className="grid grid-cols-7 gap-y-3 gap-x-2">
                                {/* Days of week header */}
                                {WEEKDAYS.map((day, i) => (
                                    <div key={`col-${i}`} className="flex flex-col items-center mb-1">
                                        <div className="text-[10px] text-text-main/40 font-bold uppercase tracking-wider h-4 flex items-center justify-center">
                                            {day}
                                        </div>
                                    </div>
                                ))}

                                {/* Dates */}
                                {dates.map((d, i) => (
                                    <div key={`date-${d.fullDate}-${i}`} className="flex justify-center">
                                        <button
                                            onClick={() => {
                                                if (!d.isPastDate) {
                                                    setSelectedDate(d.fullDate);
                                                }
                                            }}
                                            disabled={d.isPastDate}
                                            className={`w-9 h-10 rounded-[10px] text-sm font-black flex items-center justify-center transition-all duration-200
                                                ${!d.isCurrentMonth ? "opacity-30" : ""}
                                                ${d.isPastDate ? "opacity-20 cursor-not-allowed" : ""}
                                                ${selectedDate === d.fullDate && !d.isPastDate
                                                    ? "bg-primary text-bg shadow-[0_4px_12px_rgba(163,255,18,0.3)] scale-105"
                                                    : !d.isPastDate ? "text-white hover:bg-white/5 hover:-translate-y-0.5" : "text-white"}`}
                                        >
                                            {d.date}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Sport Selection */}
                        <div className="mb-10">
                            <h4 className="text-[10px] text-text-main/40 font-bold uppercase tracking-[0.15em] mb-4">SELECT SPORT</h4>
                            <div className="grid grid-cols-2 gap-3">
                                {trainer.sports.map(sport => (
                                    <button
                                        key={sport}
                                        onClick={() => setSelectedSport(sport)}
                                        className={`py-3 px-4 rounded-xl text-[11px] font-black transition-all border text-center uppercase tracking-wider
                                            ${selectedSport === sport
                                                ? "bg-transparent border-primary border-[2px] text-white shadow-[0_0_15px_rgba(163,255,18,0.15)]"
                                                : "bg-[#272A35] border-transparent text-white/80 hover:bg-[#323644]"}`}
                                    >
                                        {SPORT_LABELS[sport] || sport.replace(/_/g, " ")}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Time Slots */}
                        <div className="mb-8">
                            <h4 className="text-[10px] text-text-main/40 font-bold uppercase tracking-[0.15em] mb-4">AVAILABLE SLOTS</h4>
                            {slotsLoading ? (
                                <div className="flex justify-center py-4">
                                    <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                </div>
                            ) : slots.length === 0 ? (
                                <div className="text-center py-6 bg-[#12141A] rounded-2xl border border-white/5">
                                    <p className="text-text-main/40 text-[11px] font-bold uppercase tracking-widest">No slots available for this day</p>
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
                                                        ? "bg-transparent border-primary border-[2px] text-white shadow-[0_0_15px_rgba(163,255,18,0.15)]"
                                                        : "bg-[#272A35] border-transparent text-white/80 hover:bg-[#323644]"}`}
                                            >
                                                {time}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="space-y-4">
                            <button
                                onClick={handleBook}
                                disabled={processing}
                                className="w-full bg-primary text-bg font-black text-[15px] py-4 rounded-2xl hover:shadow-[0_0_15px_rgba(163,255,18,0.25)] hover:-translate-y-0.5 transition-all disabled:opacity-50"
                            >
                                {processing ? "Processing..." : "Book Session"}
                            </button>

                            <button className="w-full flex items-center justify-center gap-2 text-text-main/80 font-bold text-xs py-2 hover:text-text-main transition-colors">
                                <MessageSquare size={14} /> Message Trainer
                            </button>

                            <div className="text-center text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-4">
                                SECURE CHECKOUT VIA AIRTRAINR PAY
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    );
}

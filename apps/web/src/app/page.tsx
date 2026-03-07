"use client";

import { useState, useEffect, useRef } from "react";
import { getSession, clearSession, AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// =============================================
// ICONS (inline SVG components)
// =============================================
const ChevronRight = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter"><path d="m9 18 6-6-6-6" /></svg>
);
const ChevronLeft = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter"><path d="m15 18-6-6 6-6" /></svg>
);
const Check = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"><path d="M20 6 9 17l-5-5" /></svg>
);
const QuoteIcon = () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="var(--primary)" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 11h-4a3 3 0 0 1 3-3v-2a5 5 0 0 0-5 5v7h6v-7zm10 0h-4a3 3 0 0 1 3-3v-2a5 5 0 0 0-5 5v7h6v-7z" fill="var(--primary)" />
    </svg>
);
const Menu = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" /></svg>
);
const X = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);

// =============================================
// MOCK DATA
// =============================================

const ELITE_COACHES = [
    {
        tag: "TENNIS PRO",
        name: "MARCUS STERLING",
        desc: "10 Years Pro Coaching • ATP Certified",
        image: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=600&h=800&fit=crop&q=80",
    },
    {
        tag: "SOCCER COACH",
        name: "ELENA RODRIGUEZ",
        desc: "Tactical Analyst • UEFA Pro License",
        image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&h=800&fit=crop&q=80",
    },
    {
        tag: "BASKETBALL",
        name: "JORDAN VANCE",
        desc: "Former NCAA D1 Player • Skills Specialist",
        image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&h=800&fit=crop&q=80",
    },
];

// =============================================
// NAVBAR
// =============================================

function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [user, setUser] = useState<AuthUser | null>(null);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll);
        setUser(getSession());
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const handleLogout = async () => {
        await clearSession();
        setUser(null);
        window.location.reload();
    };

    return (
        <nav
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 1000,
                transition: "all var(--transition-base)",
                background: scrolled ? "var(--surface-glass)" : "transparent",
                backdropFilter: scrolled ? "blur(20px)" : "none",
                borderBottom: scrolled ? "1px solid var(--gray-800)" : "1px solid transparent",
                padding: scrolled ? "12px 0" : "24px 0",
            }}
        >
            <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>

                {/* Logo */}
                <a href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
                    <div style={{
                        width: "36px", height: "36px",
                        background: "var(--primary)",
                        borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--color-bg)"><path d="M2 12l10-10 10 10-10 10z" /></svg>
                    </div>
                    <span style={{
                        fontSize: "22px", fontWeight: 800, fontFamily: "var(--font-display)", color: "var(--foreground)", textTransform: "uppercase", letterSpacing: "1px"
                    }}>
                        AIRTRAINR
                    </span>
                </a>

                {/* Desktop Nav Removed as requested */}

                {/* CTA Buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }} className="desktop-nav">
                    {user ? (
                        <>
                            <a href="/dashboard"
                                style={{
                                    textDecoration: "none", color: "var(--color-bg)", fontSize: "13px", fontWeight: 800,
                                    padding: "10px 24px", background: "var(--primary)", borderRadius: "var(--radius-full)",
                                    textTransform: "uppercase", letterSpacing: "1px", transition: "all var(--transition-fast)",
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = "0 0 15px rgba(163,255,18,0.5)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
                            >
                                DASHBOARD
                            </a>
                            <button onClick={handleLogout}
                                style={{
                                    background: "transparent", cursor: "pointer",
                                    textDecoration: "none", color: "white", fontSize: "13px", fontWeight: 700,
                                    padding: "10px 20px", border: "1px solid var(--gray-700)", borderRadius: "var(--radius-full)",
                                    transition: "all var(--transition-fast)", textTransform: "uppercase", letterSpacing: "1px"
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--gray-700)"; e.currentTarget.style.color = "white"; }}
                            >
                                LOG OUT
                            </button>
                        </>
                    ) : (
                        <>
                            <a href="/auth/login"
                                style={{
                                    textDecoration: "none", color: "white", fontSize: "13px", fontWeight: 700,
                                    padding: "10px 20px", border: "1px solid var(--gray-700)", borderRadius: "var(--radius-full)",
                                    transition: "all var(--transition-fast)", textTransform: "uppercase", letterSpacing: "1px"
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--gray-700)"; e.currentTarget.style.color = "white"; }}
                            >
                                LOG IN
                            </a>
                            <a href="/auth/register"
                                style={{
                                    textDecoration: "none", color: "var(--color-bg)", fontSize: "13px", fontWeight: 800,
                                    padding: "10px 24px", background: "var(--primary)", borderRadius: "var(--radius-full)",
                                    textTransform: "uppercase", letterSpacing: "1px", transition: "all var(--transition-fast)",
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = "0 0 15px rgba(163,255,18,0.5)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
                            >
                                GET STARTED
                            </a>
                        </>
                    )}
                </div>

                {/* Mobile Menu Toggle */}
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="mobile-menu-btn"
                    style={{ display: "none", background: "transparent", border: "none", color: "var(--primary)", padding: "8px", cursor: "pointer" }}
                >
                    {mobileMenuOpen ? <X /> : <Menu />}
                </button>
            </div>

            <style>{`
        @media (max-width: 968px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: block !important; }
        }
        .sport-card:hover .sport-bg { transform: scale(1.1); }
        .sport-card:hover .sport-overlay { background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(163,255,18,0.3) 60%, rgba(0,0,0,0.1) 100%) !important; }
        .sport-card:hover .sport-arrow { opacity: 1 !important; transform: translateX(0) !important; }
      `}</style>
        </nav>
    );
}


// =============================================
// PAGE CONTENT
// =============================================

export default function Home() {
    const coachSliderRef = useRef<HTMLDivElement>(null);
    const [reviewIndex, setReviewIndex] = useState(0);
    const [coaches, setCoaches] = useState<any[]>(ELITE_COACHES);

    useEffect(() => {
        const fetchCoaches = async () => {
            try {
                const { data: profiles } = await supabase
                    .from("trainer_profiles")
                    .select("*")
                    .in("subscription_status", ["trial", "active"])
                    .limit(10);

                if (profiles && profiles.length > 0) {
                    const ids = profiles.map(p => p.user_id);
                    const { data: users } = await supabase
                        .from("users")
                        .select("id, first_name, last_name, avatar_url")
                        .in("id", ids);


                    if (users) {
                        const SPORT_IMAGES: Record<string, string> = {
                            tennis: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=600&auto=format&fit=crop&q=80",
                            soccer: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&auto=format&fit=crop&q=80",
                            football: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&auto=format&fit=crop&q=80",
                            basketball: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&auto=format&fit=crop&q=80",
                            track: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=600&auto=format&fit=crop&q=80",
                            golf: "https://images.unsplash.com/photo-1535139262971-c51845709a48?w=600&auto=format&fit=crop&q=80",
                            swimming: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=600&auto=format&fit=crop&q=80",
                            martial_arts: "https://images.unsplash.com/photo-1555597673-b21d5c935865?w=600&auto=format&fit=crop&q=80",
                            hockey: "https://images.unsplash.com/photo-1580748141549-71748dbe0bdc?w=600&auto=format&fit=crop&q=80",
                            fitness: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&auto=format&fit=crop&q=80"
                        };

                        const getSportImg = (sportArray: string[] | null) => {
                            if (!sportArray || sportArray.length === 0) return SPORT_IMAGES["fitness"];
                            const firstSport = sportArray[0].toLowerCase();
                            for (const [k, v] of Object.entries(SPORT_IMAGES)) {
                                if (firstSport.includes(k) || k.includes(firstSport)) return v;
                            }
                            return SPORT_IMAGES["fitness"];
                        };

                        const userMap = new Map(users.map(u => [u.id, u]));
                        const formatted = profiles.map(p => {
                            const u = userMap.get(p.user_id);
                            return {
                                id: p.user_id,
                                tag: (p.sports && p.sports.length > 0) ? p.sports[0] : "ELITE COACH",
                                name: u ? `${u.first_name} ${u.last_name}` : "Professional",
                                desc: p.bio ? (p.bio.length > 40 ? p.bio.substring(0, 40) + "..." : p.bio) : "Expert sports performance coach",
                                image: (u && u.avatar_url) ? u.avatar_url : getSportImg(p.sports)
                            };
                        });

                        const sorted = formatted.sort((a, b) => {
                            // Check if the coach has an uploaded avatar vs. a generic sport URL
                            const aHasAvatar = a.image !== "" && !a.image.includes("images.unsplash");
                            const bHasAvatar = b.image !== "" && !b.image.includes("images.unsplash");
                            return (aHasAvatar === bHasAvatar) ? 0 : aHasAvatar ? -1 : 1;
                        });

                        if (sorted.length > 0) {
                            setCoaches(sorted.slice(0, 10));
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to load coaches", err);
            }
        };
        fetchCoaches();
    }, []);

    const scrollCoaches = (dir: "left" | "right") => {
        if (coachSliderRef.current) {
            const scrollAmount = coachSliderRef.current.clientWidth > 600 ? 320 * 2 : 320;
            coachSliderRef.current.scrollBy({ left: dir === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
        }
    };

    const REVIEWS = [
        { name: "EMILY M.", role: "INTERMEDIATE TENNIS PLAYER", text: "I wanted a place to stay active and connect with others — and this club went above and beyond. The coaches make every session enjoyable and approachable, and I've improved so much while building lasting friendships." },
        { name: "JAKE T.", role: "COLLEGE SOCCER ATHLETE", text: "The data-driven approach and elite coaching helped me shave seconds off my sprint time. I feel more prepared than ever." },
        { name: "SARAH L.", role: "PRO BASKETBALL PLAYER", text: "AirTrainr is the only platform that takes professional athlete needs seriously. The seamless booking and elite talent pool are unmatched." }
    ];

    const nextReview = () => setReviewIndex((prev) => (prev + 1) % REVIEWS.length);
    const prevReview = () => setReviewIndex((prev) => (prev - 1 + REVIEWS.length) % REVIEWS.length);

    return (
        <div style={{ background: "var(--color-bg)", color: "white", minHeight: "100vh" }}>
            <Navbar />

            {/* HERO SECTION */}
            <section style={{
                position: "relative",
                paddingTop: "140px",
                paddingBottom: "100px",
                minHeight: "80vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
            }}>
                {/* Background Image / Gradient */}
                <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 0,
                    backgroundImage: "linear-gradient(to bottom, rgba(18,18,18,0.8), rgba(18,18,18,1)), url('https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80')",
                    backgroundSize: "cover",
                    backgroundPosition: "center top",
                    opacity: 0.6,
                }}></div>

                <div style={{ position: "relative", zIndex: 1, maxWidth: "900px", margin: "0 auto", textAlign: "center", padding: "0 24px" }}>
                    <h1 style={{
                        fontSize: "clamp(48px, 8vw, 96px)",
                        fontWeight: 900, fontFamily: "var(--font-display)",
                        lineHeight: 1, textTransform: "uppercase", marginBottom: "24px"
                    }}>
                        TRAIN <span style={{ color: "var(--primary)", fontStyle: "italic" }}>SMARTER.</span><br />
                        HIRE <span style={{ WebkitTextStroke: "2px var(--gray-400)", color: "transparent" }}>BETTER.</span>
                    </h1>

                    <p style={{
                        fontSize: "18px", color: "var(--gray-300)", lineHeight: 1.6,
                        maxWidth: "600px", margin: "0 auto 40px", fontWeight: 400
                    }}>
                        Access the world's most elite sports performance coaches. From professional athletes to weekend warriors, we bridge the gap between potential and peak performance.
                    </p>

                    <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap", marginBottom: "48px" }}>
                        <a href="/trainers" style={{
                            padding: "16px 32px", background: "var(--primary)", color: "var(--color-bg)",
                            borderRadius: "var(--radius-full)", fontWeight: 800, fontSize: "14px", textDecoration: "none",
                            textTransform: "uppercase", letterSpacing: "1px", transition: "all 0.2s"
                        }}>
                            FIND A TRAINER
                        </a>
                        <a href="/auth/register?role=trainer" style={{
                            padding: "16px 32px", background: "transparent", color: "white",
                            border: "2px solid var(--gray-500)", borderRadius: "var(--radius-full)",
                            fontWeight: 800, fontSize: "14px", textDecoration: "none",
                            textTransform: "uppercase", letterSpacing: "1px", transition: "all 0.2s"
                        }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "white" }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--gray-500)" }}
                        >
                            BECOME A TRAINER
                        </a>
                    </div>

                    {/* Mini social proof */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px" }}>
                        <div style={{ display: "flex", marginLeft: "10px" }}>
                            {[1, 2, 3].map(i => (
                                <div key={i} style={{
                                    width: "32px", height: "32px", borderRadius: "50%", background: "#fff",
                                    marginLeft: "-10px", border: "2px solid var(--color-bg)", opacity: 0.8
                                }}></div>
                            ))}
                        </div>
                        <div style={{ textAlign: "left", fontSize: "12px", color: "var(--gray-400)" }}>
                            <strong style={{ color: "var(--primary)" }}>5,000+ Athletes</strong><br />
                            Improving daily on AirTrainr
                        </div>
                    </div>
                </div>
            </section>

            {/* STATS STRIP */}
            <section style={{ background: "var(--primary)", padding: "40px 24px" }}>
                <div style={{ maxWidth: "1400px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "32px" }}>
                    {[
                        { num: "850+", label: "EXPERT COACHES" },
                        { num: "98%", label: "SUCCESS RATE" },
                        { num: "25+", label: "SPORT TYPES" },
                        { num: "12K+", label: "SESSIONS BOOKED" },
                    ].map((stat, i) => (
                        <div key={i} style={{ textAlign: "center", color: "var(--color-bg)" }}>
                            <div style={{ fontSize: "36px", fontWeight: 900, fontFamily: "var(--font-display)", marginBottom: "4px" }}>{stat.num}</div>
                            <div style={{ fontSize: "13px", fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase" }}>{stat.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ELITE COACHES */}
            <section style={{ padding: "100px 24px", background: "var(--surface)", borderBottom: "1px solid var(--gray-900)" }}>
                <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "24px", marginBottom: "48px" }}>
                        <div style={{ maxWidth: "600px" }}>
                            <h2 style={{ fontSize: "36px", fontWeight: 900, fontFamily: "var(--font-display)", textTransform: "uppercase", marginBottom: "16px" }}>
                                ELITE COACHES
                            </h2>
                            <p style={{ color: "var(--gray-400)", fontSize: "16px" }}>
                                Work with certified professionals who have trained world champions and Olympic athletes.
                            </p>
                        </div>
                        <div style={{ display: "flex", gap: "12px" }}>
                            <button onClick={() => scrollCoaches('left')} style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--gray-900)", border: "1px solid var(--gray-800)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--gray-800)"; e.currentTarget.style.color = "white"; }}><ChevronLeft /></button>
                            <button onClick={() => scrollCoaches('right')} style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--gray-900)", border: "1px solid var(--gray-800)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--gray-800)"; e.currentTarget.style.color = "white"; }}><ChevronRight /></button>
                        </div>
                    </div>

                    <div ref={coachSliderRef} style={{ display: "flex", overflowX: "auto", gap: "24px", scrollSnapType: "x mandatory", scrollbarWidth: "none", msOverflowStyle: "none", paddingBottom: "24px" }} className="hide-scrollbar">
                        {coaches.map((coach, i) => (
                            <div key={i} style={{
                                flex: "0 0 min(100%, 350px)",
                                scrollSnapAlign: "start",
                                position: "relative",
                                height: "400px",
                                borderRadius: "var(--radius-xl)",
                                overflow: "hidden",
                                border: "1px solid var(--gray-800)",
                            }}>
                                {/* Background Image */}
                                <div style={{
                                    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 0,
                                    backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%), url('${coach.image}')`,
                                    backgroundSize: "cover", backgroundPosition: "center", filter: "grayscale(100%)", transition: "filter 0.3s"
                                }}
                                    onMouseEnter={(e) => { e.currentTarget.style.filter = "grayscale(0%)" }}
                                    onMouseLeave={(e) => { e.currentTarget.style.filter = "grayscale(100%)" }}
                                ></div>

                                {/* Content */}
                                <div style={{
                                    position: "absolute", bottom: 0, left: 0, right: 0, padding: "24px", zIndex: 1,
                                    display: "flex", flexDirection: "column", gap: "8px"
                                }}>
                                    <span style={{
                                        background: "var(--primary)", color: "var(--color-bg)", padding: "4px 8px",
                                        fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", alignSelf: "flex-start", borderRadius: "var(--radius-md)"
                                    }}>{coach.tag}</span>
                                    <h3 style={{ fontSize: "24px", fontWeight: 900, fontFamily: "var(--font-display)", textTransform: "uppercase", margin: 0 }}>{coach.name}</h3>
                                    <p style={{ fontSize: "14px", color: "var(--gray-300)", marginBottom: "16px" }}>{coach.desc}</p>

                                    <a href={`/dashboard/trainers/${coach.id || 'default'}`} style={{
                                        display: "block", textAlign: "center", textDecoration: "none",
                                        width: "100%", padding: "12px", background: "rgba(255,255,255,0.1)", backdropFilter: "blur(10px)",
                                        border: "1px solid rgba(255,255,255,0.2)", color: "white", borderRadius: "var(--radius-md)",
                                        fontWeight: 700, fontSize: "13px", letterSpacing: "1px", cursor: "pointer", transition: "all 0.2s"
                                    }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--primary)"; e.currentTarget.style.color = "var(--color-bg)"; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "white"; }}
                                    >
                                        VIEW PROFILE
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* BROWSE BY SPORT */}
            <section style={{ padding: "100px 24px", background: "var(--color-bg)", borderBottom: "1px solid var(--gray-900)" }} id="sports">
                <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
                    <div style={{ textAlign: "center", marginBottom: "48px" }}>
                        <h2 style={{ fontSize: "36px", fontWeight: 900, fontFamily: "var(--font-display)", textTransform: "uppercase", marginBottom: "16px" }}>
                            BROWSE BY SPORT
                        </h2>
                        <div style={{ width: "60px", height: "4px", background: "var(--primary)", margin: "0 auto 24px" }}></div>
                        <p style={{ color: "var(--gray-400)", fontSize: "16px", maxWidth: "600px", margin: "0 auto" }}>
                            Find the top coaches in your discipline. Start your journey with the best in the game.
                        </p>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "24px" }}>
                        {[
                            { id: "tennis", name: "Tennis", img: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=600&auto=format&fit=crop&q=80" },
                            { id: "soccer", name: "Soccer", img: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=600&auto=format&fit=crop&q=80" },
                            { id: "basketball", name: "Basketball", img: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&auto=format&fit=crop&q=80" },
                            { id: "track_and_field", name: "Track & Field", img: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=600&auto=format&fit=crop&q=80" },
                            { id: "golf", name: "Golf", img: "https://images.unsplash.com/photo-1535139262971-c51845709a48?w=600&auto=format&fit=crop&q=80" },
                            { id: "swimming", name: "Swimming", img: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=600&auto=format&fit=crop&q=80" },
                            { id: "martial_arts", name: "Martial Arts", img: "https://images.unsplash.com/photo-1555597673-b21d5c935865?w=600&auto=format&fit=crop&q=80" },
                            { id: "hockey", name: "Hockey", img: "https://images.unsplash.com/photo-1580748141549-71748dbe0bdc?w=600&auto=format&fit=crop&q=80" },
                        ].map((sport, i) => (
                            <a key={i} href={`/dashboard/search?sport=${sport.id}`} style={{
                                position: "relative",
                                height: "240px",
                                borderRadius: "var(--radius-lg)",
                                overflow: "hidden",
                                textDecoration: "none",
                                display: "block"
                            }} className="sport-card">
                                <div style={{
                                    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 0,
                                    backgroundImage: `url('${sport.img}')`, backgroundSize: "cover", backgroundPosition: "center",
                                    transition: "transform 0.5s ease"
                                }} className="sport-bg"></div>
                                <div style={{
                                    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
                                    background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.2) 60%, rgba(0,0,0,0.1) 100%)",
                                    transition: "background 0.3s ease"
                                }} className="sport-overlay"></div>
                                <div style={{
                                    position: "absolute", bottom: "24px", left: "24px", right: "24px", zIndex: 2,
                                    display: "flex", justifyContent: "space-between", alignItems: "flex-end"
                                }}>
                                    <h3 style={{ margin: 0, fontSize: "24px", fontWeight: 900, fontFamily: "var(--font-display)", color: "white", textTransform: "uppercase", letterSpacing: "1px" }}>{sport.name}</h3>
                                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-bg)", opacity: 0, transform: "translateX(-10px)", transition: "all 0.3s ease" }} className="sport-arrow">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter"><path d="m9 18 6-6-6-6" /></svg>
                                    </div>
                                </div>
                            </a>
                        ))}
                    </div>

                    <div style={{ textAlign: "center", marginTop: "48px" }}>
                        <a href="/dashboard/search" style={{
                            display: "inline-block",
                            padding: "16px 40px",
                            background: "transparent", border: "2px solid var(--primary)", color: "var(--primary)",
                            borderRadius: "var(--radius-full)", fontWeight: 800, fontSize: "14px", textDecoration: "none",
                            textTransform: "uppercase", letterSpacing: "1px", transition: "all 0.2s"
                        }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--primary)"; e.currentTarget.style.color = "var(--color-bg)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--primary)"; }}
                        >
                            VIEW ALL SPORTS
                        </a>
                    </div>
                </div>
            </section>

            {/* HOW IT WORKS */}
            <section style={{ padding: "100px 24px", background: "var(--color-bg)", textAlign: "center" }}>
                <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
                    <h2 style={{ fontSize: "32px", fontWeight: 900, fontFamily: "var(--font-display)", textTransform: "uppercase", marginBottom: "16px" }}>
                        HOW AIRTRAINR WORKS
                    </h2>
                    <div style={{ width: "60px", height: "4px", background: "var(--primary)", margin: "0 auto 64px" }}></div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "64px" }}>
                        {[
                            { num: "01", title: "DISCOVER EXPERTS", desc: "Filter by sport, location, or goal. Browse intro videos and check verified credentials." },
                            { num: "02", title: "BOOK INSTANTLY", desc: "Schedule 1-on-1 sessions or join a small group workshop through our seamless booking engine." },
                            { num: "03", title: "LEVEL UP", desc: "Receive personalized feedback, track your progress via our app, and crush your performance goals." },
                        ].map((step, i) => (
                            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                <div style={{
                                    width: "64px", height: "64px", borderRadius: "50%", border: "2px solid var(--primary)",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: "20px", fontWeight: 800, color: "var(--primary)", marginBottom: "24px",
                                    background: "var(--gray-900)", boxShadow: "0 0 20px rgba(163,255,18,0.15)"
                                }}>
                                    {step.num}
                                </div>
                                <h3 style={{ fontSize: "18px", fontWeight: 800, textTransform: "uppercase", marginBottom: "16px", color: "white" }}>{step.title}</h3>
                                <p style={{ fontSize: "14px", color: "var(--gray-400)", lineHeight: 1.6, maxWidth: "280px" }}>{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* THE AIRTRAINR ADVANTAGE */}
            <section style={{ padding: "100px 24px", background: "var(--surface)", borderBottom: "1px solid var(--gray-900)", position: "relative", overflow: "hidden" }} id="advantage">
                {/* Decorative background glow */}
                <div style={{ position: "absolute", top: "-100px", right: "-100px", width: "400px", height: "400px", background: "var(--primary)", filter: "blur(150px)", opacity: 0.1, borderRadius: "50%", zIndex: 0 }}></div>

                <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 1 }}>
                    <div style={{ textAlign: "center", marginBottom: "64px" }}>
                        <h2 style={{ fontSize: "36px", fontWeight: 900, fontFamily: "var(--font-display)", textTransform: "uppercase", marginBottom: "16px" }}>
                            THE AIRTRAINR ADVANTAGE
                        </h2>
                        <div style={{ width: "60px", height: "4px", background: "var(--primary)", margin: "0 auto 24px" }}></div>
                        <p style={{ color: "var(--gray-400)", fontSize: "16px", maxWidth: "600px", margin: "0 auto" }}>
                            We provide athletes and coaches with the ultimate platform to succeed. No generic gym aesthetics, just pure sports performance.
                        </p>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "32px" }}>
                        {[
                            { title: "VERIFIED ELITE COACHES", icon: <Check />, desc: "Every trainer on our roster undergoes a rigorous verification process. We only accept top-tier professionals." },
                            { title: "DATA-DRIVEN INSIGHTS", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" /></svg>, desc: "Track your progress, monitor your athletic metrics, and make informed decisions about your training protocol." },
                            { title: "SEAMLESS BOOKING", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>, desc: "No more back-and-forth emails. Browse real-time availability and book your sessions instantly." },
                            { title: "GLOBAL NETWORK", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /><path d="M2 12h20" /></svg>, desc: "Join an international community of athletes and coaches dedicated to pushing the boundaries of sports." },
                            { title: "COMPREHENSIVE VIDEO REVIEW", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>, desc: "Record your practice routines, upload them, and get detailed frame-by-frame analysis from your coach." },
                            { title: "CUSTOM MEAL PLANS", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 8-4-4h-4l-4 4" /><path d="M20 21V11c0-1.7-1.3-3-3-3H7c-1.7 0-3 1.3-3 3v10" /><path d="M12 11v10" /></svg>, desc: "Fuel your body for performance with tailored, sport-specific nutrition guides mapped out by professionals." }
                        ].map((item, i) => (
                            <div key={i} style={{
                                background: "rgba(255,255,255,0.02)",
                                border: "1px solid rgba(255,255,255,0.05)",
                                borderRadius: "var(--radius-xl)",
                                padding: "40px 32px",
                                transition: "all 0.3s ease",
                            }}
                                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-5px)"; e.currentTarget.style.border = "1px solid rgba(163,255,18,0.3)"; e.currentTarget.style.boxShadow = "0 10px 30px rgba(163,255,18,0.05)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.border = "1px solid rgba(255,255,255,0.05)"; e.currentTarget.style.boxShadow = "none"; }}
                            >
                                <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(163,255,18,0.1)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px" }}>
                                    {item.icon}
                                </div>
                                <h3 style={{ fontSize: "16px", fontWeight: 800, textTransform: "uppercase", marginBottom: "16px", color: "white", letterSpacing: "1px" }}>{item.title}</h3>
                                <p style={{ fontSize: "14px", color: "var(--gray-400)", lineHeight: 1.6 }}>{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* PLATFORM CAPABILITIES */}
            <section style={{ padding: "100px 24px", background: "var(--color-bg)", borderBottom: "1px solid var(--gray-900)" }}>
                <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "64px", alignItems: "center" }} className="split-grid">
                        <div>
                            <h2 style={{ fontSize: "36px", fontWeight: 900, fontFamily: "var(--font-display)", textTransform: "uppercase", marginBottom: "24px", lineHeight: 1.1 }}>
                                EVERYTHING YOU NEED<br />TO REACH PEAK<br />PERFORMANCE
                            </h2>
                            <div style={{ width: "60px", height: "4px", background: "var(--primary)", marginBottom: "32px" }}></div>

                            <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
                                {[
                                    { title: "Smart Scheduling", desc: "Sync your calendar, manage availability, and let athletes book directly without the back-and-forth messaging.", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> },
                                    { title: "Performance Analytics", desc: "Gain deep insights into session metrics. Track development over time and visualize progress with our built-in dashboards.", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg> },
                                    { title: "Direct Messaging", desc: "Keep all your communication in one dedicated hub. Discuss form, adjust protocols, and stay connected.", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg> }
                                ].map((feature, i) => (
                                    <div key={i} style={{ display: "flex", gap: "16px" }}>
                                        <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(163,255,18,0.1)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                            {feature.icon}
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: "18px", fontWeight: 800, color: "white", marginBottom: "8px" }}>{feature.title}</h3>
                                            <p style={{ color: "var(--gray-400)", fontSize: "14px", lineHeight: 1.6 }}>{feature.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Image Feature */}
                        <div style={{ position: "relative" }}>
                            <div style={{
                                width: "100%", height: "500px", borderRadius: "var(--radius-xl)",
                                backgroundImage: "url('https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=800&auto=format&fit=crop')",
                                backgroundSize: "cover", backgroundPosition: "center",
                                boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
                                border: "1px solid var(--gray-800)"
                            }}></div>

                            {/* Floating Stats Card overlay */}
                            <div style={{
                                position: "absolute", bottom: "-30px", left: "-30px", background: "var(--surface)",
                                border: "1px solid var(--gray-800)", padding: "24px", borderRadius: "16px",
                                boxShadow: "0 20px 40px rgba(0,0,0,0.8)", display: "flex", gap: "16px", alignItems: "center"
                            }} className="floating-card">
                                <div style={{ width: "48px", height: "48px", borderRadius: "50%", border: "4px solid var(--primary)", borderTopColor: "transparent", transform: "rotate(45deg)" }}></div>
                                <div>
                                    <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--gray-400)", letterSpacing: "1px" }}>ATHLETE PROGRESS</div>
                                    <div style={{ fontSize: "24px", fontWeight: 900, fontFamily: "var(--font-display)", color: "white" }}>+34% SPEED</div>
                                </div>
                            </div>
                        </div>

                        {/* Additional responsive styles inserted cleanly */}
                        <style>{`
                            @media (max-width: 968px) {
                                .split-grid { grid-template-columns: 1fr !important; }
                                .floating-card { left: 10px !important; right: 10px !important; bottom: 10px !important; }
                            }
                        `}</style>
                    </div>
                </div>
            </section>

            {/* FAQ SECTION */}
            <section style={{ padding: "100px 24px", background: "var(--surface)", borderBottom: "1px solid var(--gray-900)" }}>
                <div style={{ maxWidth: "800px", margin: "0 auto" }}>
                    <div style={{ textAlign: "center", marginBottom: "56px" }}>
                        <h2 style={{ fontSize: "36px", fontWeight: 900, fontFamily: "var(--font-display)", textTransform: "uppercase", marginBottom: "16px" }}>
                            FREQUENTLY ASKED QUESTIONS
                        </h2>
                        <div style={{ width: "60px", height: "4px", background: "var(--primary)", margin: "0 auto 24px" }}></div>
                        <p style={{ color: "var(--gray-400)", fontSize: "16px" }}>
                            Everything you need to know about getting started with AirTrainr.
                        </p>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {[
                            { q: "How are the coaches verified?", a: "Every coach on AirTrainr undergoes a strict vetting process. We check certifications, previous coaching experience, and professional backgrounds to ensure you only train with elite talent." },
                            { q: "Do I have to commit to a monthly plan?", a: "No! We offer a flexible 'Pay-Per-Play' option so you can book single sessions a la carte whenever it fits your schedule." },
                            { q: "Can I train both in-person and online?", a: "Yes. Many of our coaches offer both in-person sessions (based on your location filter) and remote video analysis or live virtual training." },
                            { q: "How do payments and bookings work?", a: "It's all handled securely through our platform. Once you find a coach, you select an available time slot and pay via our secure checkout. Both you and the coach receive instant calendar invites." }
                        ].map((faq, i) => (
                            <details key={i} style={{
                                background: "var(--color-bg)",
                                border: "1px solid var(--gray-800)",
                                borderRadius: "var(--radius-lg)",
                                overflow: "hidden"
                            }} className="faq-details">
                                <summary style={{
                                    padding: "24px",
                                    fontSize: "18px",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    listStyle: "none",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    color: "white"
                                }} className="faq-summary">
                                    {faq.q}
                                    <span style={{ color: "var(--primary)", fontSize: "24px", fontWeight: 400 }}>+</span>
                                </summary>
                                <div style={{ padding: "0 24px 24px 24px", color: "var(--gray-400)", lineHeight: 1.6, fontSize: "15px" }}>
                                    {faq.a}
                                </div>
                            </details>
                        ))}
                    </div>

                    {/* Clean styling for details marker removal */}
                    <style>{`
                        details > summary::-webkit-details-marker {display: none; }
                        details[open] summary span {transform: rotate(45deg); transition: transform 0.2s; }
                        details summary span {transition: transform 0.2s; }
                    `}</style>
                </div>
            </section>

            {/* JOIN THE NETWORK CTA */}
            <section style={{ padding: "100px 24px", background: "var(--primary)", color: "var(--color-bg)", textAlign: "center" }}>
                <div style={{ maxWidth: "800px", margin: "0 auto" }}>
                    <h2 style={{ fontSize: "48px", fontWeight: 900, fontFamily: "var(--font-display)", textTransform: "uppercase", marginBottom: "24px", lineHeight: 1 }}>
                        READY TO ELEVATE YOUR GAME?
                    </h2>
                    <p style={{ fontSize: "18px", fontWeight: 600, marginBottom: "40px", opacity: 0.9 }}>
                        Join thousands of athletes and premium coaches already part of AirTrainr. Sign up today and get moving.
                    </p>
                    <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
                        <a href="/auth/register" style={{
                            padding: "16px 40px", background: "var(--color-bg)", color: "white",
                            borderRadius: "var(--radius-full)", fontWeight: 800, fontSize: "14px", textDecoration: "none",
                            textTransform: "uppercase", letterSpacing: "1px", transition: "all 0.2s"
                        }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = "var(--color-bg)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--color-bg)"; e.currentTarget.style.color = "white"; }}
                        >
                            JOIN AS ATHLETE
                        </a>
                        <a href="/auth/register?role=trainer" style={{
                            padding: "16px 40px", background: "transparent", color: "var(--color-bg)",
                            border: "2px solid var(--color-bg)", borderRadius: "var(--radius-full)",
                            fontWeight: 800, fontSize: "14px", textDecoration: "none",
                            textTransform: "uppercase", letterSpacing: "1px", transition: "all 0.2s"
                        }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--color-bg)"; e.currentTarget.style.color = "white"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--color-bg)"; }}
                        >
                            APPLY AS COACH
                        </a>
                    </div>
                </div>
            </section>

            {/* REVIEWS SECTION */}
            <section style={{ padding: "100px 24px", background: "var(--color-bg)" }}>
                <div className="reviews-container" style={{ maxWidth: "1200px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "64px", alignItems: "center" }}>
                    <div className="reviews-text">
                        <h2 style={{ fontSize: "48px", fontWeight: 900, fontFamily: "var(--font-display)", textTransform: "uppercase", lineHeight: 1.1, marginBottom: "32px" }}>
                            REAL STORIES<br />FROM REAL<br />PEOPLE
                        </h2>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }} className="reviews-social">
                            <div style={{ display: "flex", marginLeft: "10px" }}>
                                {[1, 2, 3].map(i => (
                                    <div key={i} style={{ width: "40px", height: "40px", borderRadius: "50%", background: "var(--gray-800)", marginLeft: "-10px", border: "2px solid var(--color-bg)" }}></div>
                                ))}
                            </div>
                            <div style={{ fontSize: "12px", fontWeight: 800, color: "var(--gray-300)", letterSpacing: "1px" }}>
                                TRUSTED BY 10K+ ATHLETES
                            </div>
                        </div>
                    </div>

                    <div className="reviews-card-wrapper" style={{ position: "relative" }}>
                        <div className="reviews-card" style={{
                            background: "var(--surface)", border: "2px solid var(--primary)", borderRadius: "var(--radius-xl)",
                            padding: "48px", position: "relative", boxShadow: "0 0 30px rgba(163,255,18,0.1)",
                            transition: "all 0.3s ease"
                        }}>
                            <QuoteIcon />
                            <p style={{ fontSize: "20px", lineHeight: 1.6, fontStyle: "italic", marginTop: "24px", marginBottom: "24px", fontWeight: 500, minHeight: "100px", transition: "opacity 0.3s ease" }}>
                                "{REVIEWS[reviewIndex].text}"
                            </p>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                <div>
                                    <h4 style={{ fontSize: "16px", fontWeight: 800, textTransform: "uppercase", marginBottom: "4px" }}>{REVIEWS[reviewIndex].name}</h4>
                                    <p style={{ color: "var(--primary)", fontSize: "12px", fontWeight: 700, letterSpacing: "1px" }}>{REVIEWS[reviewIndex].role}</p>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    <button onClick={prevReview} style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--gray-900)", border: "1px solid var(--gray-800)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--gray-800)"; e.currentTarget.style.color = "white"; }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 15-6-6-6 6" /></svg></button>
                                    <button onClick={nextReview} style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--gray-900)", border: "1px solid var(--gray-800)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--gray-800)"; e.currentTarget.style.color = "white"; }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer style={{ background: "var(--surface)", borderTop: "1px solid var(--gray-900)", padding: "80px 24px 40px" }}>
                <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
                    <div className="footer-grid" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: "64px", marginBottom: "80px" }}>
                        <div className="footer-col footer-brand">
                            {/* Brand */}
                            <a href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", marginBottom: "24px" }}>
                                <div style={{
                                    width: "32px", height: "32px", background: "var(--primary)", borderRadius: "50%",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-bg)"><path d="M2 12l10-10 10 10-10 10z" /></svg>
                                </div>
                                <span style={{ fontSize: "20px", fontWeight: 800, fontFamily: "var(--font-display)", color: "var(--foreground)", textTransform: "uppercase", letterSpacing: "1px" }}>
                                    AIRTRAINR
                                </span>
                            </a>
                            <p style={{ color: "var(--gray-400)", fontSize: "14px", lineHeight: 1.6, maxWidth: "300px", marginBottom: "24px" }}>
                                The ultimate marketplace for athletes and coaches to connect, train, and dominate their field. Built for true sports competition.
                            </p>
                            <div style={{ display: "flex", gap: "16px" }} className="footer-social">
                                {/* Social icons placeholder */}
                                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--gray-900)", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" /></svg>
                                </div>
                                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--gray-900)", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* Links 1 */}
                        <div className="footer-col">
                            <h4 style={{ fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "24px", color: "white" }}>COMPANY</h4>
                            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "16px" }}>
                                {["About Us", "Careers", "Press Kit", "Contact"].map(link => (
                                    <li key={link}><a href="#" style={{ color: "var(--gray-400)", textDecoration: "none", fontSize: "14px" }}>{link}</a></li>
                                ))}
                            </ul>
                        </div>

                        {/* Links 2 */}
                        <div className="footer-col">
                            <h4 style={{ fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "24px", color: "white" }}>RESOURCES</h4>
                            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "16px" }}>
                                {["Help Center", "Safety Guides", "Become a Partner", "Privacy Policy"].map(link => (
                                    <li key={link}><a href="#" style={{ color: "var(--gray-400)", textDecoration: "none", fontSize: "14px" }}>{link}</a></li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    <div className="footer-bottom" style={{ padding: "32px 0 0", borderTop: "1px solid var(--gray-800)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
                        <p style={{ color: "var(--gray-500)", fontSize: "12px", letterSpacing: "0.5px" }}>© 2026 AIRTRAINR MARKETPLACE INC.</p>
                        <p style={{ color: "var(--gray-500)", fontSize: "12px", letterSpacing: "0.5px" }}>POWERED BY <strong style={{ color: "white" }}>ELITE PERFORMANCE TECH</strong></p>
                    </div>
                </div>
            </footer>

            {/* FINAL RESPONSIVE OVERRIDES */}
            <style>{`
                @media (max-width: 968px) {
                    .reviews-container {
                        grid-template-columns: 1fr !important;
                        gap: 48px !important;
                    }
                    .reviews-text {
                        text-align: center;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }
                    .reviews-text h2 {
                        font-size: clamp(32px, 8vw, 48px) !important;
                        margin-bottom: 24px !important;
                    }
                    .reviews-social {
                        justify-content: center !important;
                    }
                    .reviews-card {
                        padding: 32px 24px !important;
                    }
                    
                    .footer-grid {
                        grid-template-columns: 1fr !important;
                        gap: 48px !important;
                        text-align: center;
                    }
                    .footer-col {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }
                    .footer-brand p {
                        margin-left: auto !important;
                        margin-right: auto !important;
                    }
                    .footer-social {
                        justify-content: center !important;
                    }
                    .footer-col h4 {
                        margin-bottom: 16px !important;
                    }
                    .footer-bottom {
                        flex-direction: column !important;
                        text-align: center !important;
                        gap: 12px !important;
                    }
                }
                
                @media (max-width: 640px) {
                    .reviews-card p {
                        font-size: 16px !important;
                    }
                }
            `}</style>
        </div>
    );
}

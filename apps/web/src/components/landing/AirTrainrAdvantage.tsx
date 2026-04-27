"use client";

import { MapPin, Target, Zap, ShieldCheck, Clock } from "lucide-react";
import { LANDING_IMAGES } from "./landingImages";

type Advantage = {
    title: string;
    desc: string;
    icon: React.ReactNode;
    image: string;
    span: "lg" | "md" | "sm";
};

const advantages: Advantage[] = [
    {
        title: "Access to the Right Local Coaches",
        desc: "Instantly connect with trainers who specialize in your sport, skill level, and goals.",
        icon: <MapPin className="w-5 h-5" />,
        image: LANDING_IMAGES.advantageLocalCoaches,
        span: "lg",
    },
    {
        title: "Personalized, High-Quality Training",
        desc: "Coaching tailored specifically to each athlete's needs.",
        icon: <Target className="w-5 h-5" />,
        image: LANDING_IMAGES.advantagePersonalized,
        span: "md",
    },
    {
        title: "Faster Skill Development",
        desc: "Learn the right techniques and avoid bad habits.",
        icon: <Zap className="w-5 h-5" />,
        image: LANDING_IMAGES.advantageFasterDev,
        span: "sm",
    },
    {
        title: "Real, Verified Trainer Profiles",
        desc: "View certifications, experience, and real athlete reviews.",
        icon: <ShieldCheck className="w-5 h-5" />,
        image: LANDING_IMAGES.advantageVerified,
        span: "sm",
    },
    {
        title: "Saves Time, Simplifies Training",
        desc: "Find and contact trainers in minutes — not days of searching.",
        icon: <Clock className="w-5 h-5" />,
        image: LANDING_IMAGES.advantageSavesTime,
        span: "lg",
    },
];

function Tile({ a }: { a: Advantage }) {
    const minHeight =
        a.span === "lg" ? "320px" : a.span === "md" ? "280px" : "240px";

    return (
        <div
            className={`advantage-tile advantage-tile-${a.span}`}
            style={{
                position: "relative",
                minHeight,
                borderRadius: "var(--radius-xl)",
                overflow: "hidden",
                border: "1px solid var(--gray-800)",
                cursor: "default",
                transition: "all 0.35s ease",
                isolation: "isolate",
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-6px)";
                e.currentTarget.style.borderColor = "rgba(69,208,255,0.4)";
                e.currentTarget.style.boxShadow =
                    "0 20px 40px rgba(0,0,0,0.5), 0 0 30px rgba(69,208,255,0.15)";
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = "var(--gray-800)";
                e.currentTarget.style.boxShadow = "none";
            }}
        >
            {/* Background image */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: `url('${a.image}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    transition: "transform 0.5s ease",
                    zIndex: 0,
                }}
                className="advantage-bg"
            />
            {/* Dark gradient overlay */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background:
                        "linear-gradient(to bottom, rgba(10,13,20,0.55) 0%, rgba(10,13,20,0.85) 60%, rgba(10,13,20,0.95) 100%)",
                    zIndex: 1,
                    transition: "background 0.35s ease",
                }}
                className="advantage-overlay"
            />

            {/* Content */}
            <div
                style={{
                    position: "relative",
                    zIndex: 2,
                    height: "100%",
                    minHeight: "inherit",
                    padding: "28px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-end",
                }}
            >
                <div
                    style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "12px",
                        background: "rgba(69,208,255,0.18)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid rgba(69,208,255,0.3)",
                        color: "var(--primary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: "16px",
                    }}
                >
                    {a.icon}
                </div>
                <h3
                    style={{
                        fontSize: a.span === "lg" ? "22px" : "18px",
                        fontWeight: 900,
                        fontFamily: "var(--font-display)",
                        textTransform: "uppercase",
                        color: "white",
                        letterSpacing: "0.5px",
                        marginBottom: "8px",
                        lineHeight: 1.15,
                    }}
                >
                    {a.title}
                </h3>
                <p
                    style={{
                        fontSize: "13.5px",
                        color: "var(--gray-300)",
                        lineHeight: 1.55,
                        margin: 0,
                        maxWidth: "460px",
                    }}
                >
                    {a.desc}
                </p>
            </div>
        </div>
    );
}

export default function AirTrainrAdvantage() {
    return (
        <section
            id="advantage"
            style={{
                padding: "100px 20px",
                background: "var(--surface)",
                borderBottom: "1px solid var(--gray-900)",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Decorative glows */}
            <div
                style={{
                    position: "absolute",
                    top: "-10%",
                    right: "-10%",
                    width: "500px",
                    height: "500px",
                    background: "var(--primary)",
                    filter: "blur(180px)",
                    opacity: 0.08,
                    borderRadius: "50%",
                    zIndex: 0,
                }}
            />
            <div
                style={{
                    position: "absolute",
                    bottom: "-15%",
                    left: "-15%",
                    width: "500px",
                    height: "500px",
                    background: "var(--primary)",
                    filter: "blur(200px)",
                    opacity: 0.05,
                    borderRadius: "50%",
                    zIndex: 0,
                }}
            />

            <div style={{ maxWidth: "1300px", margin: "0 auto", position: "relative", zIndex: 1 }}>
                <div style={{ textAlign: "center", marginBottom: "56px" }}>
                    <div
                        style={{
                            display: "inline-block",
                            background: "rgba(69,208,255,0.1)",
                            border: "1px solid rgba(69,208,255,0.25)",
                            borderRadius: "var(--radius-full)",
                            padding: "6px 16px",
                            marginBottom: "20px",
                            fontSize: "11px",
                            fontWeight: 800,
                            color: "var(--primary)",
                            letterSpacing: "1.5px",
                            textTransform: "uppercase",
                        }}
                    >
                        The AirTrainr Advantage
                    </div>
                    <h2
                        style={{
                            fontSize: "clamp(28px, 5vw, 44px)",
                            fontWeight: 900,
                            fontFamily: "var(--font-display)",
                            textTransform: "uppercase",
                            marginBottom: "16px",
                            letterSpacing: "-0.5px",
                            lineHeight: 1.1,
                        }}
                    >
                        WHY ATHLETES CHOOSE{" "}
                        <span
                            style={{
                                color: "var(--primary)",
                                fontStyle: "italic",
                                textShadow: "0 0 30px rgba(69,208,255,0.5)",
                            }}
                        >
                            AIRTRAINR
                        </span>
                    </h2>
                    <div
                        style={{
                            width: "60px",
                            height: "4px",
                            background: "var(--primary)",
                            margin: "0 auto 24px",
                        }}
                    />
                    <p style={{ color: "var(--gray-400)", fontSize: "16px", maxWidth: "600px", margin: "0 auto" }}>
                        Built for performance, not for filler. Every feature is designed to get you closer to your potential.
                    </p>
                </div>

                {/* Bento grid */}
                <div className="advantage-bento">
                    {advantages.map((a, i) => (
                        <Tile key={i} a={a} />
                    ))}
                </div>

                <style>{`
                    .advantage-bento {
                        display: grid;
                        grid-template-columns: repeat(6, 1fr);
                        grid-auto-rows: minmax(220px, auto);
                        gap: 20px;
                    }
                    .advantage-tile-lg { grid-column: span 3; }
                    .advantage-tile-md { grid-column: span 3; }
                    .advantage-tile-sm { grid-column: span 3; }

                    /* asymmetric pattern on wider screens — 5 tiles: 4+2 / 2+2+2 / 6 */
                    @media (min-width: 1024px) {
                        .advantage-bento > .advantage-tile:nth-child(1) { grid-column: span 4; }
                        .advantage-bento > .advantage-tile:nth-child(2) { grid-column: span 2; }
                        .advantage-bento > .advantage-tile:nth-child(3) { grid-column: span 2; }
                        .advantage-bento > .advantage-tile:nth-child(4) { grid-column: span 2; }
                        .advantage-bento > .advantage-tile:nth-child(5) { grid-column: span 2; }
                    }

                    @media (max-width: 768px) {
                        .advantage-bento { grid-template-columns: 1fr 1fr !important; gap: 14px !important; }
                        .advantage-bento > .advantage-tile { grid-column: span 1 !important; min-height: 240px !important; }
                    }
                    @media (max-width: 480px) {
                        .advantage-bento { grid-template-columns: 1fr !important; }
                        .advantage-bento > .advantage-tile { min-height: 220px !important; }
                    }

                    .advantage-tile:hover .advantage-bg { transform: scale(1.08); }
                    .advantage-tile:hover .advantage-overlay {
                        background: linear-gradient(to bottom, rgba(10,13,20,0.35) 0%, rgba(10,13,20,0.8) 60%, rgba(10,13,20,0.95) 100%) !important;
                    }
                `}</style>
            </div>
        </section>
    );
}

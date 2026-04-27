"use client";

import { Award, Gift, Star } from "lucide-react";
import { LANDING_IMAGES } from "./landingImages";

const perks = [
    {
        icon: <Award className="w-5 h-5" />,
        title: "Permanent \"Founding 50\" badge",
        desc: "Stand out forever with an exclusive badge displayed on your profile.",
    },
    {
        icon: <Gift className="w-5 h-5" />,
        title: "Free subscription, lifetime",
        desc: "No monthly or yearly fees — ever. Keep 100% of your hourly rate as always.",
    },
    {
        icon: <Star className="w-5 h-5" />,
        title: "Priority placement in search",
        desc: "Founding members rank higher when athletes browse trainers in your area.",
    },
];

export default function Founding50() {
    return (
        <section
            style={{
                padding: "100px 24px",
                background: "var(--color-bg)",
                borderBottom: "1px solid var(--gray-900)",
                position: "relative",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    bottom: "-10%",
                    left: "-10%",
                    width: "50%",
                    height: "50%",
                    background: "var(--primary)",
                    filter: "blur(200px)",
                    opacity: 0.05,
                    borderRadius: "50%",
                    zIndex: 0,
                }}
            />

            <div
                className="founding-container"
                style={{
                    maxWidth: "1200px",
                    margin: "0 auto",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "64px",
                    alignItems: "center",
                    position: "relative",
                    zIndex: 1,
                }}
            >
                {/* Image with floating badge */}
                <div className="founding-visual" style={{ position: "relative" }}>
                    <div
                        style={{
                            width: "100%",
                            height: "480px",
                            borderRadius: "var(--radius-xl)",
                            backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0) 40%, rgba(10,13,20,0.7) 100%), url('${LANDING_IMAGES.founding50Hero}')`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            border: "1px solid var(--gray-800)",
                            boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
                        }}
                    />

                    {/* Floating badge card */}
                    <div
                        style={{
                            position: "absolute",
                            top: "24px",
                            right: "24px",
                            background: "var(--primary)",
                            color: "var(--color-bg)",
                            padding: "16px 20px",
                            borderRadius: "var(--radius-lg)",
                            boxShadow: "0 10px 30px rgba(69,208,255,0.35)",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            transform: "rotate(-3deg)",
                        }}
                    >
                        <Award className="w-6 h-6" />
                        <div>
                            <div
                                style={{
                                    fontSize: "10px",
                                    fontWeight: 800,
                                    letterSpacing: "1px",
                                    textTransform: "uppercase",
                                    opacity: 0.8,
                                }}
                            >
                                Exclusive
                            </div>
                            <div
                                style={{
                                    fontSize: "16px",
                                    fontWeight: 900,
                                    fontFamily: "var(--font-display)",
                                    textTransform: "uppercase",
                                    letterSpacing: "1px",
                                }}
                            >
                                FOUNDING 50
                            </div>
                        </div>
                    </div>

                    {/* Floating "FREE FOREVER" tag */}
                    <div
                        style={{
                            position: "absolute",
                            bottom: "-20px",
                            left: "24px",
                            background: "var(--surface)",
                            border: "1px solid var(--primary)",
                            color: "white",
                            padding: "12px 20px",
                            borderRadius: "var(--radius-full)",
                            boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
                            fontSize: "13px",
                            fontWeight: 800,
                            letterSpacing: "1px",
                            textTransform: "uppercase",
                        }}
                    >
                        <span style={{ color: "var(--primary)" }}>$0</span> Forever
                    </div>
                </div>

                {/* Content */}
                <div>
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
                        Limited Offer
                    </div>

                    <h2
                        style={{
                            fontSize: "clamp(28px, 4.5vw, 44px)",
                            fontWeight: 900,
                            fontFamily: "var(--font-display)",
                            textTransform: "uppercase",
                            lineHeight: 1.1,
                            letterSpacing: "-0.5px",
                            marginBottom: "20px",
                        }}
                    >
                        JOIN THE{" "}
                        <span
                            style={{
                                color: "var(--primary)",
                                fontStyle: "italic",
                                textShadow: "0 0 30px rgba(69,208,255,0.45)",
                            }}
                        >
                            FOUNDING 50
                        </span>{" "}
                        COACHES
                    </h2>

                    <p
                        style={{
                            color: "var(--gray-300)",
                            fontSize: "16px",
                            lineHeight: 1.7,
                            marginBottom: "32px",
                        }}
                    >
                        We're hand-picking our first 50 trainers to shape AirTrainr.
                        Founding members get a permanent{" "}
                        <strong style={{ color: "white" }}>Founding 50</strong> badge on
                        their profile and a{" "}
                        <strong style={{ color: "var(--primary)" }}>
                            free subscription — forever
                        </strong>
                        . No monthly fee, no yearly fee, ever.
                    </p>

                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "20px",
                            marginBottom: "36px",
                        }}
                    >
                        {perks.map((p) => (
                            <div
                                key={p.title}
                                style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}
                            >
                                <div
                                    style={{
                                        width: "44px",
                                        height: "44px",
                                        borderRadius: "12px",
                                        background: "rgba(69,208,255,0.1)",
                                        color: "var(--primary)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                        border: "1px solid rgba(69,208,255,0.2)",
                                    }}
                                >
                                    {p.icon}
                                </div>
                                <div>
                                    <h4
                                        style={{
                                            fontSize: "15px",
                                            fontWeight: 800,
                                            color: "white",
                                            marginBottom: "4px",
                                        }}
                                    >
                                        {p.title}
                                    </h4>
                                    <p
                                        style={{
                                            color: "var(--gray-400)",
                                            fontSize: "13px",
                                            lineHeight: 1.5,
                                            margin: 0,
                                        }}
                                    >
                                        {p.desc}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <a
                        href="/auth/register?role=trainer&founding=1"
                        style={{
                            display: "inline-block",
                            padding: "16px 36px",
                            background: "var(--primary)",
                            color: "#0A0D14",
                            borderRadius: "var(--radius-full)",
                            fontWeight: 800,
                            fontSize: "13px",
                            textDecoration: "none",
                            textTransform: "uppercase",
                            letterSpacing: "1.5px",
                            boxShadow:
                                "0 0 24px rgba(69,208,255,0.5), 0 0 48px rgba(69,208,255,0.2)",
                            transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "scale(1.04)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "scale(1)";
                        }}
                    >
                        CLAIM YOUR FOUNDING SPOT
                    </a>

                    <p
                        style={{
                            color: "var(--gray-500)",
                            fontSize: "12px",
                            marginTop: "16px",
                        }}
                    >
                        First 50 trainers to complete a verified profile. Subject to approval.
                    </p>
                </div>
            </div>

            <style>{`
                @media (max-width: 968px) {
                    .founding-container {
                        grid-template-columns: 1fr !important;
                        gap: 48px !important;
                    }
                    .founding-visual {
                        max-width: 500px;
                        margin: 0 auto;
                        width: 100%;
                    }
                }
                @media (max-width: 640px) {
                    .founding-visual > div:first-child {
                        height: 360px !important;
                    }
                }
            `}</style>
        </section>
    );
}

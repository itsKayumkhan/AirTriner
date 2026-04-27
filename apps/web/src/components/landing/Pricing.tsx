"use client";

import { Check } from "lucide-react";

const athletePerks = [
    "Browse 850+ verified coaches",
    "Book sessions instantly",
    "Only 3% platform fee per booking",
    "No subscription, cancel anytime",
];

const trainerPerks = [
    "Keep 100% of your hourly rate",
    "Unlimited profile visibility to athletes",
    "Smart scheduling & messaging tools",
    "Cancel anytime",
];

function PerkRow({ children }: { children: React.ReactNode }) {
    return (
        <li
            style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                fontSize: "14px",
                color: "var(--gray-300)",
                lineHeight: 1.5,
            }}
        >
            <span
                style={{
                    flexShrink: 0,
                    width: "22px",
                    height: "22px",
                    borderRadius: "50%",
                    background: "rgba(69,208,255,0.15)",
                    color: "var(--primary)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: "1px",
                }}
            >
                <Check className="w-3 h-3" strokeWidth={3} />
            </span>
            <span>{children}</span>
        </li>
    );
}

export default function Pricing() {
    return (
        <section
            id="pricing"
            style={{
                padding: "100px 24px",
                background: "var(--surface)",
                borderBottom: "1px solid var(--gray-900)",
                position: "relative",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    top: "-10%",
                    right: "-10%",
                    width: "40%",
                    height: "40%",
                    background: "var(--primary)",
                    filter: "blur(180px)",
                    opacity: 0.04,
                    borderRadius: "50%",
                    zIndex: 0,
                }}
            />

            <div style={{ maxWidth: "1100px", margin: "0 auto", position: "relative", zIndex: 1 }}>
                <div style={{ textAlign: "center", marginBottom: "56px" }}>
                    <h2
                        style={{
                            fontSize: "clamp(28px, 5vw, 42px)",
                            fontWeight: 900,
                            fontFamily: "var(--font-display)",
                            textTransform: "uppercase",
                            marginBottom: "16px",
                            letterSpacing: "1px",
                        }}
                    >
                        SIMPLE, FAIR PRICING
                    </h2>
                    <div
                        style={{
                            width: "60px",
                            height: "4px",
                            background: "var(--primary)",
                            margin: "0 auto 24px",
                        }}
                    />
                    <p
                        style={{
                            color: "var(--gray-400)",
                            fontSize: "16px",
                            maxWidth: "600px",
                            margin: "0 auto",
                        }}
                    >
                        Athletes pay only when they book. Trainers keep 100% of their rate.
                        No hidden fees.
                    </p>
                </div>

                <div
                    className="pricing-grid"
                    style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "28px",
                        alignItems: "stretch",
                    }}
                >
                    {/* ATHLETE CARD */}
                    <div
                        className="pricing-card"
                        style={{
                            background: "var(--color-bg)",
                            border: "1px solid var(--gray-800)",
                            borderRadius: "var(--radius-xl)",
                            padding: "40px",
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        <div
                            style={{
                                fontSize: "12px",
                                fontWeight: 800,
                                letterSpacing: "1.5px",
                                color: "var(--gray-400)",
                                textTransform: "uppercase",
                                marginBottom: "12px",
                            }}
                        >
                            FOR ATHLETES
                        </div>
                        <div
                            style={{
                                fontSize: "56px",
                                fontWeight: 900,
                                fontFamily: "var(--font-display)",
                                color: "white",
                                lineHeight: 1,
                                marginBottom: "8px",
                            }}
                        >
                            FREE
                        </div>
                        <p
                            style={{
                                color: "var(--gray-400)",
                                fontSize: "14px",
                                marginBottom: "32px",
                            }}
                        >
                            to sign up & browse — only 3% platform fee at checkout.
                        </p>

                        <ul
                            style={{
                                listStyle: "none",
                                padding: 0,
                                margin: 0,
                                display: "flex",
                                flexDirection: "column",
                                gap: "14px",
                                marginBottom: "32px",
                                flex: 1,
                            }}
                        >
                            {athletePerks.map((p) => (
                                <PerkRow key={p}>{p}</PerkRow>
                            ))}
                        </ul>

                        <a
                            href="/dashboard/search"
                            style={{
                                display: "block",
                                textAlign: "center",
                                padding: "14px 24px",
                                background: "transparent",
                                color: "white",
                                border: "2px solid var(--gray-700)",
                                borderRadius: "var(--radius-full)",
                                fontWeight: 800,
                                fontSize: "13px",
                                textDecoration: "none",
                                textTransform: "uppercase",
                                letterSpacing: "1.5px",
                                transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = "var(--primary)";
                                e.currentTarget.style.color = "var(--primary)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = "var(--gray-700)";
                                e.currentTarget.style.color = "white";
                            }}
                        >
                            FIND A TRAINER
                        </a>
                    </div>

                    {/* TRAINER CARD (emphasized) */}
                    <div
                        className="pricing-card pricing-card-featured"
                        style={{
                            background: "var(--color-bg)",
                            border: "2px solid var(--primary)",
                            borderRadius: "var(--radius-xl)",
                            padding: "40px",
                            position: "relative",
                            display: "flex",
                            flexDirection: "column",
                            boxShadow: "0 0 30px rgba(69,208,255,0.15)",
                        }}
                    >
                        <div
                            style={{
                                position: "absolute",
                                top: "-14px",
                                left: "50%",
                                transform: "translateX(-50%)",
                                background: "var(--primary)",
                                color: "var(--color-bg)",
                                padding: "5px 14px",
                                borderRadius: "var(--radius-full)",
                                fontSize: "11px",
                                fontWeight: 800,
                                letterSpacing: "1.5px",
                                textTransform: "uppercase",
                                whiteSpace: "nowrap",
                            }}
                        >
                            MOST POPULAR
                        </div>

                        <div
                            style={{
                                fontSize: "12px",
                                fontWeight: 800,
                                letterSpacing: "1.5px",
                                color: "var(--primary)",
                                textTransform: "uppercase",
                                marginBottom: "12px",
                            }}
                        >
                            FOR TRAINERS
                        </div>

                        <div
                            style={{
                                display: "inline-flex",
                                alignSelf: "flex-start",
                                background: "rgba(69,208,255,0.12)",
                                border: "1px solid rgba(69,208,255,0.3)",
                                borderRadius: "var(--radius-full)",
                                padding: "5px 12px",
                                fontSize: "11px",
                                fontWeight: 800,
                                color: "var(--primary)",
                                letterSpacing: "1px",
                                textTransform: "uppercase",
                                marginBottom: "16px",
                            }}
                        >
                            7-day free trial
                        </div>

                        <div
                            style={{
                                display: "flex",
                                alignItems: "baseline",
                                flexWrap: "wrap",
                                gap: "16px",
                                marginBottom: "4px",
                            }}
                        >
                            <div>
                                <span
                                    style={{
                                        fontSize: "48px",
                                        fontWeight: 900,
                                        fontFamily: "var(--font-display)",
                                        color: "white",
                                        lineHeight: 1,
                                    }}
                                >
                                    $25
                                </span>
                                <span
                                    style={{
                                        fontSize: "16px",
                                        color: "var(--gray-400)",
                                        marginLeft: "4px",
                                    }}
                                >
                                    /mo
                                </span>
                            </div>
                            <span
                                style={{
                                    fontSize: "20px",
                                    color: "var(--gray-500)",
                                    fontWeight: 600,
                                }}
                            >
                                ·
                            </span>
                            <div>
                                <span
                                    style={{
                                        fontSize: "48px",
                                        fontWeight: 900,
                                        fontFamily: "var(--font-display)",
                                        color: "white",
                                        lineHeight: 1,
                                    }}
                                >
                                    $250
                                </span>
                                <span
                                    style={{
                                        fontSize: "16px",
                                        color: "var(--gray-400)",
                                        marginLeft: "4px",
                                    }}
                                >
                                    /yr
                                </span>
                            </div>
                        </div>
                        <p
                            style={{
                                color: "var(--primary)",
                                fontSize: "13px",
                                fontWeight: 700,
                                marginBottom: "32px",
                            }}
                        >
                            Save $50 with the annual plan
                        </p>

                        <ul
                            style={{
                                listStyle: "none",
                                padding: 0,
                                margin: 0,
                                display: "flex",
                                flexDirection: "column",
                                gap: "14px",
                                marginBottom: "32px",
                                flex: 1,
                            }}
                        >
                            {trainerPerks.map((p) => (
                                <PerkRow key={p}>{p}</PerkRow>
                            ))}
                        </ul>

                        <a
                            href="/auth/register?role=trainer"
                            style={{
                                display: "block",
                                textAlign: "center",
                                padding: "14px 24px",
                                background: "var(--primary)",
                                color: "#0A0D14",
                                borderRadius: "var(--radius-full)",
                                fontWeight: 800,
                                fontSize: "13px",
                                textDecoration: "none",
                                textTransform: "uppercase",
                                letterSpacing: "1.5px",
                                boxShadow:
                                    "0 0 20px rgba(69,208,255,0.4), 0 0 40px rgba(69,208,255,0.15)",
                                transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = "scale(1.02)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = "scale(1)";
                            }}
                        >
                            START FREE TRIAL
                        </a>
                    </div>
                </div>

                <style>{`
                    @media (max-width: 768px) {
                        .pricing-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
                        .pricing-card { padding: 32px 24px !important; }
                    }
                `}</style>
            </div>
        </section>
    );
}

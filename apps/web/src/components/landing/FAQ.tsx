"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

const FAQS = [
    {
        q: "How are the coaches verified?",
        a: "Every coach on AirTrainr undergoes a strict vetting process. We check certifications, previous coaching experience, and professional backgrounds to ensure you only train with elite talent.",
    },
    {
        q: "Do I have to commit to a monthly plan?",
        a: "No! Athletes have zero subscription. You only pay per booked session, with a small 3% platform fee at checkout — no monthly or yearly commitment.",
    },
    {
        q: "Can I train both in-person and online?",
        a: "Yes. Many of our coaches offer both in-person sessions (based on your location filter) and remote video analysis or live virtual training.",
    },
    {
        q: "How do payments and bookings work?",
        a: "It's all handled securely through our platform. Once you find a coach, you select an available time slot and pay via our secure checkout. Both you and the coach receive instant calendar invites.",
    },
    {
        q: "How much does it cost to use AirTrainr?",
        a: "Athletes pay nothing to sign up — we add a small 3% platform fee at checkout. Trainers get a 7-day free trial, then $25/month or $250/year (saving $50). Trainers always keep 100% of their hourly rate.",
    },
    {
        q: "What is the Founding 50 program?",
        a: "Our first 50 verified trainers join as Founding Members — they get a permanent Founding 50 badge on their profile and a free lifetime subscription. No monthly or yearly fee, ever.",
    },
];

export default function FAQ() {
    const [openIdx, setOpenIdx] = useState<number | null>(0);

    return (
        <section
            id="faq"
            style={{
                padding: "100px 24px",
                background: "var(--surface)",
                borderBottom: "1px solid var(--gray-900)",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Decorative glow */}
            <div
                style={{
                    position: "absolute",
                    top: "30%",
                    left: "10%",
                    width: "350px",
                    height: "350px",
                    background: "var(--primary)",
                    filter: "blur(180px)",
                    opacity: 0.06,
                    borderRadius: "50%",
                    zIndex: 0,
                }}
            />

            <div
                className="faq-container"
                style={{
                    maxWidth: "1100px",
                    margin: "0 auto",
                    position: "relative",
                    zIndex: 1,
                    display: "grid",
                    gridTemplateColumns: "1fr 1.5fr",
                    gap: "64px",
                    alignItems: "start",
                }}
            >
                {/* Left: heading & support card */}
                <div className="faq-left" style={{ position: "sticky", top: "100px" }}>
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
                        Need help?
                    </div>
                    <h2
                        style={{
                            fontSize: "clamp(28px, 4vw, 44px)",
                            fontWeight: 900,
                            fontFamily: "var(--font-display)",
                            textTransform: "uppercase",
                            lineHeight: 1.1,
                            letterSpacing: "-0.5px",
                            marginBottom: "20px",
                        }}
                    >
                        FREQUENTLY{" "}
                        <span
                            style={{
                                color: "var(--primary)",
                                fontStyle: "italic",
                                textShadow: "0 0 30px rgba(69,208,255,0.45)",
                            }}
                        >
                            ASKED
                        </span>
                        <br />
                        QUESTIONS
                    </h2>
                    <p
                        style={{
                            color: "var(--gray-400)",
                            fontSize: "15px",
                            lineHeight: 1.7,
                            marginBottom: "32px",
                        }}
                    >
                        Everything you need to know about getting started with AirTrainr —
                        pricing, bookings, and the Founding 50 program.
                    </p>

                    {/* Contact card */}
                    <div
                        style={{
                            background: "var(--color-bg)",
                            border: "1px solid var(--gray-800)",
                            borderRadius: "var(--radius-lg)",
                            padding: "20px",
                            display: "flex",
                            alignItems: "center",
                            gap: "14px",
                        }}
                    >
                        <div
                            style={{
                                width: "44px",
                                height: "44px",
                                borderRadius: "12px",
                                background: "rgba(69,208,255,0.12)",
                                color: "var(--primary)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                            </svg>
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "13px", fontWeight: 800, color: "white", marginBottom: "2px" }}>
                                Still have questions?
                            </div>
                            <a
                                href="/contact"

                                style={{
                                    fontSize: "12px",
                                    color: "var(--primary)",
                                    textDecoration: "none",
                                    fontWeight: 700,
                                    letterSpacing: "0.5px",
                                }}
                            >
                                Contact our team →
                            </a>
                        </div>
                    </div>
                </div>

                {/* Right: accordion */}
                <div className="faq-right" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {FAQS.map((faq, i) => {
                        const open = openIdx === i;
                        return (
                            <div
                                key={i}
                                style={{
                                    background: open ? "rgba(69,208,255,0.04)" : "var(--color-bg)",
                                    border: open
                                        ? "1px solid rgba(69,208,255,0.4)"
                                        : "1px solid var(--gray-800)",
                                    borderRadius: "var(--radius-lg)",
                                    overflow: "hidden",
                                    transition: "all 0.25s ease",
                                    boxShadow: open ? "0 8px 24px rgba(0,0,0,0.4)" : "none",
                                }}
                            >
                                <button
                                    onClick={() => setOpenIdx(open ? null : i)}
                                    style={{
                                        width: "100%",
                                        background: "transparent",
                                        border: "none",
                                        padding: "20px 24px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: "16px",
                                        cursor: "pointer",
                                        textAlign: "left",
                                        color: "white",
                                        fontFamily: "inherit",
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: "16px",
                                            fontWeight: 700,
                                            color: open ? "var(--primary)" : "white",
                                            transition: "color 0.2s",
                                            lineHeight: 1.4,
                                        }}
                                    >
                                        {faq.q}
                                    </span>
                                    <span
                                        style={{
                                            flexShrink: 0,
                                            width: "32px",
                                            height: "32px",
                                            borderRadius: "50%",
                                            background: open ? "var(--primary)" : "rgba(255,255,255,0.05)",
                                            color: open ? "var(--color-bg)" : "var(--gray-400)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            transition: "all 0.25s ease",
                                            transform: open ? "rotate(45deg)" : "rotate(0deg)",
                                        }}
                                    >
                                        <Plus className="w-4 h-4" strokeWidth={2.5} />
                                    </span>
                                </button>

                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateRows: open ? "1fr" : "0fr",
                                        transition: "grid-template-rows 0.3s ease",
                                    }}
                                >
                                    <div style={{ overflow: "hidden" }}>
                                        <div
                                            style={{
                                                padding: "0 24px 22px 24px",
                                                color: "var(--gray-300)",
                                                fontSize: "14.5px",
                                                lineHeight: 1.65,
                                            }}
                                        >
                                            {faq.a}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <style>{`
                @media (max-width: 968px) {
                    .faq-container {
                        grid-template-columns: 1fr !important;
                        gap: 40px !important;
                    }
                    .faq-left {
                        position: static !important;
                        text-align: center;
                    }
                    .faq-left > div:first-child { display: inline-block; }
                }
            `}</style>
        </section>
    );
}

"use client";

import { MapPin, Target, Zap, ShieldCheck, Clock, Users } from "lucide-react";

export default function AirTrainrAdvantage() {
    const advantages = [
        {
            title: "Access to the Right Local Coaches",
            desc: "Instantly connect with trainers who specialize in your sport, skill level, and goals.",
            icon: <MapPin className="w-6 h-6" />,
        },
        {
            title: "Personalized, High-Quality Training",
            desc: "Coaching tailored specifically to each athlete’s needs.",
            icon: <Target className="w-6 h-6" />,
        },
        {
            title: "Faster Skill Development",
            desc: "Learn the right techniques and avoid bad habits.",
            icon: <Zap className="w-6 h-6" />,
        },
        {
            title: "Real, Verified Trainer Profiles",
            desc: "View certifications, experience, and reviews.",
            icon: <ShieldCheck className="w-6 h-6" />,
        },
        {
            title: "Saves Time and Simplifies Training",
            desc: "Find and contact trainers in minutes.",
            icon: <Clock className="w-6 h-6" />,
        },
        {
            title: "Built for Every Athlete—Not Just Pros",
            desc: "From beginners to elite athletes.",
            icon: <Users className="w-6 h-6" />,
        }
    ];

    return (
        <section style={{ padding: "64px 20px", background: "var(--surface)", borderBottom: "1px solid var(--gray-900)", position: "relative", overflow: "hidden" }} id="advantage">
            {/* Decorative background glow */}
            <div style={{ position: "absolute", top: "-100px", right: "-100px", width: "400px", height: "400px", background: "var(--primary)", filter: "blur(150px)", opacity: 0.1, borderRadius: "50%", zIndex: 0 }}></div>

            <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 1 }}>
                <div style={{ textAlign: "center", marginBottom: "64px" }}>
                    <h2 style={{ fontSize: "clamp(20px, 5vw, 36px)", fontWeight: 900, fontFamily: "var(--font-display)", textTransform: "uppercase", marginBottom: "16px", letterSpacing: "1px" }}>
                        WHY AIRTRAINR GIVES ATHLETES THE EDGE
                    </h2>
                    <div style={{ width: "60px", height: "4px", background: "var(--primary)", margin: "0 auto 24px" }}></div>
                    <p style={{ color: "var(--gray-400)", fontSize: "16px", maxWidth: "600px", margin: "0 auto" }}>
                        We provide athletes and coaches with the ultimate platform to succeed. No generic gym aesthetics, just pure sports performance.
                    </p>
                </div>

                <style>{`
                    @media (max-width: 480px) {
                        #advantage .advantage-grid { grid-template-columns: 1fr !important; gap: 16px !important; }
                        #advantage .advantage-card { padding: 20px 16px !important; }
                    }
                    @media (min-width: 481px) and (max-width: 768px) {
                        #advantage .advantage-grid { grid-template-columns: 1fr 1fr !important; gap: 16px !important; }
                        #advantage .advantage-card { padding: 24px 16px !important; }
                    }
                `}</style>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }} className="advantage-grid">
                    {advantages.map((item, i) => (
                        <div key={i} style={{
                            background: "rgba(255,255,255,0.02)",
                            border: "1px solid rgba(255,255,255,0.05)",
                            borderRadius: "var(--radius-xl)",
                            padding: "32px 24px",
                            transition: "all 0.3s ease",
                            textAlign: "center"
                        }}
                            className="advantage-card group hover:-translate-y-1.25 hover:border-primary/30 hover:shadow-xl"
                        >
                            <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(69,208,255,0.1)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                                {item.icon}
                            </div>
                            <h3 style={{ fontSize: "16px", fontWeight: 800, textTransform: "uppercase", marginBottom: "16px", color: "white", letterSpacing: "1px" }}>{item.title}</h3>
                            <p style={{ fontSize: "14px", color: "var(--gray-400)", lineHeight: 1.6 }}>{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

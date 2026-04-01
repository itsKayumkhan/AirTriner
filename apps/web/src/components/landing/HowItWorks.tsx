"use client";

import { Search, Target, Rocket, Briefcase, Users, MessageSquare, ChevronRight } from "lucide-react";

export default function HowItWorks() {
    const athleteSteps = [
        {
            title: "Search Local Trainers",
            desc: "Enter your sport and location to instantly see qualified trainers in your area, complete with profiles and specialties.",
            icon: <Search className="w-5 h-5" />,
        },
        {
            title: "Choose the Right Coach",
            desc: "Compare experience, pricing, and training styles to find the perfect match for your specific athletic goals.",
            icon: <Target className="w-5 h-5" />,
        },
        {
            title: "Connect & Start Training",
            desc: "Message your trainer directly, book sessions, and begin your journey with personalized coaching.",
            icon: <Rocket className="w-5 h-5" />,
        }
    ];

    const trainerSteps = [
        {
            title: "Create Your Trainer Profile",
            desc: "Set up your professional page with experience, certifications, specialties, and training locations.",
            icon: <Briefcase className="w-5 h-5" />,
        },
        {
            title: "Get Discovered locally",
            desc: "Athletes search for coaches by sport and skill level—your profile appears so the right clients can find you.",
            icon: <Users className="w-5 h-5" />,
        },
        {
            title: "Connect & Grow Business",
            desc: "Message athletes, book sessions, and manage clients all in one place—expanding your reach with ease.",
            icon: <MessageSquare className="w-5 h-5" />,
        }
    ];

    return (
        <section style={{ padding: "80px 20px", background: "var(--color-bg)", borderBottom: "1px solid var(--gray-900)", position: "relative", overflow: "hidden" }} className="how-it-works-section">
            {/* Background Decor */}
            <div style={{ position: "absolute", top: "20%", left: "-10%", width: "40%", height: "40%", background: "var(--primary)", filter: "blur(180px)", opacity: 0.03, borderRadius: "50%", zIndex: 0 }}></div>
            
            <div style={{ maxWidth: "1300px", margin: "0 auto", position: "relative", zIndex: 1 }}>
                <div style={{ textAlign: "center", marginBottom: "48px" }}>
                    <h2 style={{ fontSize: "clamp(24px, 5vw, 42px)", fontWeight: 900, fontFamily: "var(--font-display)", textTransform: "uppercase", marginBottom: "16px", letterSpacing: "2px" }}>
                        HOW AIRTRAINR WORKS
                    </h2>
                    <div style={{ width: "80px", height: "4px", background: "var(--primary)", margin: "0 auto 24px" }}></div>
                    <p style={{ color: "var(--gray-400)", fontSize: "16px", maxWidth: "600px", margin: "0 auto", fontWeight: 500 }}>
                        A seamless experience designed for both performance-driven athletes and professional coaches.
                    </p>
                </div>

                <style>{`
                    @media (max-width: 768px) {
                        .how-it-works-section { padding: 48px 16px !important; }
                        .how-card { padding: 24px !important; border-radius: 20px !important; }
                        .how-grid { gap: 24px !important; }
                    }
                `}</style>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "32px", alignItems: "start" }} className="how-grid">

                    {/* ATHLETES SIDE */}
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "32px", padding: "40px" }} className="how-card">
                        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "40px" }}>
                            <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "var(--primary)", color: "var(--color-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Users className="w-6 h-6" />
                            </div>
                            <h3 style={{ fontSize: "24px", fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "1px" }}>FOR ATHLETES</h3>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "32px", position: "relative" }}>
                            {athleteSteps.map((step, i) => (
                                <div key={i} style={{ display: "flex", gap: "24px", position: "relative" }}>
                                    {/* Line connector */}
                                    {i !== athleteSteps.length - 1 && (
                                        <div style={{ position: "absolute", left: "20px", top: "40px", bottom: "-24px", width: "1px", background: "rgba(255,255,255,0.1)" }}></div>
                                    )}
                                    
                                    <div style={{ 
                                        width: "40px", height: "40px", borderRadius: "12px", 
                                        background: "rgba(69,208,255,0.1)", color: "var(--primary)",
                                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                        border: "1px solid rgba(69,208,255,0.2)",
                                        zIndex: 1
                                    }}>
                                        {step.icon}
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: "18px", fontWeight: 800, color: "white", marginBottom: "8px", textTransform: "uppercase" }}>{step.title}</h4>
                                        <p style={{ fontSize: "14px", color: "var(--gray-400)", lineHeight: 1.6 }}>{step.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* TRAINERS SIDE */}
                    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "32px", padding: "40px" }} className="how-card">
                        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "40px" }}>
                            <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "var(--primary)", color: "var(--color-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Briefcase className="w-6 h-6" />
                            </div>
                            <h3 style={{ fontSize: "24px", fontWeight: 900, color: "white", textTransform: "uppercase", letterSpacing: "1px" }}>FOR TRAINERS</h3>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "32px", position: "relative" }}>
                            {trainerSteps.map((step, i) => (
                                <div key={i} style={{ display: "flex", gap: "24px", position: "relative" }}>
                                    {/* Line connector */}
                                    {i !== trainerSteps.length - 1 && (
                                        <div style={{ position: "absolute", left: "20px", top: "40px", bottom: "-24px", width: "1px", background: "rgba(255,255,255,0.1)" }}></div>
                                    )}
                                    
                                    <div style={{ 
                                        width: "40px", height: "40px", borderRadius: "12px", 
                                        background: "rgba(69,208,255,0.1)", color: "var(--primary)",
                                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                                        border: "1px solid rgba(69,208,255,0.2)",
                                        zIndex: 1
                                    }}>
                                        {step.icon}
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: "18px", fontWeight: 800, color: "white", marginBottom: "8px", textTransform: "uppercase" }}>{step.title}</h4>
                                        <p style={{ fontSize: "14px", color: "var(--gray-400)", lineHeight: 1.6 }}>{step.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}

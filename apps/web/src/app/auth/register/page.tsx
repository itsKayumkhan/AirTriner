"use client";

import { Leaf, Dumbbell, TrendingUp, Trophy, Star, Users, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { registerUser } from "@/lib/auth";
import { useRouter } from "next/navigation";

const SPORTS = [
    "Hockey", "Baseball", "Basketball", "Football", "Soccer",
    "Tennis", "Golf", "Swimming", "Boxing", "Lacrosse",
    "Wrestling", "Martial Arts", "Gymnastics", "Track & Field", "Volleyball",
];

const SKILL_LEVELS = [
    { value: "beginner", label: "Beginner", desc: "Just getting started", icon: <Leaf className="w-5 h-5 text-primary" /> },
    { value: "intermediate", label: "Intermediate", desc: "Know the basics", icon: <TrendingUp className="w-5 h-5 text-primary" /> },
    { value: "advanced", label: "Advanced", desc: "Competitive athlete", icon: <Trophy className="w-5 h-5 text-primary" /> },
    { value: "pro", label: "Pro / Elite", desc: "Professional level", icon: <Star className="w-5 h-5 text-primary" /> },
];

export default function RegisterPage() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [role, setRole] = useState<"athlete" | "trainer" | "">("athlete");

    // Step 1
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    // Step 2
    const [selectedSports, setSelectedSports] = useState<string[]>([]);
    const [skillLevel, setSkillLevel] = useState("");
    const [city, setCity] = useState("");
    const [dateOfBirth, setDateOfBirth] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleStep1Submit = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!role) {
            setError("Please select a role");
            return;
        }
        if (!fullName.trim().includes(" ")) {
            setError("Please enter both first and last name");
            return;
        }
        if (password.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }

        setStep(2);
    };

    const toggleSport = (sport: string) => {
        setSelectedSports(prev => prev.includes(sport)
            ? prev.filter(s => s !== sport)
            : [...prev, sport]
        );
    };

    const doRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        if (selectedSports.length === 0) {
            setError("Please select at least one sport");
            setLoading(false);
            return;
        }

        const [firstName, ...lastNames] = fullName.split(" ");
        const lastName = lastNames.join(" ");

        try {
            await registerUser({
                email,
                password,
                firstName,
                lastName,
                role: role as "athlete" | "trainer",
                dateOfBirth,
                sports: selectedSports,
                ...(role === "athlete" ? {
                    skillLevel: skillLevel || undefined,
                    city: city || undefined,
                } : {}),
            });
            router.push(role === "trainer" ? "/dashboard/trainer/setup" : "/dashboard");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Registration failed");
            setLoading(false);
        }
    };

    const inputStyle: React.CSSProperties = {
        width: "100%", padding: "16px", paddingRight: "48px", borderRadius: "12px", border: "1px solid var(--gray-800)",
        background: "rgba(255,255,255,0.03)", color: "white", fontSize: "15px", outline: "none", transition: "all 0.2s"
    };

    return (
        <div style={{ minHeight: "100vh", background: "var(--color-bg)", color: "white", fontFamily: "var(--font-sans)", display: "flex", flexDirection: "column" }}>

            {/* Header */}
            <header style={{ padding: "32px 48px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: "12px", textDecoration: "none" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "8px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--zinc-900)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <img src="/logo.jpeg" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <span style={{ fontSize: "20px", fontWeight: 900, fontFamily: "var(--font-display)", color: "white", textTransform: "uppercase", letterSpacing: "1px" }}>AirTrainr</span>
                </a>

                <div style={{ fontSize: "14px", color: "var(--gray-400)", display: "flex", alignItems: "center", gap: "16px" }}>
                    <span>Ready to start?</span>
                    <a href="/auth/login" style={{ padding: "8px 20px", border: "1px solid var(--gray-700)", borderRadius: "var(--radius-full)", color: "white", textDecoration: "none", fontWeight: 600, transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>Log In</a>
                </div>
            </header>

            {/* Main Content */}
            <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
                <div style={{ width: "100%", maxWidth: step === 1 ? "480px" : "600px", transition: "max-width 0.3s" }}>

                    <div style={{ marginBottom: "32px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--primary)", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>
                            <span>STEP {step} OF 2</span>
                            <span style={{ color: "var(--gray-500)" }}>{step === 1 ? "50%" : "100%"} Complete</span>
                        </div>
                        <h1 style={{ fontSize: "32px", fontWeight: 900, fontFamily: "var(--font-display)", marginBottom: "16px" }}>
                            {step === 1 ? "Create Your Account" : "Personalize Your Profile"}
                        </h1>
                        <div style={{ height: "4px", background: "var(--gray-800)", borderRadius: "2px", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: step === 1 ? "50%" : "100%", background: "var(--primary)", transition: "width 0.3s ease-out" }} />
                        </div>
                    </div>

                    {error && (
                        <div style={{ padding: "12px 16px", borderRadius: "var(--radius-md)", background: "rgba(239, 68, 68, 0.1)", borderLeft: "4px solid var(--error)", color: "var(--error)", fontSize: "14px", marginBottom: "24px" }}>
                            {error}
                        </div>
                    )}

                    {step === 1 ? (
                        <form onSubmit={handleStep1Submit}>
                            <div style={{ marginBottom: "24px" }}>
                                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "12px" }}>I am signing up as...</label>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                                    {[
                                        { id: "athlete", icon: <Dumbbell className="w-8 h-8 text-primary" />, title: "Athlete", desc: "Access personalized programs, track metrics, and compete." },
                                        { id: "trainer", icon: <Users className="w-8 h-8 text-primary" />, title: "Trainer", desc: "Manage clients, build routines, and scale your business." }
                                    ].map(r => (
                                        <div key={r.id} onClick={() => setRole(r.id as "athlete" | "trainer")}
                                            style={{
                                                padding: "20px", borderRadius: "16px", cursor: "pointer", transition: "all 0.2s",
                                                background: role === r.id ? "rgba(163,255,18,0.02)" : "rgba(255,255,255,0.03)",
                                                border: `2px solid ${role === r.id ? "var(--primary)" : "transparent"}`
                                            }}
                                        >
                                            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: role === r.id ? "rgba(163,255,18,0.1)" : "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", marginBottom: "16px" }}>{r.icon}</div>
                                            <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "6px" }}>{r.title}</div>
                                            <div style={{ fontSize: "12px", color: "var(--gray-400)", lineHeight: 1.5 }}>{r.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginBottom: "20px" }}>
                                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "white", marginBottom: "8px" }}>Full Name</label>
                                <div style={{ position: "relative" }}>
                                    <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Enter your full name" required style={{ ...inputStyle, paddingLeft: "40px" }} />
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: "12px", top: "16px" }}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                </div>
                            </div>

                            <div style={{ marginBottom: "20px" }}>
                                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "white", marginBottom: "8px" }}>Email Address</label>
                                <div style={{ position: "relative" }}>
                                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" required style={{ ...inputStyle, paddingLeft: "40px" }} />
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: "12px", top: "16px" }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                                </div>
                            </div>

                            <div style={{ marginBottom: "32px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                    <label style={{ fontSize: "12px", fontWeight: 700, color: "white" }}>Password</label>
                                    <span style={{ fontSize: "11px", color: "var(--gray-500)" }}>Min. 8 characters</span>
                                </div>
                                <div style={{ position: "relative" }}>
                                    <input 
                                        type={showPassword ? "text" : "password"} 
                                        value={password} 
                                        onChange={e => setPassword(e.target.value)} 
                                        placeholder="••••••••" 
                                        required 
                                        minLength={8} 
                                        style={{ ...inputStyle, paddingLeft: "40px" }} 
                                    />
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: "12px", top: "16px" }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--gray-500)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <button type="submit" style={{ width: "100%", padding: "16px", borderRadius: "12px", background: "var(--primary)", color: "var(--color-bg)", border: "none", fontWeight: 800, fontSize: "15px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", cursor: "pointer", transition: "all 0.2s" }}>
                                Continue to Personalization
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><path d="m9 18 6-6-6-6" /></svg>
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={doRegister} style={{ animation: "fadeInUp 0.3s ease" }}>
                            <div style={{ marginBottom: "24px" }}>
                                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "12px" }}>Select your sports</label>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                                    {SPORTS.map(sport => {
                                        const isSelected = selectedSports.includes(sport);
                                        return (
                                            <div key={sport} onClick={() => toggleSport(sport)} style={{
                                                padding: "10px 16px", borderRadius: "30px", fontSize: "13px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                                                background: isSelected ? "var(--primary)" : "rgba(255,255,255,0.05)",
                                                color: isSelected ? "var(--color-bg)" : "white",
                                                border: `1px solid ${isSelected ? "var(--primary)" : "var(--gray-800)"}`
                                            }}>
                                                {sport}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            {role === "athlete" && (
                                <div style={{ marginBottom: "24px" }}>
                                    <label style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "12px" }}>Skill Level</label>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                        {SKILL_LEVELS.map(sl => (
                                            <div key={sl.value} onClick={() => setSkillLevel(sl.value)} style={{
                                                padding: "16px", borderRadius: "12px", cursor: "pointer", transition: "all 0.2s",
                                                background: skillLevel === sl.value ? "rgba(163,255,18,0.05)" : "rgba(255,255,255,0.03)",
                                                border: `1px solid ${skillLevel === sl.value ? "var(--primary)" : "var(--gray-800)"}`
                                            }}>
                                                <div style={{ fontSize: "20px", marginBottom: "8px" }}>{sl.icon}</div>
                                                <div style={{ fontWeight: 700, fontSize: "14px", color: "white", marginBottom: "4px" }}>{sl.label}</div>
                                                <div style={{ fontSize: "12px", color: "var(--gray-400)" }}>{sl.desc}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "32px" }}>
                                <div>
                                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--gray-300)", marginBottom: "8px" }}>City</label>
                                    <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Toronto" style={inputStyle} />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--gray-300)", marginBottom: "8px" }}>Date of Birth</label>
                                    <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} required style={inputStyle} />
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: "12px" }}>
                                <button type="button" onClick={() => setStep(1)} style={{ padding: "16px 24px", borderRadius: "12px", background: "rgba(255,255,255,0.05)", color: "white", border: "1px solid var(--gray-800)", fontWeight: 700, fontSize: "15px", cursor: "pointer" }}>
                                    Back
                                </button>
                                <button type="submit" disabled={loading} style={{ flex: 1, padding: "16px", borderRadius: "12px", background: loading ? "var(--gray-700)" : "var(--primary)", color: "var(--color-bg)", border: "none", fontWeight: 800, fontSize: "15px", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                                    {loading ? "Creating account..." : "Complete Registration"}
                                    {!loading && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><path d="m9 18 6-6-6-6" /></svg>}
                                </button>
                            </div>
                        </form>
                    )}

                </div>
            </main>

            {/* Footer */}
            <footer style={{ padding: "32px", textAlign: "center", fontSize: "12px", color: "var(--gray-500)", display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
                <div>
                    Already have an account? <a href="/auth/login" style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 700 }}>Log In</a>
                </div>
                <div style={{ display: "flex", gap: "24px" }}>
                    <a href="#" style={{ color: "var(--gray-500)", textDecoration: "none" }}>Terms of Service</a>
                    <a href="#" style={{ color: "var(--gray-500)", textDecoration: "none" }}>Privacy Policy</a>
                    <a href="#" style={{ color: "var(--gray-500)", textDecoration: "none" }}>Contact Support</a>
                </div>
            </footer>
        </div>
    );
}

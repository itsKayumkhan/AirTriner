"use client";

import { Leaf, Dumbbell, TrendingUp, Trophy, Star, Users, Eye, EyeOff } from "lucide-react";
import { useState, Suspense } from "react";
import { registerUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/components/ui/Toast";
import LocationAutocomplete, { type LocationValue } from "@/components/forms/LocationAutocomplete";

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

function RegisterForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [step, setStep] = useState(1);
    const [role, setRole] = useState<"athlete" | "trainer" | "">(
        searchParams.get("role") === "trainer" ? "trainer" : "athlete"
    );

    // Step 1
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    // Step 2
    const [selectedSports, setSelectedSports] = useState<string[]>([]);
    const [skillLevel, setSkillLevel] = useState("");
    const [city, setCity] = useState("");
    const [locationData, setLocationData] = useState<LocationValue>(null);
    const [dateOfBirth, setDateOfBirth] = useState("");

    const [loading, setLoading] = useState(false);
    const handleStep1Submit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!role) {
            toast.error("Please select a role");
            return;
        }
        if (!fullName.trim().includes(" ")) {
            toast.error("Please enter both first and last name");
            return;
        }

        // Fix D: client-side email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            toast.error("Please enter a valid email address");
            return;
        }

        // Fix C: match backend password requirements (12+ chars, complexity)
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()\-_=+])[A-Za-z\d@$!%*?&#^()\-_=+]{12,}$/;
        if (!passwordRegex.test(password)) {
            toast.error("Password must be at least 12 characters with uppercase, lowercase, number, and special character");
            return;
        }

        // Fix B: confirm password check
        if (password !== confirmPassword) {
            toast.error("Passwords do not match");
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

        if (selectedSports.length === 0) {
            toast.error("Please select at least one sport");
            setLoading(false);
            return;
        }

        // Fix F: client-side age validation
        if (dateOfBirth) {
            const dob = new Date(dateOfBirth);
            const today = new Date();
            const eighteenYearsAgo = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
            if (dob > eighteenYearsAgo) {
                toast.error("You must be at least 18 years old to register");
                setLoading(false);
                return;
            }
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
                ...(role === "athlete" ? { skillLevel: skillLevel || undefined } : {}),
                city: city || undefined,
            });
            router.push(role === "trainer" ? "/dashboard/trainer/setup" : "/dashboard");
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Registration failed");
            setLoading(false);
        }
    };

    const handleOAuth = async (provider: "google" | "apple") => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: window.location.origin + "/auth/callback",
            },
        });
        if (error) toast.error(error.message);
    };

    const inputStyle: React.CSSProperties = {
        width: "100%", padding: "16px", paddingRight: "48px", borderRadius: "12px", border: "1px solid var(--gray-800)",
        background: "rgba(255,255,255,0.03)", color: "white", fontSize: "15px", outline: "none", transition: "all 0.2s"
    };

    return (
        <div style={{ minHeight: "100vh", background: "var(--color-bg)", color: "white", fontFamily: "var(--font-sans)", display: "flex", flexDirection: "column" }}>

            {/* Header */}
            <header style={{ padding: "24px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                className="sm:px-12 md:px-12"
            >
                <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: "12px", textDecoration: "none" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "8px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--zinc-900)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        <img src="/logo.jpeg" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    <span style={{ fontSize: "20px", fontWeight: 900, fontFamily: "var(--font-display)", color: "white", textTransform: "uppercase", letterSpacing: "1px" }}>AirTrainr</span>
                </a>

                <div style={{ fontSize: "14px", color: "var(--gray-400)", display: "flex", alignItems: "center", gap: "16px" }}>
                    <span className="hidden sm:inline">Ready to start?</span>
                    <a href="/auth/login" style={{ padding: "8px 20px", border: "1px solid var(--gray-700)", borderRadius: "var(--radius-full)", color: "white", textDecoration: "none", fontWeight: 600, transition: "background 0.2s" }} onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>Log In</a>
                </div>
            </header>

            {/* Main Content */}
            <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
                className="sm:px-8"
            >
                <div style={{ width: "100%", maxWidth: step === 1 ? "480px" : "600px", transition: "max-width 0.3s" }}>

                    {/* Step indicator */}
                    <div style={{ marginBottom: "32px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--primary)", fontSize: "12px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>
                            <span>STEP {step} OF 2</span>
                            <span style={{ color: "var(--gray-500)" }}>{step === 1 ? "50%" : "100%"} Complete</span>
                        </div>
                        <h1 style={{ fontSize: "clamp(24px, 6vw, 32px)", fontWeight: 900, fontFamily: "var(--font-display)", marginBottom: "16px" }}>
                            {step === 1 ? "Create Your Account" : "Personalize Your Profile"}
                        </h1>
                        <div style={{ height: "4px", background: "var(--gray-800)", borderRadius: "2px", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: step === 1 ? "50%" : "100%", background: "var(--primary)", transition: "width 0.3s ease-out" }} />
                        </div>
                    </div>

                    {step === 1 ? (
                        <form onSubmit={handleStep1Submit}>
                            {/* Fix G: Role cards — stack on mobile, side by side on sm+ */}
                            <div style={{ marginBottom: "24px" }}>
                                <label style={{ display: "block", fontSize: "14px", fontWeight: 700, marginBottom: "12px" }}>I am signing up as...</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {[
                                        { id: "athlete", icon: <Dumbbell className="w-8 h-8 text-primary" />, title: "Athlete", desc: "Access personalized programs, track metrics, and compete." },
                                        { id: "trainer", icon: <Users className="w-8 h-8 text-primary" />, title: "Trainer", desc: "Manage clients, build routines, and scale your business." }
                                    ].map(r => (
                                        <div key={r.id} onClick={() => setRole(r.id as "athlete" | "trainer")}
                                            style={{
                                                padding: "20px", borderRadius: "16px", cursor: "pointer", transition: "all 0.2s",
                                                background: role === r.id ? "rgba(69,208,255,0.02)" : "rgba(255,255,255,0.03)",
                                                border: `2px solid ${role === r.id ? "var(--primary)" : "transparent"}`
                                            }}
                                        >
                                            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: role === r.id ? "rgba(69,208,255,0.1)" : "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", marginBottom: "16px" }}>{r.icon}</div>
                                            <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "6px" }}>{r.title}</div>
                                            <div style={{ fontSize: "12px", color: "var(--gray-400)", lineHeight: 1.5 }}>{r.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Fix E: autoComplete="name" */}
                            <div style={{ marginBottom: "20px" }}>
                                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "white", marginBottom: "8px" }}>Full Name</label>
                                <div style={{ position: "relative" }}>
                                    <input
                                        type="text"
                                        autoComplete="name"
                                        value={fullName}
                                        onChange={e => setFullName(e.target.value)}
                                        placeholder="Enter your full name"
                                        required
                                        style={{ ...inputStyle, paddingLeft: "40px" }}
                                    />
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: "12px", top: "16px" }}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                </div>
                            </div>

                            {/* Fix E: autoComplete="email" */}
                            <div style={{ marginBottom: "20px" }}>
                                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "white", marginBottom: "8px" }}>Email Address</label>
                                <div style={{ position: "relative" }}>
                                    <input
                                        type="email"
                                        autoComplete="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="name@example.com"
                                        required
                                        style={{ ...inputStyle, paddingLeft: "40px" }}
                                    />
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: "12px", top: "16px" }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                                </div>
                            </div>

                            {/* Fix C & E: updated password hint + autoComplete="new-password" */}
                            <div style={{ marginBottom: "20px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                    <label style={{ fontSize: "12px", fontWeight: 700, color: "white" }}>Password</label>
                                    <span style={{ fontSize: "11px", color: "var(--gray-500)" }}>Min. 12 chars • Uppercase • Lowercase • Number • Special char</span>
                                </div>
                                <div style={{ position: "relative" }}>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="new-password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        minLength={12}
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

                            {/* Fix B: Confirm Password field */}
                            <div style={{ marginBottom: "32px" }}>
                                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "white", marginBottom: "8px" }}>Confirm Password</label>
                                <div style={{ position: "relative" }}>
                                    <input
                                        type="password"
                                        autoComplete="new-password"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        style={{ ...inputStyle, paddingLeft: "40px" }}
                                    />
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--gray-500)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: "12px", top: "16px" }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                                </div>
                            </div>

                            {/* Fix G: w-full button */}
                            <button type="submit" style={{ width: "100%", padding: "16px", borderRadius: "12px", background: "var(--primary)", color: "var(--color-bg)", border: "none", fontWeight: 800, fontSize: "15px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", cursor: "pointer", transition: "all 0.2s" }}>
                                Continue to Personalization
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"><path d="m9 18 6-6-6-6" /></svg>
                            </button>

                            {/* OAuth divider */}
                            <div style={{ display: "flex", alignItems: "center", margin: "28px 0 20px" }}>
                                <div style={{ flex: 1, height: "1px", background: "var(--gray-800)" }}></div>
                                <span style={{ padding: "0 16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--gray-500)" }}>OR SIGN UP WITH</span>
                                <div style={{ flex: 1, height: "1px", background: "var(--gray-800)" }}></div>
                            </div>

                            <div style={{ display: "flex", gap: "16px" }}>
                                <button
                                    type="button"
                                    onClick={() => handleOAuth("google")}
                                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "14px", background: "white", border: "1px solid var(--gray-800)", borderRadius: "12px", color: "#3c4043", fontSize: "14px", fontWeight: 600, cursor: "pointer", transition: "background 0.2s" }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#f5f5f5"}
                                    onMouseLeave={e => e.currentTarget.style.background = "white"}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l2.85-2.22.83-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                                    Google
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleOAuth("apple")}
                                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "14px", background: "#000", border: "1px solid var(--gray-800)", borderRadius: "12px", color: "white", fontSize: "14px", fontWeight: 600, cursor: "pointer", transition: "background 0.2s" }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#1a1a1a"}
                                    onMouseLeave={e => e.currentTarget.style.background = "#000"}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.15 2.95.92 3.78 2.29-3.95 2.05-3.07 7.02.82 8.58-.75 1.25-1.6 2.38-3.25 2.14m-3.29-12.8c-.28-1.58.91-3.32 2.45-3.79.43 1.83-1.01 3.41-2.45 3.79z" /></svg>
                                    Apple
                                </button>
                            </div>
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
                                    {/* Fix G: skill level grid — 1 col on mobile, 2 cols on sm+ */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {SKILL_LEVELS.map(sl => (
                                            <div key={sl.value} onClick={() => setSkillLevel(sl.value)} style={{
                                                padding: "16px", borderRadius: "12px", cursor: "pointer", transition: "all 0.2s",
                                                background: skillLevel === sl.value ? "rgba(69,208,255,0.05)" : "rgba(255,255,255,0.03)",
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

                            {/* Fix G: city/dob — stack on mobile, side by side on sm+ */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ marginBottom: "32px" }}>
                                <div>
                                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--gray-300)", marginBottom: "8px" }}>City</label>
                                    <LocationAutocomplete
                                        value={locationData}
                                        onChange={(loc: LocationValue) => {
                                            setLocationData(loc);
                                            setCity(loc?.city || "");
                                        }}
                                        placeholder="Start typing a city..."
                                    />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--gray-300)", marginBottom: "8px" }}>Date of Birth</label>
                                    <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} required style={inputStyle} />
                                </div>
                            </div>

                            {/* Fix G: buttons — stack on mobile */}
                            <div className="flex flex-col sm:flex-row gap-3">
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
            <footer style={{ padding: "32px 16px", textAlign: "center", fontSize: "12px", color: "var(--gray-500)", display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" }}>
                <div>
                    Already have an account? <a href="/auth/login" style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 700 }}>Log In</a>
                </div>
                <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
                    <a href="#" style={{ color: "var(--gray-500)", textDecoration: "none" }}>Terms of Service</a>
                    <a href="#" style={{ color: "var(--gray-500)", textDecoration: "none" }}>Privacy Policy</a>
                    <a href="#" style={{ color: "var(--gray-500)", textDecoration: "none" }}>Contact Support</a>
                </div>
            </footer>
        </div>
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--color-bg)" }} />}>
            <RegisterForm />
        </Suspense>
    );
}

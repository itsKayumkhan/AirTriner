"use client";

import { useState, Suspense } from "react";
import { loginUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Eye, EyeOff } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/components/ui/Toast";

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    // Fix A: functional rememberMe state
    const [rememberMe, setRememberMe] = useState(false);

    const handleOAuth = async (provider: "google" | "apple") => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: window.location.origin + "/auth/callback",
            },
        });
        if (error) toast.error(error.message);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const user = await loginUser(email, password);

            // Fix A: set long-lived cookie when rememberMe is checked
            if (rememberMe && typeof document !== "undefined") {
                document.cookie = `airtrainr_token=1; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
            }

            // Fix C: honour ?returnTo redirect after login
            const returnTo = searchParams.get("returnTo");
            router.push(returnTo || (user.role === "admin" ? "/admin" : "/dashboard"));
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        // Fix D: full-width flex on mobile, two-column grid on md+
        <div className="flex flex-col md:grid md:grid-cols-2" style={{ minHeight: "100vh", background: "var(--color-bg)", color: "white", fontFamily: "var(--font-sans)" }}>

            {/* Left Panel — hidden on mobile, visible md+ */}
            <div className="hidden md:flex left-panel" style={{ position: "relative" }}>
                <div style={{
                    position: "absolute", inset: 0,
                    backgroundImage: "linear-gradient(to right, rgba(9,9,11,0.2), rgba(9,9,11,0.9)), url('https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=1470&auto=format&fit=crop')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    display: "flex", flexDirection: "column", justifyContent: "space-between",
                    padding: "48px"
                }}>
                    <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: "12px", textDecoration: "none" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "8px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--zinc-900)", border: "1px solid rgba(255,255,255,0.1)" }}>
                            <img src="/logo.jpeg" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                        <span style={{ fontSize: "20px", fontWeight: 900, fontFamily: "var(--font-display)", color: "white", textTransform: "uppercase", letterSpacing: "1px" }}>AirTrainr</span>
                    </a>

                    <div>
                        <h1 style={{ fontSize: "clamp(40px, 5vw, 64px)", fontWeight: 900, fontFamily: "var(--font-display)", textTransform: "uppercase", lineHeight: 1, marginBottom: "24px" }}>
                            <span style={{ fontStyle: "italic", color: "white" }}>ELEVATE YOUR</span><br />
                            <span style={{ fontStyle: "italic", color: "var(--primary)" }}>PERFORMANCE.</span>
                        </h1>
                        <p style={{ fontSize: "18px", color: "var(--gray-300)", maxWidth: "400px", lineHeight: 1.6 }}>
                            The intelligence-driven platform for elite physical training and athlete optimization.
                        </p>
                    </div>

                    <div style={{ display: "flex", gap: "24px", fontSize: "12px", color: "var(--gray-400)", fontWeight: 500 }}>
                        <span>© 2026 Airtrainr</span>
                        <a href="#" style={{ color: "var(--gray-400)", textDecoration: "none" }}>Privacy Policy</a>
                    </div>
                </div>
            </div>

            {/* Right Panel — Login Form */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
                className="w-full px-4 sm:px-8 md:px-12"
            >
                <div style={{ width: "100%", maxWidth: "440px" }}>

                    {/* Mobile Logo — visible only below md */}
                    <div className="md:hidden" style={{ marginBottom: "40px" }}>
                        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: "12px", textDecoration: "none" }}>
                            <div style={{ width: "36px", height: "36px", borderRadius: "8px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--zinc-900)", border: "1px solid rgba(255,255,255,0.1)" }}>
                                <img src="/logo.jpeg" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            </div>
                            <span style={{ fontSize: "20px", fontWeight: 900, fontFamily: "var(--font-display)", color: "white", textTransform: "uppercase", letterSpacing: "1px" }}>AirTrainr</span>
                        </a>
                    </div>

                    <div style={{ marginBottom: "40px" }}>
                        <h2 style={{ fontSize: "clamp(24px, 6vw, 32px)", fontWeight: 900, fontFamily: "var(--font-display)", marginBottom: "8px" }}>Welcome Back</h2>
                        <p style={{ color: "var(--gray-400)", fontSize: "14px" }}>Enter your credentials to access your dashboard</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {/* Fix B: autoComplete="email" */}
                        <div style={{ marginBottom: "24px" }}>
                            <label style={{ display: "block", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px", color: "var(--gray-300)" }}>Email Address</label>
                            <input
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@domain.com"
                                required
                                style={{
                                    width: "100%", padding: "16px", borderRadius: "12px", border: "1px solid var(--gray-800)",
                                    background: "rgba(255,255,255,0.03)", color: "white", fontSize: "15px", outline: "none", transition: "all 0.2s"
                                }}
                                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.background = "rgba(69,208,255,0.02)"; }}
                                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--gray-800)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                            />
                        </div>

                        {/* Fix B: autoComplete="current-password" */}
                        <div style={{ marginBottom: "24px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                                <label style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", color: "var(--gray-300)" }}>Password</label>
                                <a href="/auth/forgot-password" style={{ fontSize: "12px", color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}>Forgot password?</a>
                            </div>
                            <div style={{ position: "relative" }}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    style={{
                                        width: "100%", padding: "16px", paddingRight: "48px", borderRadius: "12px", border: "1px solid var(--gray-800)",
                                        background: "rgba(255,255,255,0.03)", color: "white", fontSize: "15px", outline: "none", transition: "all 0.2s"
                                    }}
                                    onFocus={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.background = "rgba(69,208,255,0.02)"; }}
                                    onBlur={(e) => { e.currentTarget.style.borderColor = "var(--gray-800)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--gray-500)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        {/* Fix A: connected rememberMe checkbox */}
                        <div style={{ marginBottom: "32px", display: "flex", alignItems: "center", gap: "10px" }}>
                            <input
                                type="checkbox"
                                id="remember"
                                checked={rememberMe}
                                onChange={e => setRememberMe(e.target.checked)}
                                style={{ width: "16px", height: "16px", accentColor: "var(--primary)", background: "var(--gray-900)", border: "1px solid var(--gray-700)", borderRadius: "4px" }}
                            />
                            <label htmlFor="remember" style={{ fontSize: "13px", color: "var(--gray-400)", cursor: "pointer" }}>Remember this device for 30 days</label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: "100%", padding: "16px", borderRadius: "12px",
                                background: loading ? "var(--gray-700)" : "var(--primary)", color: "var(--color-bg)",
                                border: "none", fontWeight: 800, fontSize: "15px", textTransform: "uppercase", letterSpacing: "1px",
                                cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s",
                            }}
                        >
                            {loading ? "Logging in..." : "LOG IN"}
                        </button>
                    </form>

                    <div style={{ display: "flex", alignItems: "center", margin: "32px 0" }}>
                        <div style={{ flex: 1, height: "1px", background: "var(--gray-800)" }}></div>
                        <span style={{ padding: "0 16px", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--gray-500)" }}>OR CONTINUE WITH</span>
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

                    <p style={{ textAlign: "center", marginTop: "32px", fontSize: "13px", color: "var(--gray-400)" }}>
                        Don&apos;t have an account?{" "}
                        <a href="/auth/register" style={{ color: "var(--primary)", textDecoration: "none", fontWeight: 700 }}>Sign up</a>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--color-bg)" }} />}>
            <LoginForm />
        </Suspense>
    );
}

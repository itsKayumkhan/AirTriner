"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { setSession, AuthUser } from "@/lib/auth";
import type { UserRow, TrainerProfileRow, AthleteProfileRow } from "@/lib/supabase";

export default function AuthCallbackPage() {
    const router = useRouter();
    const [status, setStatus] = useState<"loading" | "error">("loading");
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // Supabase exchanges the code from the URL hash/query automatically
                // when getSession() is called after an OAuth redirect.
                const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

                if (sessionError || !sessionData.session) {
                    throw new Error(sessionError?.message || "No session found after OAuth redirect.");
                }

                const authSupabaseUser = sessionData.session.user;
                const email = authSupabaseUser.email?.toLowerCase().trim();

                if (!email) {
                    throw new Error("OAuth provider did not return an email address.");
                }

                // Try to find an existing user profile by Supabase auth UID first,
                // then fall back to email lookup.
                let { data: userRow } = await supabase
                    .from("users")
                    .select("*")
                    .eq("id", authSupabaseUser.id)
                    .single();

                if (!userRow) {
                    const { data: byEmail } = await supabase
                        .from("users")
                        .select("*")
                        .eq("email", email)
                        .single();
                    userRow = byEmail;
                }

                // New OAuth user — no profile in our users table yet.
                // Send them to register step 2 so they can pick a role & sport.
                if (!userRow) {
                    // Store minimal info in localStorage so the register page can
                    // pre-fill and complete account creation.
                    if (typeof window !== "undefined") {
                        localStorage.setItem(
                            "airtrainr_oauth_pending",
                            JSON.stringify({
                                id: authSupabaseUser.id,
                                email,
                                name: authSupabaseUser.user_metadata?.full_name || "",
                                avatarUrl: authSupabaseUser.user_metadata?.avatar_url || null,
                            })
                        );
                    }
                    router.replace("/auth/register?oauth=1&step=2");
                    return;
                }

                const u = userRow as UserRow;

                // Guard suspended/deleted accounts
                if (u.is_suspended || u.deleted_at) {
                    await supabase.auth.signOut();
                    throw new Error("Your account has been suspended. Please contact support.");
                }

                // Fetch role-specific profile
                let trainerProfile: TrainerProfileRow | null = null;
                let athleteProfile: AthleteProfileRow | null = null;

                if (u.role === "trainer") {
                    const { data } = await supabase
                        .from("trainer_profiles")
                        .select("*")
                        .eq("user_id", u.id)
                        .single();
                    trainerProfile = data as TrainerProfileRow | null;
                } else if (u.role === "athlete") {
                    const { data } = await supabase
                        .from("athlete_profiles")
                        .select("*")
                        .eq("user_id", u.id)
                        .single();
                    athleteProfile = data as AthleteProfileRow | null;
                }

                // Update last login
                await supabase
                    .from("users")
                    .update({ last_login_at: new Date().toISOString() })
                    .eq("id", u.id);

                const authUser: AuthUser = {
                    id: u.id,
                    email: u.email,
                    role: u.role,
                    firstName: u.first_name,
                    lastName: u.last_name,
                    isApproved: u.is_approved || false,
                    avatarUrl: u.avatar_url,
                    trainerProfile,
                    athleteProfile,
                };

                setSession(authUser);

                const destination =
                    u.role === "admin"
                        ? "/admin"
                        : u.role === "trainer"
                        ? "/dashboard"
                        : "/dashboard";

                router.replace(destination);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Authentication failed";
                setErrorMsg(message);
                setStatus("error");
            }
        };

        handleCallback();
    }, [router]);

    return (
        <div
            style={{
                minHeight: "100vh",
                background: "var(--color-bg)",
                color: "white",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-sans)",
                gap: "24px",
            }}
        >
            {status === "loading" ? (
                <>
                    {/* Spinner */}
                    <div
                        style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "50%",
                            border: "3px solid var(--gray-800)",
                            borderTop: "3px solid var(--primary)",
                            animation: "spin 0.8s linear infinite",
                        }}
                    />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    <p style={{ color: "var(--gray-400)", fontSize: "15px" }}>Completing sign-in&hellip;</p>
                </>
            ) : (
                <>
                    <div
                        style={{
                            padding: "12px 16px",
                            borderRadius: "var(--radius-md)",
                            background: "rgba(239,68,68,0.1)",
                            borderLeft: "4px solid var(--error)",
                            color: "var(--error)",
                            fontSize: "14px",
                            maxWidth: "440px",
                            textAlign: "center",
                        }}
                    >
                        {errorMsg}
                    </div>
                    <a
                        href="/auth/login"
                        style={{
                            padding: "12px 28px",
                            borderRadius: "12px",
                            background: "var(--primary)",
                            color: "var(--color-bg)",
                            fontWeight: 700,
                            fontSize: "14px",
                            textDecoration: "none",
                        }}
                    >
                        Back to Login
                    </a>
                </>
            )}
        </div>
    );
}

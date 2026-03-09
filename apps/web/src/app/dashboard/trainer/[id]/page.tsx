"use client";

import { Search, Trophy, TrendingUp, Wallet, CheckCircle, ArrowLeft, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase, TrainerProfileRow, ReviewRow } from "@/lib/supabase";

type TrainerData = TrainerProfileRow & {
    user: { first_name: string; last_name: string; email: string };
    is_performance_verified: boolean;
};

type ReviewWithReviewer = ReviewRow & {
    reviewer?: { first_name: string; last_name: string };
};

export default function TrainerProfilePage() {
    const params = useParams();
    const router = useRouter();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [trainer, setTrainer] = useState<TrainerData | null>(null);
    const [reviews, setReviews] = useState<ReviewWithReviewer[]>([]);
    const [loading, setLoading] = useState(true);
    const [requireVerification, setRequireVerification] = useState(true);

    const trainerId = params.id as string;

    useEffect(() => {
        const session = getSession();
        if (session) setUser(session);
        loadTrainer();
    }, [trainerId]);

    const loadTrainer = async () => {
        try {
            // 1. Fetch Platform Settings
            const { data: settings } = await supabase
                .from("platform_settings")
                .select("require_trainer_verification")
                .single();
            
            if (settings) {
                setRequireVerification(settings.require_trainer_verification);
            }

            // 2. Get trainer profile
            const { data: tp } = await supabase
                .from("trainer_profiles")
                .select("*")
                .eq("user_id", trainerId)
                .single();

            if (!tp) {
                setLoading(false);
                return;
            }

            // 3. Get user info
            const { data: userData } = await supabase
                .from("users")
                .select("first_name, last_name, email")
                .eq("id", trainerId)
                .single();

            // 4. Get Dispute count
            const { data: disputesData } = await supabase
                .from("disputes")
                .select("id, booking:bookings!inner(trainer_id)")
                .eq("booking.trainer_id", trainerId);
            
            const disputeCount = (disputesData || []).length;

            const isPerformanceVerified = 
                (tp.total_sessions || 0) >= 3 && 
                disputeCount === 0 && 
                Number(tp.completion_rate) >= 95 && 
                Number(tp.reliability_score) >= 95;

            setTrainer({
                ...(tp as TrainerProfileRow),
                user: userData as { first_name: string; last_name: string; email: string },
                is_performance_verified: isPerformanceVerified
            });

            // 4. Get reviews
            const { data: reviewData } = await supabase
                .from("reviews")
                .select("*")
                .eq("reviewee_id", trainerId)
                .order("created_at", { ascending: false })
                .limit(10);

            if (reviewData && reviewData.length > 0) {
                const reviewerIds = (reviewData as ReviewRow[]).map((r) => r.reviewer_id);
                const { data: reviewers } = await supabase
                    .from("users")
                    .select("id, first_name, last_name")
                    .in("id", [...new Set(reviewerIds)]);

                const rMap = new Map(
                    (reviewers || []).map((u: { id: string; first_name: string; last_name: string }) => [u.id, u])
                );
                setReviews(
                    (reviewData as ReviewRow[]).map((r) => ({
                        ...r,
                        reviewer: rMap.get(r.reviewer_id) as { first_name: string; last_name: string } | undefined,
                    }))
                );
            }
        } catch (err) {
            console.error("Failed to load trainer:", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: "80px 20px" }}>
                <div style={{ width: "40px", height: "40px", border: "3px solid var(--gray-200)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            </div>
        );
    }

    if (!trainer) {
        return (
            <div style={{ textAlign: "center", padding: "80px 20px" }}>
                <Search className="text-text-main/60 w-12 h-12 mb-4 mx-auto" />
                <h2 style={{ fontWeight: 700, marginBottom: "8px" }}>Trainer not found</h2>
                <button onClick={() => router.back()} style={{ padding: "10px 24px", borderRadius: "var(--radius-md)", background: "var(--gradient-primary)", color: "white", border: "none", fontWeight: 600, cursor: "pointer" }}>
                    Go Back
                </button>
            </div>
        );
    }

    const avgRating = trainer.average_rating ? Number(trainer.average_rating).toFixed(1) : "New";

    return (
        <div>
            <button onClick={() => router.back()} style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--gray-500)", fontSize: "14px", border: "none", background: "none", cursor: "pointer", marginBottom: "20px", fontWeight: 500 }}>
                <ArrowLeft className="inline-block w-4 h-4 mr-1" /> Back
            </button>

            {/* Hero */}
            <div style={{ background: "var(--surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--gray-200)", overflow: "hidden", marginBottom: "24px" }}>
                <div style={{ height: "120px", background: "var(--gradient-primary)" }} />
                <div style={{ padding: "0 32px 32px", marginTop: "-48px" }}>
                    <div style={{ display: "flex", gap: "20px", alignItems: "flex-end", flexWrap: "wrap" }}>
                        <div style={{ width: "96px", height: "96px", borderRadius: "var(--radius-full)", background: "var(--gradient-accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: "34px", fontFamily: "var(--font-display)", border: "4px solid var(--surface)" }}>
                            {trainer.user.first_name[0]}{trainer.user.last_name[0]}
                        </div>
                        <div style={{ flex: 1, paddingBottom: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                                <h1 style={{ fontSize: "26px", fontWeight: 800, fontFamily: "var(--font-display)" }}>
                                    {trainer.user.first_name} {trainer.user.last_name}
                                </h1>
                                {trainer.is_performance_verified && (
                                    <span style={{ padding: "4px 12px", borderRadius: "var(--radius-full)", background: "rgba(163,255,18,0.1)", color: "var(--primary)", fontSize: "12px", fontWeight: 700, border: "1px solid rgba(163,255,18,0.2)" }}>
                                        <CheckCircle className="inline-block w-4 h-4 mr-1 text-primary" /> Performance Verified
                                    </span>
                                )}
                                {!trainer.is_performance_verified && trainer.total_sessions > 0 && (
                                    <span style={{ padding: "4px 12px", borderRadius: "var(--radius-full)", background: "rgba(96,165,250,0.1)", color: "#60a5fa", fontSize: "12px", fontWeight: 700, border: "1px solid rgba(96,165,250,0.2)" }}>
                                        Pro Coach
                                    </span>
                                )}
                            </div>
                            {trainer.headline && (
                                <p style={{ fontSize: "15px", color: "var(--gray-500)", marginTop: "4px" }}>{trainer.headline}</p>
                            )}
                        </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: "flex", gap: "24px", marginTop: "20px", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Star className="text-primary w-5 h-5 mx-auto" />
                            <span style={{ fontWeight: 700, fontSize: "16px" }}>{avgRating}</span>
                            <span style={{ color: "var(--gray-400)", fontSize: "13px" }}>({trainer.total_reviews || 0} reviews)</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Wallet className="text-primary w-5 h-5 mx-auto" />
                            <span style={{ fontWeight: 700, fontSize: "16px" }}>${Number(trainer.hourly_rate)}</span>
                            <span style={{ color: "var(--gray-400)", fontSize: "13px" }}>/hour</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Trophy className="text-primary w-5 h-5 mx-auto" />
                            <span style={{ fontWeight: 700, fontSize: "16px" }}>{trainer.years_experience}</span>
                            <span style={{ color: "var(--gray-400)", fontSize: "13px" }}>years exp.</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <TrendingUp className="text-primary w-5 h-5 mx-auto" />
                            <span style={{ fontWeight: 700, fontSize: "16px" }}>{Number(trainer.completion_rate || 100).toFixed(0)}%</span>
                            <span style={{ color: "var(--gray-400)", fontSize: "13px" }}>completion</span>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "24px" }}>
                {/* Left */}
                <div>
                    {/* Bio */}
                    {trainer.bio && (
                        <div style={{ background: "var(--surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--gray-200)", padding: "28px", marginBottom: "24px" }}>
                            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "12px", fontFamily: "var(--font-display)" }}>About</h3>
                            <p style={{ fontSize: "14px", color: "var(--gray-600)", lineHeight: 1.7 }}>{trainer.bio}</p>
                        </div>
                    )}

                    {/* Sports */}
                    <div style={{ background: "var(--surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--gray-200)", padding: "28px", marginBottom: "24px" }}>
                        <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "12px", fontFamily: "var(--font-display)" }}>Sports</h3>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            {trainer.sports.map((s: string) => (
                                <span key={s} style={{ padding: "6px 14px", borderRadius: "var(--radius-full)", background: "var(--primary-50)", color: "var(--primary)", fontSize: "13px", fontWeight: 600, textTransform: "capitalize" }}>
                                    {s.replace(/_/g, " ")}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Reviews */}
                    <div style={{ background: "var(--surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--gray-200)", padding: "28px" }}>
                        <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "16px", fontFamily: "var(--font-display)" }}>
                            Reviews ({reviews.length})
                        </h3>
                        {reviews.length === 0 ? (
                            <p style={{ color: "var(--gray-400)", fontSize: "14px" }}>No reviews yet.</p>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                                {reviews.map((r) => (
                                    <div key={r.id} style={{ paddingBottom: "16px", borderBottom: "1px solid var(--gray-50)" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                                            <div style={{ width: "32px", height: "32px", borderRadius: "var(--radius-full)", background: "var(--gradient-accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "11px" }}>
                                                {r.reviewer ? `${r.reviewer.first_name[0]}${r.reviewer.last_name[0]}` : "?"}
                                            </div>
                                            <div>
                                                <span style={{ fontWeight: 600, fontSize: "13px" }}>
                                                    {r.reviewer ? `${r.reviewer.first_name} ${r.reviewer.last_name}` : "Anonymous"}
                                                </span>
                                                <div style={{ fontSize: "12px", color: "#f59e0b" }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
                                            </div>
                                            <span style={{ fontSize: "12px", color: "var(--gray-400)", marginLeft: "auto" }}>
                                                {new Date(r.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        {r.review_text && (
                                            <p style={{ fontSize: "14px", color: "var(--gray-600)", lineHeight: 1.5 }}>{r.review_text}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right sidebar — Booking CTA */}
                <div>
                    <div style={{ background: "var(--surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--gray-200)", padding: "28px", position: "sticky", top: "20px" }}>
                        <div style={{ fontSize: "28px", fontWeight: 800, fontFamily: "var(--font-display)", marginBottom: "4px" }}>
                            ${Number(trainer.hourly_rate)}<span style={{ fontSize: "14px", fontWeight: 500, color: "var(--gray-400)" }}>/hr</span>
                        </div>
                        <p style={{ fontSize: "13px", color: "var(--gray-500)", marginBottom: "20px" }}>
                            3% platform fee applies at checkout
                        </p>

                        {requireVerification && !trainer.is_verified ? (
                            <div style={{ padding: "16px", borderRadius: "var(--radius-md)", background: "var(--gray-50)", border: "1px solid var(--gray-200)", textAlign: "center" }}>
                                <p style={{ fontSize: "13px", color: "var(--gray-500)", fontWeight: 600 }}>
                                    Booking Unavailable
                                </p>
                                <p style={{ fontSize: "12px", color: "var(--gray-400)", marginTop: "4px" }}>
                                    This trainer is awaiting verification from the admin.
                                </p>
                            </div>
                        ) : user?.role === "athlete" ? (
                            <a
                                href="/dashboard/search"
                                style={{
                                    display: "block", width: "100%", padding: "14px", borderRadius: "var(--radius-md)",
                                    background: "var(--gradient-primary)", color: "white", border: "none",
                                    fontWeight: 700, fontSize: "15px", cursor: "pointer", textAlign: "center", textDecoration: "none",
                                    boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)",
                                }}
                            >
                                Book Session
                            </a>
                        ) : (
                            <a
                                href="/auth/login"
                                style={{
                                    display: "block", width: "100%", padding: "14px", borderRadius: "var(--radius-md)",
                                    background: "var(--gradient-primary)", color: "white", border: "none",
                                    fontWeight: 700, fontSize: "15px", cursor: "pointer", textAlign: "center", textDecoration: "none",
                                    boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)",
                                }}
                            >
                                Sign Up to Book
                            </a>
                        )}

                        <div style={{ marginTop: "20px", borderTop: "1px solid var(--gray-100)", paddingTop: "16px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                <span style={{ fontSize: "13px", color: "var(--gray-500)" }}>Reliability</span>
                                <span style={{ fontSize: "13px", fontWeight: 600 }}>{Number(trainer.reliability_score || 100).toFixed(0)}%</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                                <span style={{ fontSize: "13px", color: "var(--gray-500)" }}>Completion Rate</span>
                                <span style={{ fontSize: "13px", fontWeight: 600 }}>{Number(trainer.completion_rate || 100).toFixed(0)}%</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ fontSize: "13px", color: "var(--gray-500)" }}>Total Sessions</span>
                                <span style={{ fontSize: "13px", fontWeight: 600 }}>{trainer.total_sessions || 0}+</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

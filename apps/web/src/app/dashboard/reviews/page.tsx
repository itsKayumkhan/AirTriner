"use client";

import { FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase, ReviewRow } from "@/lib/supabase";

type ReviewWithUser = ReviewRow & {
    reviewer?: { first_name: string; last_name: string };
};

export default function ReviewsPage() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [reviews, setReviews] = useState<ReviewWithUser[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const session = getSession();
        if (session) {
            setUser(session);
            loadReviews(session);
        }
    }, []);

    const loadReviews = async (u: AuthUser) => {
        try {
            const { data: reviewData } = await supabase
                .from("reviews")
                .select("*")
                .eq("reviewee_id", u.id)
                .order("created_at", { ascending: false });

            const allReviews = (reviewData || []) as ReviewRow[];
            const reviewerIds = allReviews.map((r) => r.reviewer_id);

            const { data: reviewers } = await supabase
                .from("users")
                .select("id, first_name, last_name")
                .in("id", [...new Set(reviewerIds)]);

            const rMap = new Map((reviewers || []).map((u: { id: string; first_name: string; last_name: string }) => [u.id, u]));
            setReviews(
                allReviews.map((r) => ({
                    ...r,
                    reviewer: rMap.get(r.reviewer_id) as { first_name: string; last_name: string } | undefined,
                }))
            );
        } catch (err) {
            console.error("Failed to load reviews:", err);
        } finally {
            setLoading(false);
        }
    };

    const avgRating =
        reviews.length > 0
            ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
            : 0;

    const ratingDist = [5, 4, 3, 2, 1].map((n) => ({
        stars: n,
        count: reviews.filter((r) => r.rating === n).length,
        pct: reviews.length ? Math.round((reviews.filter((r) => r.rating === n).length / reviews.length) * 100) : 0,
    }));

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px" }}>
                <div style={{ width: "40px", height: "40px", border: "3px solid var(--gray-200)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            </div>
        );
    }

    return (
        <div>
            <div style={{ marginBottom: "28px" }}>
                <h1 style={{ fontSize: "24px", fontWeight: 800, fontFamily: "var(--font-display)", marginBottom: "4px" }}>My Reviews</h1>
                <p style={{ color: "var(--gray-500)", fontSize: "14px" }}>See what athletes are saying about your sessions.</p>
            </div>

            {/* Overall Rating */}
            <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "32px", background: "var(--surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--gray-200)", padding: "32px", marginBottom: "24px" }}>
                <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "52px", fontWeight: 800, fontFamily: "var(--font-display)", marginBottom: "4px" }}>{avgRating || "—"}</div>
                    <div style={{ fontSize: "22px", marginBottom: "4px" }}>
                        {"★".repeat(Math.round(avgRating))}
                        {"☆".repeat(5 - Math.round(avgRating))}
                    </div>
                    <div style={{ fontSize: "14px", color: "var(--gray-500)" }}>{reviews.length} review{reviews.length !== 1 ? "s" : ""}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "6px" }}>
                    {ratingDist.map((d) => (
                        <div key={d.stars} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{ fontSize: "13px", fontWeight: 600, width: "24px", color: "var(--gray-600)" }}>{d.stars}★</span>
                            <div style={{ flex: 1, height: "8px", borderRadius: "var(--radius-full)", background: "var(--gray-100)", overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${d.pct}%`, borderRadius: "var(--radius-full)", background: d.stars >= 4 ? "#10b981" : d.stars === 3 ? "#f59e0b" : "#ef4444" }} />
                            </div>
                            <span style={{ fontSize: "12px", color: "var(--gray-400)", width: "30px" }}>{d.count}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Reviews list */}
            {reviews.length === 0 ? (
                <div style={{ background: "var(--surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--gray-200)", padding: "60px 24px", textAlign: "center" }}>
                    <FileText className="text-text-main/60 w-10 h-10 mb-4 mx-auto" />
                    <p style={{ color: "var(--gray-500)" }}>No reviews yet. Complete sessions to start receiving reviews!</p>
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {reviews.map((review) => (
                        <div key={review.id} style={{ background: "var(--surface)", borderRadius: "var(--radius-lg)", border: "1px solid var(--gray-200)", padding: "24px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                                <div style={{ width: "40px", height: "40px", borderRadius: "var(--radius-full)", background: "var(--gradient-accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "14px" }}>
                                    {review.reviewer ? `${review.reviewer.first_name[0]}${review.reviewer.last_name[0]}` : "?"}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: "14px" }}>
                                        {review.reviewer ? `${review.reviewer.first_name} ${review.reviewer.last_name}` : "Anonymous"}
                                    </div>
                                    <div style={{ fontSize: "12px", color: "var(--gray-400)" }}>
                                        {new Date(review.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                                    </div>
                                </div>
                                <div style={{ fontSize: "16px", color: "#f59e0b" }}>
                                    {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                                </div>
                            </div>
                            {review.review_text && (
                                <p style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--gray-600)" }}>{review.review_text}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

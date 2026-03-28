"use client";

import { FileText, Download } from "lucide-react";
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
    const [error, setError] = useState<string | null>(null);

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
            setError("Failed to load reviews. Please refresh the page.");
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

    const exportCSV = () => {
        if (reviews.length === 0) return;
        const headers = ["Date", "Reviewer", "Rating", "Review"];
        const rows = reviews.map(r => [
            new Date(r.created_at).toLocaleDateString(),
            r.reviewer ? `${r.reviewer.first_name} ${r.reviewer.last_name}` : "Anonymous",
            r.rating,
            `"${(r.review_text || "").replace(/"/g, '""')}"`,
        ]);
        const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `reviews-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="flex justify-center flex-col items-center h-full min-h-[50vh]">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center min-h-[40vh]">
                <p className="text-text-main/50 font-semibold text-sm">{error}</p>
            </div>
        );
    }

    return (
        <div className="max-w-[1000px] w-full pb-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-black text-white mb-1">My Reviews</h1>
                    <p className="text-text-main/60 font-medium text-[15px]">See what athletes are saying about your sessions.</p>
                </div>
                <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-[#272A35] hover:bg-white/10 border border-white/[0.06] rounded-xl text-sm font-bold text-white transition-colors">
                    <Download size={16} /> Export CSV
                </button>
            </div>

            {/* Overall Rating */}
            <div className="bg-surface border border-white/[0.06] rounded-[20px] p-6 lg:p-8 mb-8 shadow-md flex flex-col md:flex-row gap-8 lg:gap-12 items-center md:items-stretch">
                <div className="text-center md:border-r border-white/[0.06] md:pr-12 md:mr-4 shrink-0 flex flex-col justify-center">
                    <div className="text-[64px] font-black font-display text-white leading-none tracking-tighter mb-2 shadow-sm drop-shadow-md">{avgRating || "—"}</div>
                    <div className="text-2xl mb-1 text-amber-500 tracking-widest drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]">
                        {"★".repeat(Math.round(avgRating))}
                        <span className="text-white/10">{"★".repeat(5 - Math.round(avgRating))}</span>
                    </div>
                    <div className="text-sm font-bold text-text-main/50 uppercase tracking-widest">
                        {reviews.length} {reviews.length === 1 ? 'Review' : 'Reviews'}
                    </div>
                </div>

                <div className="flex-1 flex flex-col justify-center gap-3 w-full max-w-sm">
                    {ratingDist.map((d) => (
                        <div key={d.stars} className="flex items-center gap-4 group">
                            <span className="text-[13px] font-black text-white/70 w-8 flex items-center justify-end gap-1">
                                {d.stars} <span className="text-amber-500">★</span>
                            </span>
                            <div className="flex-1 h-3 rounded-full bg-[#12141A] border border-white/[0.06] overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${d.stars >= 4 ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]" :
                                            d.stars === 3 ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]" :
                                                "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.4)]"
                                        }`}
                                    style={{ width: `${d.pct}%` }}
                                />
                            </div>
                            <span className="text-[12px] font-bold text-text-main/40 w-10">{d.count}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Reviews list */}
            {reviews.length === 0 ? (
                <div className="bg-surface border border-white/[0.06] rounded-[20px] p-16 text-center shadow-md">
                    <FileText className="text-text-main/20 w-12 h-12 mb-4 mx-auto" strokeWidth={1.5} />
                    <h3 className="text-white font-bold text-lg mb-2">No reviews yet</h3>
                    <p className="text-text-main/50 text-sm">Complete sessions to start receiving reviews!</p>
                </div>
            ) : (
                <div className="flex flex-col gap-5">
                    {reviews.map((review) => (
                        <div key={review.id} className="bg-surface border border-white/[0.06] rounded-[20px] p-6 lg:p-8 shadow-md hover:border-white/10 transition-colors">
                            <div className="flex flex-wrap sm:flex-nowrap items-start justify-between gap-4 mb-5">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-white/[0.06] text-text-main flex items-center justify-center font-black text-lg border border-white/[0.08] shrink-0">
                                        {review.reviewer ? `${review.reviewer.first_name[0]}${review.reviewer.last_name[0]}` : "?"}
                                    </div>
                                    <div>
                                        <div className="font-bold text-white text-[16px] mb-0.5">
                                            {review.reviewer ? `${review.reviewer.first_name} ${review.reviewer.last_name}` : "Anonymous"}
                                        </div>
                                        <div className="text-[12px] font-medium text-text-main/40">
                                            {new Date(review.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-[18px] text-amber-500 tracking-wider">
                                    {"★".repeat(review.rating)}
                                    <span className="text-white/10">{"★".repeat(5 - review.rating)}</span>
                                </div>
                            </div>
                            {review.review_text ? (
                                <p className="text-[14px] leading-relaxed text-text-main/70 bg-[#12141A] border border-white/[0.06] p-5 rounded-2xl">
                                    {review.review_text}
                                </p>
                            ) : (
                                <p className="text-[14px] leading-relaxed text-text-main/30 italic">
                                    No written review provided.
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

"use client";

import React from "react";
import { Star } from "lucide-react";

type Review = {
    id: string;
    reviewer_id: string;
    rating: number;
    review_text: string | null;
    created_at: string;
    reviewer: { 
        first_name: string; 
        last_name: string; 
        avatar_url: string | null 
    };
};

interface ReviewSectionProps {
    reviews: Review[];
    totalCount: number;
}

const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const ReviewSection: React.FC<ReviewSectionProps> = ({ reviews, totalCount }) => {
    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-white">Reviews</h2>
                <button className="text-primary font-bold text-sm">See all {totalCount}</button>
            </div>
            <div className="space-y-4">
                {reviews.length === 0 ? (
                    <div className="bg-[#1A1C23] border border-white/5 rounded-2xl p-8 text-center">
                        <p className="text-text-main/40 text-sm font-medium italic">No reviews yet for this trainer.</p>
                    </div>
                ) : (
                    reviews.map((review) => (
                        <div key={review.id} className="bg-[#1A1C23] border border-white/5 rounded-2xl p-6 transition-all hover:border-white/10">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#fce6cd] overflow-hidden flex items-center justify-center font-bold text-sm text-gray-900 border border-[#e5d2bc]">
                                        {review.reviewer.avatar_url ? (
                                            <img src={review.reviewer.avatar_url} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <span>{review.reviewer.first_name[0]}{review.reviewer.last_name[0]}</span>
                                        )}
                                    </div>
                                    <div>
                                        <div className="text-white font-bold text-sm">{review.reviewer.first_name} {review.reviewer.last_name}</div>
                                        <div className="text-text-main/40 text-[10px] mt-0.5 font-medium uppercase tracking-wider">{formatTimeAgo(review.created_at)}</div>
                                    </div>
                                </div>
                                <div className="flex gap-0.5 text-primary">
                                    {Array.from({ length: 5 }).map((_, s) => (
                                        <Star 
                                            key={s} 
                                            size={12} 
                                            className={s < review.rating ? "fill-current" : "text-gray-600/30"} 
                                        />
                                    ))}
                                </div>
                            </div>
                            <p className="text-text-main/80 text-sm leading-relaxed">
                                {review.review_text ? `“${review.review_text}”` : <span className="italic opacity-50">No written feedback provided.</span>}
                            </p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

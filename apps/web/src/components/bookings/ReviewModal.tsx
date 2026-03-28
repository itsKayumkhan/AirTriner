"use client";

import React from "react";
import { Star } from "lucide-react";

type BookingWithUser = {
    id: string;
    sport: string;
    other_user?: { first_name: string; last_name: string; email: string };
};

interface ReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    booking: BookingWithUser | null;
    rating: number;
    setRating: (rating: number) => void;
    text: string;
    setText: (text: string) => void;
    onSubmit: () => Promise<void>;
    isSubmitting: boolean;
    readOnly?: boolean; // kept for API compat, unused
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
    isOpen,
    onClose,
    booking,
    rating,
    setRating,
    text,
    setText,
    onSubmit,
    isSubmitting,
}) => {
    if (!isOpen || !booking) return null;

    const isEditing = !!booking.review;

    return (
        <div
            className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-6"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-[#1A1C23] border border-white/10 rounded-[28px] p-8 md:p-10 w-full max-w-[500px] animate-in fade-in zoom-in-95 duration-200 shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-2xl font-black font-display uppercase tracking-wider text-white">
                        {isEditing ? "Update Review" : "Leave a Review"}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-text-main/30 hover:text-white transition-colors bg-[#12141A] w-10 h-10 rounded-full flex items-center justify-center border border-white/5 hover:border-white/20"
                    >
                        ✕
                    </button>
                </div>

                <div className="mb-6">
                    <p className="text-[15px] font-medium text-text-main/70 mb-6 bg-[#12141A] p-4 rounded-xl border border-white/5 leading-relaxed">
                        {isEditing
                            ? <>Update your review for <span className="font-bold text-white">{booking.other_user?.first_name}</span></>
                            : <>How was your session with <span className="font-bold text-white">{booking.other_user?.first_name}</span>?</>
                        }
                    </p>

                    {/* Star Rating */}
                    <div className="flex gap-3 justify-center mb-8">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                onClick={() => setRating(star)}
                                className={`text-5xl transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer ${
                                    star <= rating
                                        ? "text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.4)]"
                                        : "text-white/5 hover:text-white/20"
                                }`}
                            >
                                ★
                            </button>
                        ))}
                    </div>

                    {/* Review Text */}
                    <div className="mb-8">
                        <label className="block text-xs font-bold text-text-main/50 uppercase tracking-widest mb-3">
                            Your Review{" "}
                            <span className="text-text-main/30 lowercase font-medium tracking-normal">(optional)</span>
                        </label>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Share your experience (what went well, what could be improved?)..."
                            className="w-full bg-[#12141A] border border-white/10 rounded-xl text-[15px] text-white p-5 min-h-[140px] outline-none transition-all resize-y custom-scrollbar placeholder:text-text-main/20 focus:border-primary/50 focus:bg-[#1A1C23]"
                        />
                    </div>

                    <button
                        onClick={onSubmit}
                        disabled={isSubmitting}
                        className={`w-full py-4 rounded-xl text-[13px] font-black uppercase tracking-widest transition-all shadow-lg ${
                            isSubmitting
                                ? "bg-white/5 text-text-main/40 cursor-not-allowed border border-white/5"
                                : "bg-primary text-bg hover:shadow-[0_0_20px_rgba(69,208,255,0.4)] hover:-translate-y-0.5"
                        }`}
                    >
                        {isSubmitting ? "Saving..." : isEditing ? "Update Review" : "Submit Review"}
                    </button>
                </div>
            </div>
        </div>
    );
};

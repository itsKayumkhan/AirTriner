"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ShieldCheck, CheckCircle, Clock } from "lucide-react";

export default function BookingPaymentSuccessPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const bookingId = searchParams.get("booking_id");
    const sessionId = searchParams.get("session_id");
    const verified = useRef(false);

    useEffect(() => {
        if (!sessionId || !bookingId || verified.current) return;
        verified.current = true;
        fetch("/api/stripe/verify-booking-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, bookingId }),
        }).catch((err) => console.error("Verify payment error:", err));
    }, [sessionId, bookingId]);

    return (
        <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center">

            {/* Icon */}
            <div className="w-24 h-24 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-8">
                <CheckCircle size={48} className="text-green-400" strokeWidth={1.5} />
            </div>

            {/* Heading */}
            <h1 className="text-[32px] font-black font-display italic tracking-wide text-white uppercase mb-1 leading-none drop-shadow-sm">
                Payment Successful
            </h1>
            <p className="text-text-main/50 text-base font-medium max-w-sm mb-12">
                Your booking is confirmed. You&apos;re all set for your upcoming session.
            </p>

            {/* Steps */}
            <div className="flex flex-col sm:flex-row items-center gap-6 mb-14 w-full max-w-xl">
                <div className="flex-1 flex flex-col items-center gap-2 text-center">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                        <ShieldCheck size={18} className="text-green-400" />
                    </div>
                    <p className="text-xs font-bold text-text-main/60 uppercase tracking-wider">Booking Confirmed</p>
                    <p className="text-[11px] text-text-main/40">Payment received</p>
                </div>
                <div className="hidden sm:block h-px flex-1 bg-white/10" />
                <div className="flex-1 flex flex-col items-center gap-2 text-center">
                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <CheckCircle size={18} className="text-primary" />
                    </div>
                    <p className="text-xs font-bold text-text-main/60 uppercase tracking-wider">Attend Session</p>
                    <p className="text-[11px] text-text-main/40">Show up & train</p>
                </div>
                <div className="hidden sm:block h-px flex-1 bg-white/10" />
                <div className="flex-1 flex flex-col items-center gap-2 text-center">
                    <div className="w-10 h-10 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                        <Clock size={18} className="text-yellow-400" />
                    </div>
                    <p className="text-xs font-bold text-text-main/60 uppercase tracking-wider">Leave a Review</p>
                    <p className="text-[11px] text-text-main/40">After your session</p>
                </div>
            </div>

            {/* CTA */}
            <button
                onClick={() => router.push("/dashboard/bookings")}
                className="flex items-center gap-2 px-8 py-3.5 rounded-full bg-primary text-bg font-black text-sm uppercase tracking-widest hover:shadow-[0_0_24px_rgba(69,208,255,0.35)] transition-all"
            >
                <ArrowLeft size={16} /> Back to Bookings
            </button>
        </div>
    );
}

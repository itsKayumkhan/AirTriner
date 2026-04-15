"use client";

import { useRouter } from "next/navigation";
import { XCircle, ArrowLeft, CreditCard } from "lucide-react";

export default function SubscriptionCancelPage() {
    const router = useRouter();

    return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
            <div className="max-w-md w-full bg-surface border border-white/5 rounded-[28px] p-10 flex flex-col items-center gap-6">
                {/* Icon */}
                <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                    <XCircle size={40} className="text-text-main/40" strokeWidth={1.5} />
                </div>

                <div>
                    <h1 className="text-[32px] font-black font-display italic tracking-wide text-white uppercase mb-1 leading-none drop-shadow-sm">
                        Checkout Cancelled
                    </h1>
                    <p className="text-text-main/50 text-sm leading-relaxed">
                        No payment was made. You can return to the subscription page whenever you&apos;re ready to subscribe.
                    </p>
                </div>

                <div className="w-full flex flex-col gap-3">
                    <button
                        onClick={() => router.push("/dashboard/subscription")}
                        className="w-full py-3.5 rounded-full bg-primary text-bg font-black text-sm uppercase tracking-widest hover:shadow-[0_0_20px_rgba(69,208,255,0.3)] transition-all flex items-center justify-center gap-2"
                    >
                        <CreditCard size={16} /> View Subscription Plans
                    </button>
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="w-full py-3.5 rounded-full bg-white/5 border border-white/10 text-text-main font-bold text-sm uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                        <ArrowLeft size={16} /> Back to Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
}

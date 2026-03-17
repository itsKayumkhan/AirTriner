"use client";

import React from "react";
import { Zap, XCircle } from "lucide-react";
import { NotificationRow } from "@/lib/supabase";

interface OfferNotificationData {
    offer_id?: string;
    offer_status?: string;
    trainer_name?: string;
    sport?: string;
    session_type?: string;
    rate?: number | string;
    time_slot?: string;
    scheduledAt?: string;
    [key: string]: unknown;
}

interface OfferModalProps {
    isOpen: boolean;
    onClose: () => void;
    notification: NotificationRow | null;
    onResponse: (notificationId: string, offerId: string, response: "accepted" | "declined") => Promise<void>;
    isResponding: boolean;
}

export function OfferModal({ isOpen, onClose, notification, onResponse, isResponding }: OfferModalProps) {
    if (!isOpen || !notification) return null;

    const data = notification.data as OfferNotificationData;
    const trainerInitial = data?.trainer_name?.split(' ').map((n: string) => n[0]).join('') || "T";

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 sm:p-6 overflow-y-auto" onClick={onClose}>
            <div
                className="bg-[#1A1C23] border border-white/10 rounded-[28px] w-full max-w-[500px] shadow-2xl relative my-auto animate-in fade-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 sm:p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <Zap size={20} />
                            </div>
                            <h2 className="text-xl font-black font-display text-white tracking-wide uppercase">Training Offer</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-text-main/50 hover:bg-white/10 hover:text-white transition-colors"
                        >
                            <XCircle size={20} />
                        </button>
                    </div>

                    {/* Trainer Profile Card */}
                    <div className="flex items-center gap-4 p-4 bg-[#12141A] border border-white/5 rounded-2xl mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-[#272A35] flex items-center justify-center text-primary font-black text-xl border border-white/5 shadow-inner">
                            {trainerInitial}
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-white">{data?.trainer_name || "Trainer"}</h3>
                            <p className="text-[12px] text-primary font-black uppercase tracking-[0.2em] mt-1">
                                {data?.sport?.replace(/_/g, ' ') || "Coach"}
                            </p>
                        </div>
                    </div>

                    {/* Offer Details */}
                    <div className="space-y-6 mb-10">
                        <div>
                            <label className="block text-[10px] font-black text-text-main/40 uppercase tracking-[0.2em] mb-3">Trainer's Message</label>
                            <div className="bg-[#12141A] border border-white/5 rounded-2xl p-5 text-sm text-text-main/80 italic leading-relaxed relative">
                                <span className="absolute -top-3 left-6 px-2 bg-[#1A1C23] text-[10px] text-text-main/30 font-bold uppercase tracking-widest italic font-serif">Message</span>
                                "{notification.body}"
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#12141A] border border-white/5 rounded-2xl p-4 text-center">
                                <label className="block text-[9px] font-black text-text-main/30 uppercase tracking-[0.2em] mb-2">Session Type</label>
                                <p className="text-sm font-bold text-white capitalize">
                                    {data?.session_type?.replace(/_/g, ' ') || "Private"}
                                </p>
                            </div>
                            <div className="bg-[#12141A] border border-white/5 rounded-2xl p-4 text-center">
                                <label className="block text-[9px] font-black text-text-main/30 uppercase tracking-[0.2em] mb-2">Hourly Rate</label>
                                <p className="text-sm font-bold text-primary">
                                    ${data?.rate || 50}/hr
                                </p>
                            </div>
                        </div>

                        {data?.time_slot && (
                            <div className="bg-[#12141A] border border-white/5 rounded-2xl p-4">
                                <label className="block text-[9px] font-black text-text-main/30 uppercase tracking-[0.2em] mb-2 text-center">Proposed Availability</label>
                                <div className="text-center">
                                    <p className="text-sm font-bold text-white mb-1">
                                        {data?.time_slot}
                                    </p>
                                    {data?.scheduledAt && (
                                        <p className="text-[11px] font-black text-primary uppercase tracking-widest">
                                            {new Date(data.scheduledAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => onResponse(notification.id, data.offer_id!, "accepted")}
                            disabled={isResponding}
                            className="w-full py-4 rounded-2xl bg-primary text-bg font-black text-[15px] uppercase tracking-wider hover:shadow-[0_0_25px_rgba(69,208,255,0.4)] transition-all flex items-center justify-center gap-2"
                        >
                            {isResponding ? <div className="w-5 h-5 border-2 border-bg/30 border-t-bg rounded-full animate-spin" /> : "Accept Training Offer"}
                        </button>
                        <button
                            onClick={() => onResponse(notification.id, data.offer_id!, "declined")}
                            disabled={isResponding}
                            className="w-full py-4 rounded-2xl border border-white/10 text-white/60 font-bold text-sm uppercase tracking-wider hover:bg-white/5 hover:text-white transition-all"
                        >
                            Decline Offer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

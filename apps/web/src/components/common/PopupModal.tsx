"use client";

import React from "react";
import { CheckCircle, X, Shield, AlertTriangle, Info } from "lucide-react";

interface PopupModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: "success" | "error" | "confirm" | "warning" | "info";
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
}

export default function PopupModal({
    isOpen,
    onClose,
    type,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    onConfirm
}: PopupModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1A1C23] border border-white/10 rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center">
                    {/* Icon based on type */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                        type === "success" ? "bg-primary/20 text-primary" :
                        type === "error" ? "bg-red-500/20 text-red-500" :
                        type === "confirm" ? "bg-blue-500/20 text-blue-500" :
                        type === "warning" ? "bg-orange-500/20 text-orange-500" :
                        "bg-white/10 text-white"
                    }`}>
                        {type === "success" && <CheckCircle size={28} strokeWidth={2.5} />}
                        {type === "error" && <X size={28} strokeWidth={2.5} />}
                        {type === "confirm" && <Shield size={28} strokeWidth={2.5} />}
                        {type === "warning" && <AlertTriangle size={28} strokeWidth={2.5} />}
                        {type === "info" && <Info size={28} strokeWidth={2.5} />}
                    </div>
                    
                    <h3 className={`text-xl font-black uppercase tracking-wider mb-2 ${
                        type === "success" ? "text-primary" : 
                        type === "error" ? "text-red-500" : 
                        type === "warning" ? "text-orange-500" :
                        "text-white"
                    }`}>
                        {title}
                    </h3>
                    
                    <p className="text-text-main/80 text-sm font-medium mb-6">
                        {message}
                    </p>
                    
                    <div className="flex gap-3 w-full">
                        {type === "confirm" || type === "warning" ? (
                            <>
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3 rounded-full bg-white/5 text-white font-bold text-sm uppercase tracking-wider hover:bg-white/10 transition-all border border-white/10"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={() => {
                                        onConfirm?.();
                                        onClose();
                                    }}
                                    className={`flex-1 py-3 rounded-full font-black text-sm uppercase tracking-wider transition-all ${
                                        type === "warning" 
                                        ? "bg-orange-500 text-white hover:bg-orange-600 shadow-[0_0_15px_rgba(249,115,22,0.3)]" 
                                        : "bg-primary text-bg hover:shadow-[0_0_15px_rgba(163,255,18,0.3)]"
                                    }`}
                                >
                                    {confirmText}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={onClose}
                                className={`w-full py-3 rounded-full font-black text-sm uppercase tracking-wider transition-all ${
                                    type === "success" 
                                    ? "bg-primary text-bg hover:shadow-[0_0_15px_rgba(163,255,18,0.3)]" 
                                    : type === "error"
                                    ? "bg-red-500 text-white hover:bg-red-600"
                                    : "bg-white/10 text-white hover:bg-white/20"
                                }`}
                            >
                                OK
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

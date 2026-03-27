"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
}

interface ToastProps {
    toasts: ToastMessage[];
    onRemove: (id: string) => void;
}

const ICONS = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
};

const STYLES = {
    success: { border: "border-green-500/30", bg: "bg-green-500/10", icon: "text-green-400", title: "text-green-300" },
    error:   { border: "border-red-500/30",   bg: "bg-red-500/10",   icon: "text-red-400",   title: "text-red-300" },
    warning: { border: "border-yellow-500/30", bg: "bg-yellow-500/10", icon: "text-yellow-400", title: "text-yellow-300" },
    info:    { border: "border-primary/30",   bg: "bg-primary/10",   icon: "text-primary",   title: "text-primary" },
};

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
    const [visible, setVisible] = useState(false);
    const s = STYLES[toast.type];
    const Icon = ICONS[toast.type];

    useEffect(() => {
        // Animate in
        const showTimer = setTimeout(() => setVisible(true), 10);
        // Auto remove after 4s
        const hideTimer = setTimeout(() => {
            setVisible(false);
            setTimeout(() => onRemove(toast.id), 300);
        }, 4000);
        return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
    }, [toast.id, onRemove]);

    return (
        <div
            className={`flex items-start gap-3 w-full max-w-sm px-4 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-sm transition-all duration-300 ${s.border} ${s.bg}
                ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
            <Icon size={18} className={`${s.icon} shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${s.title}`}>{toast.title}</p>
                {toast.message && <p className="text-xs text-text-main/60 mt-0.5 leading-relaxed">{toast.message}</p>}
            </div>
            <button
                onClick={() => { setVisible(false); setTimeout(() => onRemove(toast.id), 300); }}
                className="text-text-main/30 hover:text-text-main/70 transition-colors shrink-0"
            >
                <X size={14} />
            </button>
        </div>
    );
}

export function ToastContainer({ toasts, onRemove }: ToastProps) {
    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end pointer-events-none">
            {toasts.map((t) => (
                <div key={t.id} className="pointer-events-auto">
                    <ToastItem toast={t} onRemove={onRemove} />
                </div>
            ))}
        </div>
    );
}

// Hook
let _toastId = 0;
export function useToast() {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const toast = (type: ToastType, title: string, message?: string) => {
        const id = String(++_toastId);
        setToasts((prev) => [...prev, { id, type, title, message }]);
    };

    const remove = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

    return {
        toasts,
        remove,
        success: (title: string, message?: string) => toast("success", title, message),
        error:   (title: string, message?: string) => toast("error",   title, message),
        warning: (title: string, message?: string) => toast("warning", title, message),
        info:    (title: string, message?: string) => toast("info",    title, message),
    };
}

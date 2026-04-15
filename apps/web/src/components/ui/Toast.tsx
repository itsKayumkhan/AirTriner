"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
}

// --- Global store ---
let _id = 0;
let _toasts: ToastMessage[] = [];
const _listeners = new Set<() => void>();

function notify() { _listeners.forEach((l) => l()); }

function addToast(type: ToastType, title: string, message?: string) {
    const id = String(++_id);
    _toasts = [..._toasts, { id, type, title, message }];
    notify();
}

function removeToast(id: string) {
    _toasts = _toasts.filter((t) => t.id !== id);
    notify();
}

/** Call from anywhere — no hooks, no context needed */
export const toast = {
    success: (title: string, message?: string) => addToast("success", title, message),
    error:   (title: string, message?: string) => addToast("error",   title, message),
    warning: (title: string, message?: string) => addToast("warning", title, message),
    info:    (title: string, message?: string) => addToast("info",    title, message),
};

// --- Keep the hook for backwards compat ---
export function useToast() {
    const toasts = useSyncExternalStore(
        (cb) => { _listeners.add(cb); return () => _listeners.delete(cb); },
        () => _toasts,
        () => _toasts,
    );
    return { toasts, remove: removeToast, ...toast };
}

// --- UI ---
const ICONS = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info };

const STYLES = {
    success: { border: "border-green-500/30", bg: "bg-green-500/10", icon: "text-green-400", title: "text-green-300" },
    error:   { border: "border-red-500/30",   bg: "bg-red-500/10",   icon: "text-red-400",   title: "text-red-300" },
    warning: { border: "border-yellow-500/30", bg: "bg-yellow-500/10", icon: "text-yellow-400", title: "text-yellow-300" },
    info:    { border: "border-primary/30",   bg: "bg-primary/10",   icon: "text-primary",   title: "text-primary" },
};

function ToastItem({ toast: t, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
    const [visible, setVisible] = useState(false);
    const s = STYLES[t.type];
    const Icon = ICONS[t.type];

    useEffect(() => {
        const showTimer = setTimeout(() => setVisible(true), 10);
        const hideTimer = setTimeout(() => {
            setVisible(false);
            setTimeout(() => onRemove(t.id), 300);
        }, 4000);
        return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
    }, [t.id, onRemove]);

    return (
        <div
            className={`flex items-start gap-3 w-full max-w-sm px-4 py-3.5 rounded-2xl border shadow-2xl backdrop-blur-sm transition-all duration-300 ${s.border} ${s.bg}
                ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
            <Icon size={18} className={`${s.icon} shrink-0 mt-0.5`} />
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${s.title}`}>{t.title}</p>
                {t.message && <p className="text-xs text-text-main/60 mt-0.5 leading-relaxed">{t.message}</p>}
            </div>
            <button
                onClick={() => { setVisible(false); setTimeout(() => onRemove(t.id), 300); }}
                className="text-text-main/30 hover:text-text-main/70 transition-colors shrink-0"
            >
                <X size={14} />
            </button>
        </div>
    );
}

/** Render once in your root layout */
export function GlobalToast() {
    const { toasts, remove } = useToast();
    if (!toasts.length) return null;
    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end pointer-events-none">
            {toasts.map((t) => (
                <div key={t.id} className="pointer-events-auto">
                    <ToastItem toast={t} onRemove={remove} />
                </div>
            ))}
        </div>
    );
}

// Keep old name for existing imports
export const ToastContainer = GlobalToast;

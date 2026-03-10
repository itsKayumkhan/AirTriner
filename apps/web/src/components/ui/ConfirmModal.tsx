import { ReactNode } from "react";
import { AlertTriangle, X, CheckCircle, Info } from "lucide-react";

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: ReactNode;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    type?: "danger" | "warning" | "info" | "success";
    isLoading?: boolean;
}

export function ConfirmModal({ 
    isOpen, 
    title, 
    message, 
    confirmText = "Confirm", 
    cancelText = "Cancel", 
    onConfirm, 
    onCancel, 
    type = "warning",
    isLoading = false
}: ConfirmModalProps) {
    if (!isOpen) return null;

    const iconMap = {
        danger: <AlertTriangle size={24} className="text-red-500" />,
        warning: <AlertTriangle size={24} className="text-orange-500" />,
        info: <Info size={24} className="text-blue-500" />,
        success: <CheckCircle size={24} className="text-green-500" />
    };

    const bgMap = {
        danger: "bg-red-500",
        warning: "bg-orange-500",
        info: "bg-blue-500",
        success: "bg-green-500"
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#12141A] border border-white/10 rounded-[24px] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 relative">
                
                {/* Close Button */}
                <button 
                    onClick={onCancel}
                    disabled={isLoading}
                    className="absolute top-4 right-4 text-text-main/40 hover:text-white transition-colors disabled:opacity-50"
                >
                    <X size={20} />
                </button>

                <div className="p-6 pt-8 flex flex-col items-center text-center">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 border bg-opacity-10 
                        ${type === 'danger' ? 'bg-red-500 border-red-500/20' : 
                          type === 'warning' ? 'bg-orange-500 border-orange-500/20' : 
                          type === 'success' ? 'bg-green-500 border-green-500/20' : 
                          'bg-blue-500 border-blue-500/20'}
                    `}>
                        {iconMap[type]}
                    </div>
                    
                    <h2 className="text-2xl font-black text-white tracking-tight mb-2">{title}</h2>
                    <div className="text-text-main/60 text-sm font-medium mb-8 leading-relaxed">
                        {message}
                    </div>

                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={onCancel}
                            disabled={isLoading}
                            className="flex-1 py-3 px-4 rounded-xl bg-surface border border-white/5 text-text-main/80 text-sm font-bold transition-all hover:bg-white/5 hover:text-white disabled:opacity-50"
                        >
                            {cancelText}
                        </button>
                        <button 
                            onClick={onConfirm}
                            disabled={isLoading}
                            className={`flex-1 py-3 px-4 rounded-xl text-bg font-black text-sm uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg
                                ${bgMap[type]} hover:opacity-90 hover:scale-[1.02]
                            `}
                        >
                            {isLoading ? "Processing..." : confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

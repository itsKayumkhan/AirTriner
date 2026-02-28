import React from "react";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: React.ReactNode;
    active?: boolean;
}

export function IconButton({ icon, active, className = "", ...props }: IconButtonProps) {
    return (
        <button
            className={`
        flex items-center justify-center
        h-10 w-10
        rounded-xl
        transition-all duration-200
        ${active
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "bg-surface-elevated/50 text-text-main/60 border border-white/5 hover:bg-surface-elevated hover:text-text-main"
                }
        ${className}
      `}
            {...props}
        >
            {icon}
        </button>
    );
}

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    icon?: React.ReactNode;
}

export function PrimaryButton({ children, icon, className = "", ...props }: PrimaryButtonProps) {
    return (
        <button
            className={`
        flex items-center justify-center gap-2
        bg-primary text-bg
        px-4 py-2
        rounded-xl
        font-bold text-sm
        transition-all duration-200
        hover:scale-[1.02] hover:shadow-[0_0_10px_rgba(163,255,18,0.2)]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none
        ${className}
      `}
            {...props}
        >
            {icon && <span className="flex-shrink-0">{icon}</span>}
            {children}
        </button>
    );
}

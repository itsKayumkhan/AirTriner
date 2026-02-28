export function Badge({ children, variant = "neutral", className = "" }: { children: React.ReactNode, variant?: "success" | "warning" | "error" | "neutral" | "primary", className?: string }) {
    const variants = {
        success: "bg-success/10 text-success border border-success/20",
        warning: "bg-warning/10 text-warning border border-warning/20",
        error: "bg-error/10 text-error border border-error/20",
        neutral: "bg-gray-800 text-text-main/80 border border-gray-700",
        primary: "bg-primary/20 text-primary border border-primary/30"
    };

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${variants[variant]} ${className}`}>
            {children}
        </span>
    );
}

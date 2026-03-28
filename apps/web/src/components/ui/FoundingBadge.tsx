export function FoundingBadge({ size = 28 }: { size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 56 56"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            title="Founding 50 Coach"
        >
            <defs>
                <linearGradient id="f50-gold" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FFD700" />
                    <stop offset="50%" stopColor="#FFA500" />
                    <stop offset="100%" stopColor="#FF8C00" />
                </linearGradient>
                <linearGradient id="f50-inner" x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#1a1200" />
                    <stop offset="100%" stopColor="#2a1d00" />
                </linearGradient>
                <filter id="f50-glow">
                    <feGaussianBlur stdDeviation="1.5" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Outer shield shape */}
            <path
                d="M28 3L6 12v14c0 12.4 9.3 24 22 27 12.7-3 22-14.6 22-27V12L28 3z"
                fill="url(#f50-gold)"
                filter="url(#f50-glow)"
            />
            {/* Inner shield */}
            <path
                d="M28 7.5L10 15.5v11.2C10 37 18.2 46.8 28 49.5c9.8-2.7 18-12.5 18-22.8V15.5L28 7.5z"
                fill="url(#f50-inner)"
            />
            {/* Gold border inner */}
            <path
                d="M28 7.5L10 15.5v11.2C10 37 18.2 46.8 28 49.5c9.8-2.7 18-12.5 18-22.8V15.5L28 7.5z"
                fill="none"
                stroke="#FFD700"
                strokeWidth="0.8"
                strokeOpacity="0.5"
            />

            {/* Star at top */}
            <path
                d="M28 13l1.2 3.7h3.9l-3.1 2.3 1.2 3.7L28 20.4l-3.2 2.3 1.2-3.7-3.1-2.3h3.9z"
                fill="#FFD700"
            />

            {/* "50" text */}
            <text
                x="28"
                y="37"
                textAnchor="middle"
                fontSize="11"
                fontWeight="900"
                fontFamily="Arial, sans-serif"
                fill="#FFD700"
                letterSpacing="-0.5"
            >
                50
            </text>

            {/* Bottom arc text placeholder line */}
            <path
                d="M16 41 Q28 46 40 41"
                fill="none"
                stroke="#FFD700"
                strokeWidth="0.8"
                strokeOpacity="0.6"
            />
        </svg>
    );
}

export function FoundingBadgeTooltip({ size = 28 }: { size?: number }) {
    return (
        <div className="relative group/badge inline-flex">
            <FoundingBadge size={size} />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-[#1a1200] border border-yellow-500/40 rounded-lg text-[10px] font-black uppercase tracking-widest text-yellow-400 whitespace-nowrap opacity-0 group-hover/badge:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                Founding 50 Coach
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-yellow-500/40" />
            </div>
        </div>
    );
}

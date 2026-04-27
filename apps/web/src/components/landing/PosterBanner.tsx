"use client";

interface PosterBannerProps {
    image: string;
    eyebrow?: string;
    headline: string;
    accentWord?: string;
    subheadline?: string;
    cta?: { label: string; href: string };
    height?: string;
    /**
     * Visual variant changes overlay tint, alignment, and accent treatment so multiple
     * banners on one page don't look identical.
     * - "dark-center"  → centered text on dark gradient (default)
     * - "split-left"   → text aligned left, gradient goes left→right
     * - "split-right"  → text aligned right, gradient goes right→left
     */
    variant?: "dark-center" | "split-left" | "split-right";
}

export default function PosterBanner({
    image,
    eyebrow,
    headline,
    accentWord,
    subheadline,
    cta,
    height,
    variant = "dark-center",
}: PosterBannerProps) {
    const overlay =
        variant === "split-left"
            ? "linear-gradient(to right, rgba(10,13,20,0.92) 0%, rgba(10,13,20,0.7) 50%, rgba(10,13,20,0.3) 100%)"
            : variant === "split-right"
              ? "linear-gradient(to left, rgba(10,13,20,0.92) 0%, rgba(10,13,20,0.7) 50%, rgba(10,13,20,0.3) 100%)"
              : "linear-gradient(to bottom, rgba(10,13,20,0.65), rgba(10,13,20,0.85))";

    const textAlign: React.CSSProperties["textAlign"] =
        variant === "split-left" ? "left" : variant === "split-right" ? "right" : "center";

    const justify: React.CSSProperties["justifyContent"] =
        variant === "split-left" ? "flex-start" : variant === "split-right" ? "flex-end" : "center";
    const renderHeadline = () => {
        if (!accentWord) return headline;
        const parts = headline.split(accentWord);
        return (
            <>
                {parts[0]}
                <span
                    style={{
                        color: "var(--primary)",
                        fontStyle: "italic",
                        textShadow:
                            "0 0 40px rgba(69,208,255,0.6), 0 0 80px rgba(69,208,255,0.25)",
                    }}
                >
                    {accentWord}
                </span>
                {parts[1] ?? ""}
            </>
        );
    };

    return (
        <section
            className="poster-banner"
            style={{
                position: "relative",
                width: "100%",
                minHeight: height ?? "400px",
                display: "flex",
                alignItems: "center",
                justifyContent: justify,
                overflow: "hidden",
                borderTop: "1px solid var(--gray-900)",
                borderBottom: "1px solid var(--gray-900)",
            }}
        >
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: `${overlay}, url('${image}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    zIndex: 0,
                }}
            />

            <div
                style={{
                    position: "relative",
                    zIndex: 1,
                    maxWidth: variant === "dark-center" ? "1000px" : "640px",
                    padding: "64px 48px",
                    textAlign,
                    width: "100%",
                }}
            >
                {eyebrow && (
                    <div
                        style={{
                            display: "inline-block",
                            background: "rgba(69,208,255,0.12)",
                            border: "1px solid rgba(69,208,255,0.3)",
                            borderRadius: "var(--radius-full)",
                            padding: "6px 16px",
                            marginBottom: "20px",
                            fontSize: "12px",
                            fontWeight: 800,
                            color: "var(--primary)",
                            letterSpacing: "1.5px",
                            textTransform: "uppercase",
                        }}
                    >
                        {eyebrow}
                    </div>
                )}

                <h2
                    style={{
                        fontSize: "clamp(28px, 6vw, 56px)",
                        fontWeight: 900,
                        fontFamily: "var(--font-display)",
                        textTransform: "uppercase",
                        lineHeight: 1.05,
                        letterSpacing: "-1px",
                        margin: 0,
                        color: "white",
                    }}
                >
                    {renderHeadline()}
                </h2>

                {subheadline && (
                    <p
                        style={{
                            color: "var(--gray-300)",
                            fontSize: "clamp(14px, 1.6vw, 17px)",
                            marginTop: "20px",
                            maxWidth: "640px",
                            marginLeft: "auto",
                            marginRight: "auto",
                            lineHeight: 1.6,
                        }}
                    >
                        {subheadline}
                    </p>
                )}

                {cta && (
                    <a
                        href={cta.href}
                        style={{
                            display: "inline-block",
                            marginTop: "28px",
                            padding: "14px 32px",
                            background: "var(--primary)",
                            color: "#0A0D14",
                            borderRadius: "var(--radius-full)",
                            fontWeight: 800,
                            fontSize: "13px",
                            textDecoration: "none",
                            textTransform: "uppercase",
                            letterSpacing: "1.5px",
                            boxShadow:
                                "0 0 24px rgba(69,208,255,0.45), 0 0 48px rgba(69,208,255,0.18)",
                        }}
                    >
                        {cta.label}
                    </a>
                )}
            </div>

            <style>{`
                @media (max-width: 640px) {
                    .poster-banner { min-height: 280px !important; }
                }
            `}</style>
        </section>
    );
}

import type { Metadata } from "next";
import "./app.css";

export const metadata: Metadata = {
  title: "AirTrainr | Find Your Perfect Sports Trainer",
  description:
    "Connect with verified sports trainers near you across the USA & Canada. Book personalized training sessions in hockey, baseball, basketball, and 15+ sports. Start your journey today.",
  keywords: [
    "sports training",
    "personal trainer",
    "athletic coaching",
    "hockey trainer",
    "baseball coach",
    "basketball training",
    "USA trainers",
    "Canada trainers",
    "book training session",
    "sports marketplace",
  ],
  openGraph: {
    title: "AirTrainr | Find Your Perfect Sports Trainer",
    description:
      "Connect with verified sports trainers near you. Book personalized sessions in 15+ sports.",
    type: "website",
    url: "https://airtrainr.com",
    siteName: "AirTrainr",
  },
  twitter: {
    card: "summary_large_image",
    title: "AirTrainr | Find Your Perfect Sports Trainer",
    description:
      "Connect with verified sports trainers near you. Book personalized sessions in 15+ sports.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

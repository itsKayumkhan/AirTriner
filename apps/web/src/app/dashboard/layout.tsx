"use client";

import { useEffect, useState } from "react";
import { getSession, clearSession, verifySessionStatus, AuthUser } from "@/lib/auth";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

import {
    LayoutDashboard,
    Search,
    Calendar,
    Users,
    MessageSquare,
    Bell,
    LogOut,
    CreditCard,
    Star,
    Clock,
    User,
    ShieldAlert,
    Menu,
    X,
    HelpCircle,
    Send,
    Crown,
    AlertTriangle,
    Mail,
    Building2,
} from "lucide-react";
import { IconButton } from "@/components/ui/Buttons";
import { AuthContext } from "@/context/AuthContext";
import { TrainerProvider } from "@/context/TrainerContext";
import { AthleteProvider } from "@/context/AthleteContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { MessagesProvider } from "@/context/MessagesContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [suspendedError, setSuspendedError] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const checkAuth = async () => {
            const session = getSession();
            if (!session) {
                router.push("/auth/login?returnTo=" + encodeURIComponent(pathname));
                return;
            }

            const isValid = await verifySessionStatus(session.id);
            if (!isValid) {
                await clearSession();
                setSuspendedError(true);
                return;
            }

            if (session.role === "admin") {
                router.push("/admin");
                return;
            }

            setUser(session);
            setLoading(false);
        };

        checkAuth();
    }, [router, pathname]);

    const handleLogout = async () => {
        await clearSession();
        router.push("/auth/login");
    };

    if (suspendedError) {
        return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                <div className="bg-zinc-900 border border-red-800 rounded-xl p-8 max-w-sm mx-4 text-center">
                    <div className="text-red-400 text-4xl mb-4">&#9888;</div>
                    <h2 className="text-white text-xl font-bold mb-2">Account Suspended</h2>
                    <p className="text-zinc-400 text-sm mb-6">Your account has been suspended. Please contact support.</p>
                    <button onClick={() => router.push('/auth/login')} className="bg-white text-black font-bold px-6 py-2 rounded-lg">
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-bg">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user) return null;

    const navItems = [
        ...(user.role === "trainer" ? [
            { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
            { label: "Training Offers", href: "/dashboard/trainer/offers", icon: Send },
            { label: "Availability", href: "/dashboard/availability", icon: Clock },
            { label: "Bookings", href: "/dashboard/bookings", icon: Calendar },
            { label: "Earnings", href: "/dashboard/earnings", icon: CreditCard },
            { label: "Payment Settings", href: "/dashboard/payments", icon: Building2 },
            { label: "Reviews", href: "/dashboard/reviews", icon: Star },
            { label: "My Profile", href: "/dashboard/trainer/setup", icon: User },
            {
                label: "Subscription",
                href: "/dashboard/subscription",
                icon: Crown,
                badge: (user.trainerProfile?.subscription_status === "trial" || user.trainerProfile?.subscription_status === "expired")
                    ? (user.trainerProfile?.subscription_status === "expired" ? "!" : "Trial")
                    : undefined,
            },
        ] : []),
        ...(user.role === "athlete" ? [
            { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
            { label: "Find Trainers", href: "/dashboard/search", icon: Search },
            { label: "My Bookings", href: "/dashboard/bookings", icon: Calendar },
            { label: "Payments", href: "/dashboard/earnings", icon: CreditCard },
            { label: "Family Accounts", href: "/dashboard/sub-accounts", icon: Users },
            { label: "My Profile", href: "/dashboard/profile", icon: User },
        ] : []),
        ...(user.role === "admin" ? [
            { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
            { label: "Admin Panel", href: "/dashboard/admin", icon: ShieldAlert },
            { label: "My Profile", href: "/dashboard/profile", icon: User },
        ] : []),
        { divider: true, id: "div1" },
        { label: "Messages", href: "/dashboard/messages", icon: MessageSquare, useMsgContext: true },
        { label: "Notifications", href: "/dashboard/notifications", icon: Bell, useNotifContext: true },
        { divider: true, id: "div2" },
        { label: "Contact Us", href: "/dashboard/contact", icon: Mail },
    ];

    return (
        <AuthContext.Provider value={{ user, setUser }}>
            <NotificationProvider>
                <MessagesProvider>
                    <TrainerProvider>
                        <AthleteProvider>
                            <DashboardLayoutContent
                                user={user}
                                mobileMenuOpen={mobileMenuOpen}
                                setMobileMenuOpen={setMobileMenuOpen}
                                navItems={navItems}
                                handleLogout={handleLogout}
                            >
                                {children}
                            </DashboardLayoutContent>
                        </AthleteProvider>
                    </TrainerProvider>
                </MessagesProvider>
            </NotificationProvider>
        </AuthContext.Provider>
    );
}

import { useNotifications } from "@/context/NotificationContext";
import { useMessages } from "@/context/MessagesContext";
import { supabase } from "@/lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DashboardLayoutContent({ user, mobileMenuOpen, setMobileMenuOpen, navItems, handleLogout, children }: any) {
    const router = useRouter();
    const pathname = usePathname();
    const { unreadCount: notifCount } = useNotifications();
    const { unreadCount: msgCount } = useMessages();
    const [hydrated, setHydrated] = useState(false);
    const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);

    useEffect(() => { setHydrated(true); }, []);

    useEffect(() => {
        if (user?.role !== "trainer") return;
        supabase
            .from("trainer_profiles")
            .select("subscription_status")
            .eq("user_id", user.id)
            .single()
            .then(({ data }) => {
                setSubscriptionStatus(data?.subscription_status ?? null);
            });
    }, [user]);

    const showExpiryBanner =
        user?.role === "trainer" &&
        subscriptionStatus !== null &&
        subscriptionStatus !== "active" &&
        subscriptionStatus !== "trial";

    if (!hydrated) return null;

    return (
        <div
            className="h-[100dvh] overflow-hidden bg-bg font-sans flex text-text-main selection:bg-primary/30"
            style={{ ["--banner-h" as any]: showExpiryBanner ? "52px" : "0px" }}
        >
            {/* Mobile Overlay */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed top-0 h-screen inset-y-0 left-0 w-[260px] bg-surface border-r border-white/5 flex-col z-50 transform transition-transform duration-300 ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 flex`}>
                {/* Logo Area */}
                <div className="h-20 flex items-center justify-between px-6 border-b border-white/5 shrink-0">
                    <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                        <div className="w-8 h-8 rounded overflow-hidden flex items-center justify-center bg-zinc-900 border border-white/10">
                            <img src="/logo.jpeg" alt="Logo" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-lg font-black tracking-tight text-text-main leading-none">
                            AirTrainr <span className="text-text-main/40 font-normal text-sm capitalize">{user.role}</span>
                        </span>
                    </Link>
                    <button className="md:hidden text-text-main/60 hover:text-white" onClick={() => setMobileMenuOpen(false)}>
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1 sidebar-scroll">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {navItems.map((item: any) => {
                        if (item.divider) {
                            return <div key={item.id} className="h-px bg-white/5 my-3 mx-1" />;
                        }
                        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                        const badgeValue = item.useMsgContext && msgCount > 0
                            ? msgCount
                            : item.useNotifContext && notifCount > 0
                            ? notifCount
                            : item.badge;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setMobileMenuOpen(false)}
                                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-sm font-semibold ${
                                    isActive
                                        ? "bg-white/[0.06] text-text-main border-l-2 border-primary/70"
                                        : "text-text-main/50 hover:text-text-main hover:bg-white/[0.04] border-l-2 border-transparent"
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <item.icon size={20} className={isActive ? "text-primary/80" : "text-text-main/40 group-hover:text-text-main/80"} strokeWidth={isActive ? 2.5 : 2} />
                                    <span>{item.label}</span>
                                </div>
                                {badgeValue && (
                                    <span className="bg-primary text-bg text-[11px] font-black px-2 py-0.5 rounded-full min-w-[20px] text-center">
                                        {badgeValue}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom — Logout */}
                <div className="px-3 py-4 border-t border-white/5 shrink-0">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-semibold w-full text-text-main/50 hover:text-red-400 hover:bg-red-500/5 border-l-2 border-transparent"
                    >
                        <LogOut size={18} className="text-text-main/40" />
                        Log Out
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-[100dvh] overflow-hidden bg-bg md:ml-[260px]">

                {/* Top Desktop Header */}
                <header className="hidden md:flex h-[72px] border-b border-white/5 items-center justify-between px-8 bg-bg/80 backdrop-blur z-40 sticky top-0">
                    <div className="w-[360px]" />
                    <div className="flex items-center gap-4">
                        <IconButton icon={<User size={18} />} onClick={() => router.push(user.role === 'trainer' ? '/dashboard/trainer/setup' : '/dashboard/profile')} />
                        <div className="relative group ml-4 cursor-pointer">
                            <div className="w-10 h-10 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center font-bold text-sm hover:border-primary transition-colors overflow-hidden">
                                {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                            </div>
                            <div className="absolute right-0 top-full mt-2 w-48 bg-surface border border-white/5 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                                <div className="px-4 py-3 border-b border-white/5">
                                    <p className="font-bold text-sm truncate">{user.firstName} {user.lastName}</p>
                                    <p className="text-xs text-text-main/60">{user.email}</p>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-error hover:bg-error/10 transition-colors text-left"
                                >
                                    <LogOut size={16} /> Log Out
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Mobile Header */}
                <header className="md:hidden h-[64px] bg-surface border-b border-white/5 flex items-center justify-between px-4 z-30 sticky top-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setMobileMenuOpen(true)} className="text-text-main hover:text-white transition-colors">
                            <Menu size={24} />
                        </button>
                        <Link href="/dashboard" className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded overflow-hidden flex items-center justify-center bg-zinc-900 border border-white/10">
                                <img src="/logo.jpeg" alt="Logo" className="w-full h-full object-cover" />
                            </div>
                        </Link>
                    </div>
                    <Link
                        href={user.role === 'trainer' ? '/dashboard/trainer/setup' : '/dashboard/profile'}
                        className="w-9 h-9 rounded-full bg-gray-800 border-2 border-transparent focus:border-primary flex items-center justify-center font-bold text-sm text-text-main"
                    >
                        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                    </Link>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto w-full relative custom-scrollbar">
                    {showExpiryBanner && (
                        <div className="sticky top-0 z-30 w-full bg-amber-500/10 border-b border-amber-500/25 px-4 sm:px-8 py-3 flex items-center gap-3">
                            <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                            <p className="text-amber-300 text-sm font-semibold flex-1">
                                Your subscription has {subscriptionStatus === "cancelled" ? "been cancelled" : "expired"}.
                                {" "}Renew to keep full access to all trainer features.
                            </p>
                            <button
                                onClick={() => router.push("/dashboard/subscription")}
                                className="text-amber-300 text-xs font-black border border-amber-500/40 rounded-lg px-3 py-1.5 hover:bg-amber-500/15 transition-colors shrink-0"
                            >
                                Renew
                            </button>
                        </div>
                    )}
                    <div className="w-full max-w-[1200px] mx-auto p-4 sm:p-6 lg:p-8">
                        <div className="overflow-x-auto">
                            {children}
                        </div>
                    </div>
                </main>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,0.08); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(255,255,255,0.15); }
                .sidebar-scroll::-webkit-scrollbar { width: 0px; }
                .sidebar-scroll { scrollbar-width: none; }
            `}</style>
        </div>
    );
}

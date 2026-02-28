"use client";

import { useEffect, useState } from "react";
import { getSession, clearSession, AuthUser } from "@/lib/auth";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
    LayoutDashboard,
    Search,
    Calendar,
    Users,
    MessageSquare,
    Bell,
    Settings,
    LogOut,
    CreditCard,
    Star,
    Clock,
    ShieldAlert,
    Send,
    ClipboardList,
    HelpCircle,
    Plus
} from "lucide-react";
import { IconButton, PrimaryButton } from "@/components/ui/Buttons";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const checkAuth = async () => {
            const session = await getSession();
            if (!session) {
                router.push("/auth/login");
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
    }, [router]);

    const handleLogout = async () => {
        await clearSession();
        router.push("/auth/login");
    };

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
            { label: "Profile Setup", href: "/dashboard/trainer/setup", icon: ClipboardList },
            { label: "Training Offers", href: "/dashboard/trainer/offers", icon: Send },
            { label: "Availability", href: "/dashboard/availability", icon: Clock },
            { label: "Bookings", href: "/dashboard/bookings", icon: Calendar },
            { label: "Payments", href: "/dashboard/earnings", icon: CreditCard },
            { label: "Reviews", href: "/dashboard/reviews", icon: Star },
        ] : []),
        ...(user.role === "athlete" ? [
            { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
            { label: "Find Trainers", href: "/dashboard/search", icon: Search },
            { label: "My Bookings", href: "/dashboard/bookings", icon: Calendar },
            { label: "Payments", href: "/dashboard/earnings", icon: CreditCard },
            { label: "Family Accounts", href: "/dashboard/sub-accounts", icon: Users },
        ] : []),
        ...(user.role === "admin" ? [
            { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
            { label: "Admin Panel", href: "/dashboard/admin", icon: ShieldAlert },
        ] : []),
        { divider: true, id: "div1" },
        { label: "Messages", href: "/dashboard/messages", icon: MessageSquare },
        { label: "Notifications", href: "/dashboard/notifications", icon: Bell, badge: 12 },
    ];

    const mobileNavItems = [
        { label: "Home", href: "/dashboard", icon: LayoutDashboard },
        { label: "Bookings", href: "/dashboard/bookings", icon: Calendar },
        { label: user.role === "athlete" ? "Search" : "Earnings", href: user.role === "athlete" ? "/dashboard/search" : "/dashboard/earnings", icon: user.role === "athlete" ? Search : CreditCard },
        { label: "Messages", href: "/dashboard/messages", icon: MessageSquare },
        { label: "More", href: "/dashboard/profile", icon: Settings },
    ];

    return (
        <div className="h-[100dvh] overflow-hidden bg-bg font-sans flex text-text-main font-sans selection:bg-primary/30">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex fixed top-0 h-screen inset-y-0 left-0 w-[260px] bg-surface border-r border-white/5 flex-col z-50">
                {/* Logo Area */}
                <div className="h-[72px] flex items-center px-6 border-b border-white/5">
                    <Link href="/dashboard" className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-bg shadow-[0_0_10px_rgba(163,255,18,0.2)]">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2 12l10-10 10 10-10 10z" /></svg>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg font-black font-display uppercase tracking-wider leading-none">AirTrainr</span>
                            <span className="text-[10px] text-text-main/40 font-medium uppercase tracking-widest mt-0.5">
                                {user.role} Workspace
                            </span>
                        </div>
                    </Link>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5 scrollbar-thin">
                    {navItems.map((item: any) => {
                        if (item.divider) {
                            return <div key={item.id} className="h-px bg-gray-800 my-4 mx-2" />;
                        }
                        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`
                                    group flex items-center justify-between px-3 py-2.5 rounded-xl
                                    transition-all duration-200
                                    ${isActive
                                        ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(163,255,18,0.1)]"
                                        : "text-text-main/60 hover:bg-white/5 hover:text-text-main border border-transparent"
                                    }
                                `}
                            >
                                <div className="flex items-center gap-3">
                                    <item.icon size={20} className={isActive ? "text-primary" : "text-text-main/40 group-hover:text-text-main/80"} strokeWidth={isActive ? 2.5 : 2} />
                                    <span className={`text-[15px] ${isActive ? "font-bold" : "font-semibold"}`}>{item.label}</span>
                                </div>
                                {item.badge && (
                                    <span className="bg-primary text-bg text-[11px] font-black px-2 py-0.5 rounded-full">
                                        {item.badge}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Bottom Action (e.g. New Session / Training) */}
                <div className="p-4 border-t border-white/5">
                    {user.role === 'trainer' && (
                        <PrimaryButton className="w-full mb-4">
                            <Plus size={18} strokeWidth={3} />
                            NEW TRAINING
                        </PrimaryButton>
                    )}
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-[100dvh] overflow-hidden bg-bg lg:ml-[260px]">

                {/* Top Desktop Headbar */}
                <header className="hidden lg:flex h-[72px] border-b border-white/5 items-center justify-between px-8 bg-bg/80 backdrop-blur z-40 sticky top-0">
                    <div className="w-[360px]">
                    </div>

                    <div className="flex items-center gap-4">
                        <IconButton icon={<Settings size={18} />} onClick={() => router.push('/dashboard/profile')} />
                        <IconButton icon={<HelpCircle size={18} />} />

                        <div className="relative group ml-4 cursor-pointer">
                            <div className="w-10 h-10 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center font-bold text-sm hover:border-primary transition-colors overflow-hidden">
                                {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                            </div>
                            {/* Simple Dropdown on hover */}
                            <div className="absolute right-0 top-full mt-2 w-48 bg-surface border border-white/5 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                                <div className="px-4 py-3 border-b border-white/5">
                                    <p className="font-bold text-sm truncate">{user.firstName} {user.lastName}</p>
                                    <p className="text-xs text-text-main/60 capitalize">{user.email}</p>
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
                <header className="lg:hidden h-[64px] bg-surface border-b border-white/5 flex items-center justify-between px-4 z-40 sticky top-0">
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-primary flex items-center justify-center shadow-[0_0_10px_rgba(163,255,18,0.2)]">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--color-bg)"><path d="M2 12l10-10 10 10-10 10z" /></svg>
                        </div>
                    </Link>

                    <button
                        onClick={() => setMobileProfileOpen(!mobileProfileOpen)}
                        className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center font-bold text-sm text-text-main"
                    >
                        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                    </button>

                    {mobileProfileOpen && (
                        <div className="absolute top-[70px] right-4 w-48 bg-surface border border-white/5 rounded-xl shadow-xl z-50 overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/5">
                                <p className="font-bold text-sm">{user.firstName} {user.lastName}</p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-error hover:bg-error/10 transition-colors"
                            >
                                <LogOut size={16} /> Log Out
                            </button>
                        </div>
                    )}
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto w-full relative scrollbar-thin">
                    <div className="w-full max-w-[1200px] mx-auto p-4 sm:p-6 lg:p-8">
                        {children}
                    </div>
                </main>

                {/* Mobile Bottom Navigation */}
                <div className="lg:hidden h-[72px] bg-surface border-t border-white/5 flex items-center justify-around px-2 z-40 pb-safe">
                    {mobileNavItems.map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex flex-col items-center justify-center gap-1 w-[60px] h-full ${isActive ? "text-primary" : "text-text-main/40"}`}
                            >
                                <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                                <span className={`text-[10px] uppercase font-bold tracking-wider ${isActive ? "text-primary" : "text-text-main/40"}`}>
                                    {item.label}
                                </span>
                                {isActive && (
                                    <div className="absolute top-0 w-8 h-[3px] bg-primary rounded-b-full shadow-[0_0_10px_rgba(163,255,18,0.5)]" />
                                )}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

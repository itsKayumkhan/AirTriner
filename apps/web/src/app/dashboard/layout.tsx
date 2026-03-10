"use client";

import { useEffect, useState } from "react";
import { getSession, clearSession, verifySessionStatus, AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
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
    Send
} from "lucide-react";
import { IconButton } from "@/components/ui/Buttons";
import { AuthContext } from "@/context/AuthContext";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [unreadMsgCount, setUnreadMsgCount] = useState(0);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const checkAuth = async () => {
            const session = await getSession();
            if (!session) {
                router.push("/auth/login");
                return;
            }

            // Real-time suspension check
            const isValid = await verifySessionStatus(session.id);
            if (!isValid) {
                await clearSession();
                alert("Your account has been suspended. You will be logged out.");
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
    }, [router, pathname]);

    // Fetch and subscribe to unread notifications count
    useEffect(() => {
        if (!user) return;

        const fetchUnreadCount = async () => {
            try {
                const { count, error } = await supabase
                    .from("notifications")
                    .select("*", { count: "exact", head: true })
                    .eq("user_id", user.id)
                    .eq("read", false);

                if (!error && count !== null) {
                    setUnreadCount(count);
                }
            } catch (err) {
                console.error("Failed to fetch unread count:", err);
            }
        };

        const fetchUnreadMsgCount = async () => {
            try {
                // Get user's active bookings
                const { data: bookings } = await supabase
                    .from("bookings")
                    .select("id")
                    .or(`athlete_id.eq.${user.id},trainer_id.eq.${user.id}`)
                    .in("status", ["confirmed", "completed", "pending"]);

                if (!bookings || bookings.length === 0) {
                    setUnreadMsgCount(0);
                    return;
                }

                const bookingIds = bookings.map(b => b.id);
                const { count, error } = await supabase
                    .from("messages")
                    .select("id", { count: "exact", head: true })
                    .in("booking_id", bookingIds)
                    .neq("sender_id", user.id)
                    .or("read_at.is.null,read.eq.false"); // Check both for robustness

                if (!error && count !== null) {
                    setUnreadMsgCount(count);
                }
            } catch (err) {
                console.error("Failed to fetch unread message count:", err);
            }
        };

        fetchUnreadCount();
        fetchUnreadMsgCount();

        // Real-time listener for notifications
        const notifChannel = supabase
            .channel(`notifications_${user.id}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
                () => fetchUnreadCount()
            )
            .subscribe();

        // Real-time listener for messages
        const msgChannel = supabase
            .channel(`unread_messages_${user.id}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "messages" },
                () => fetchUnreadMsgCount()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(notifChannel);
            supabase.removeChannel(msgChannel);
        };
    }, [user, pathname]); // Re-fetch on path changes (marking as read happens on page)

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
        { label: "Messages", href: "/dashboard/messages", icon: MessageSquare, badge: unreadMsgCount > 0 ? unreadMsgCount : undefined },
        { label: "Notifications", href: "/dashboard/notifications", icon: Bell, badge: unreadCount > 0 ? unreadCount : undefined },
    ];

    return (
        <div className="h-[100dvh] overflow-hidden bg-bg font-sans flex text-text-main font-sans selection:bg-primary/30">
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
                <div className="h-[72px] flex items-center justify-between px-6 border-b border-white/5">
                    <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setMobileMenuOpen(false)}>
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
                    <button className="md:hidden text-text-main/60 hover:text-white" onClick={() => setMobileMenuOpen(false)}>
                        <X size={20} />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5 scrollbar-thin">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {navItems.map((item: any) => {
                        if (item.divider) {
                            return <div key={item.id} className="h-px bg-gray-800 my-4 mx-2" />;
                        }
                        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setMobileMenuOpen(false)}
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

                {/* Bottom Action */}
                <div className="p-4 border-t border-white/5">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-error/80 hover:text-error hover:bg-error/10 transition-colors"
                    >
                        <LogOut size={20} />
                        <span>Log Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-[100dvh] overflow-hidden bg-bg md:ml-[260px]">

                {/* Top Desktop Headbar */}
                <header className="hidden md:flex h-[72px] border-b border-white/5 items-center justify-between px-8 bg-bg/80 backdrop-blur z-40 sticky top-0">
                    <div className="w-[360px]">
                    </div>

                    <div className="flex items-center gap-4">
                        <IconButton icon={<User size={18} />} onClick={() => router.push(user.role === 'trainer' ? '/dashboard/trainer/setup' : '/dashboard/profile')} />
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
                <header className="md:hidden h-[64px] bg-surface border-b border-white/5 flex items-center justify-between px-4 z-30 sticky top-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setMobileMenuOpen(true)} className="text-text-main hover:text-white transition-colors">
                            <Menu size={24} />
                        </button>
                        <Link href="/dashboard" className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center shadow-[0_0_10px_rgba(163,255,18,0.2)]">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--color-bg)"><path d="M2 12l10-10 10 10-10 10z" /></svg>
                            </div>
                        </Link>
                    </div>

                    <Link
                        href={user.role === 'trainer' ? '/dashboard/coach/setup' : '/dashboard/profile'}
                        className="w-9 h-9 rounded-full bg-gray-800 border-2 border-transparent focus:border-primary flex items-center justify-center font-bold text-sm text-text-main"
                    >
                        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                    </Link>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto w-full relative scrollbar-thin">
                    <div className="w-full max-w-[1200px] mx-auto p-4 sm:p-6 lg:p-8">
                        <AuthContext.Provider value={{ user, setUser }}>
                            {children}
                        </AuthContext.Provider>
                    </div>
                </main>
            </div>
        </div>
    );
}

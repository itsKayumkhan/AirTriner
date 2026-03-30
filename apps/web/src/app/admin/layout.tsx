"use client";

import { ReactNode, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { getSession, clearSession, AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
    LayoutDashboard,
    Users,
    Dumbbell,
    CalendarCheck,
    CreditCard,
    ShieldAlert,
    Settings,
    LogOut,
    Bell,
    Zap,
    Trophy,
    Crown,
    X,
    AlertCircle,
    CheckCircle2,
    Info,
    Menu
} from "lucide-react";

export default function AdminLayout({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const checkAuth = async () => {
            const session = getSession();
            if (!session) {
                router.push("/auth/login?returnTo=" + encodeURIComponent(pathname));
                return;
            }
            if (session.role !== "admin") {
                router.push("/dashboard");
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

    // Load notifications
    useEffect(() => {
        const loadNotifications = async () => {
            try {
                // Fetch recent activity from bookings, disputes as notifications
                const { data: recentBookings } = await supabase
                    .from("bookings")
                    .select("id, sport, status, created_at, athlete_id, users!bookings_athlete_id_fkey(first_name, last_name)")
                    .order("created_at", { ascending: false })
                    .limit(5);

                const { data: recentDisputes } = await supabase
                    .from("disputes")
                    .select("id, status, reason, created_at")
                    .order("created_at", { ascending: false })
                    .limit(3);

                const items: any[] = [];

                (recentBookings || []).forEach((b: any) => {
                    const name = b.users ? `${b.users.first_name || ''} ${b.users.last_name || ''}`.trim() : 'Someone';
                    items.push({
                        id: `b-${b.id}`,
                        type: 'booking',
                        title: `New ${b.sport} booking`,
                        desc: `${name} — ${b.status}`,
                        time: new Date(b.created_at),
                        read: b.status !== 'pending',
                    });
                });

                (recentDisputes || []).forEach((d: any) => {
                    items.push({
                        id: `d-${d.id}`,
                        type: 'dispute',
                        title: `Dispute ${d.status.replace('_', ' ')}`,
                        desc: (d.reason || '').substring(0, 60) + '...',
                        time: new Date(d.created_at),
                        read: d.status === 'resolved',
                    });
                });

                items.sort((a, b) => b.time.getTime() - a.time.getTime());
                setNotifications(items.slice(0, 8));
                setUnreadCount(items.filter(n => !n.read).length);
            } catch (err) {
                console.error('Failed to load notifications:', err);
            }
        };

        loadNotifications();
    }, []);

    // Close on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const formatTimeAgo = (date: Date) => {
        const diff = Date.now() - date.getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-bg">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!user) return null;

    const menuItems = [
        { icon: <LayoutDashboard size={20} />, label: "Dashboard", href: "/admin" },
        { icon: <ShieldAlert size={20} />, label: "Disputes", href: "/admin/disputes" },
        { icon: <Dumbbell size={20} />, label: "Trainers", href: "/admin/trainers" },
        { icon: <Users size={20} />, label: "Athletes", href: "/admin/athletes" },
        { icon: <CalendarCheck size={20} />, label: "Bookings", href: "/admin/bookings" },
        { icon: <Trophy size={20} />, label: "Sports", href: "/admin/sports" },
        { icon: <CreditCard size={20} />, label: "Payments", href: "/admin/payments" },
        { icon: <Crown size={20} />, label: "Subscriptions", href: "/admin/subscriptions" },
    ];

    const SidebarContent = ({ onNavClick }: { onNavClick?: () => void }) => (
        <>
            {/* Logo */}
            <div className="h-20 flex items-center px-6 border-b border-white/5 shrink-0">
                <Link href="/admin" className="flex items-center gap-2" onClick={onNavClick}>
                    <div className="w-8 h-8 rounded overflow-hidden flex items-center justify-center bg-zinc-900 border border-white/10">
                        <img src="/logo.jpeg" alt="Logo" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-lg font-black tracking-tight text-text-main leading-none">AirTrainr <span className="text-text-main/40 font-normal text-sm">Admin</span></span>
                </Link>
            </div>

            {/* Nav items */}
            <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto sidebar-scroll">
                {menuItems.map((item) => {
                    const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            onClick={onNavClick}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-semibold ${isActive
                                ? "bg-white/[0.06] text-text-main border-l-2 border-primary/70"
                                : "text-text-main/50 hover:text-text-main hover:bg-white/[0.04] border-l-2 border-transparent"
                                }`}
                        >
                            <span className={isActive ? "text-primary/80" : "text-text-main/40"}>{item.icon}</span>
                            {item.label}
                        </Link>
                    )
                })}
            </nav>

            {/* Bottom section — Settings & Logout */}
            <div className="px-3 py-4 border-t border-white/5 shrink-0 space-y-1">
                <Link
                    href="/admin/settings"
                    onClick={onNavClick}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-semibold w-full ${pathname.startsWith("/admin/settings")
                        ? "bg-white/[0.06] text-text-main border-l-2 border-primary/70"
                        : "text-text-main/50 hover:text-text-main hover:bg-white/[0.04] border-l-2 border-transparent"
                    }`}
                >
                    <Settings size={18} className={pathname.startsWith("/admin/settings") ? "text-primary/80" : "text-text-main/40"} />
                    Settings
                </Link>
                <button
                    onClick={() => { onNavClick?.(); handleLogout(); }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-semibold w-full text-text-main/50 hover:text-red-400 hover:bg-red-500/5 border-l-2 border-transparent"
                >
                    <LogOut size={18} className="text-text-main/40" />
                    Logout
                </button>
            </div>
        </>
    );

    return (
        <div className="flex h-screen bg-bg text-text-main font-sans overflow-hidden">
            {/* Desktop Sidebar */}
            <aside className="w-64 bg-surface border-r border-white/5 flex-col hidden lg:flex relative">
                <SidebarContent />
            </aside>

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                    {/* Drawer */}
                    <aside className="absolute left-0 top-0 h-full w-64 bg-surface border-r border-white/5 flex flex-col z-10 animate-in slide-in-from-left duration-200">
                        {/* Close button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="absolute top-5 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-text-main/60 hover:text-text-main hover:bg-white/10 transition-colors z-10"
                        >
                            <X size={16} />
                        </button>
                        <SidebarContent onNavClick={() => setIsMobileMenuOpen(false)} />
                    </aside>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden relative">

                {/* Header Navbar */}
                <header className="h-20 border-b border-white/5 bg-bg flex items-center justify-between px-4 md:px-8 shrink-0">
                    <div className="flex items-center gap-4">
                        {/* Hamburger — mobile only */}
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-full bg-surface border border-white/5 text-text-main/60 hover:text-text-main transition-colors"
                            aria-label="Open menu"
                        >
                            <Menu size={20} />
                        </button>
                        <div className="hidden lg:flex items-center w-full max-w-xl">
                            {pathname === "/admin/disputes" && <div></div>}
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="relative" ref={notifRef}>
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="relative w-10 h-10 rounded-full bg-surface border border-white/5 flex items-center justify-center text-text-main/60 hover:text-text-main transition-colors"
                            >
                                <Bell size={18} />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 flex items-center justify-center text-[10px] font-black text-white px-1">
                                        {unreadCount}
                                    </span>
                                )}
                            </button>

                            {/* Notifications Dropdown */}
                            {showNotifications && (
                                <div className="absolute right-0 top-14 w-[380px] bg-surface border border-white/5 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="flex items-center justify-between p-5 border-b border-white/5">
                                        <h3 className="font-black text-text-main text-sm">Notifications</h3>
                                        <button onClick={() => setShowNotifications(false)} className="text-text-main/40 hover:text-text-main transition-colors">
                                            <X size={16} />
                                        </button>
                                    </div>
                                    <div className="max-h-[400px] overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="p-8 text-center">
                                                <Bell size={24} className="mx-auto mb-2 text-text-main/20" />
                                                <p className="text-text-main/40 text-sm font-medium">No notifications yet</p>
                                            </div>
                                        ) : (
                                            notifications.map(n => (
                                                <div
                                                    key={n.id}
                                                    className={`flex items-start gap-3 px-5 py-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${!n.read ? 'bg-primary/5' : ''}`}
                                                >
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                                        n.type === 'dispute' ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'
                                                    }`}>
                                                        {n.type === 'dispute' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p className="text-sm font-bold text-text-main truncate">{n.title}</p>
                                                            <span className="text-[10px] text-text-main/40 font-medium flex-shrink-0">{formatTimeAgo(n.time)}</span>
                                                        </div>
                                                        <p className="text-xs text-text-main/50 font-medium mt-0.5 truncate">{n.desc}</p>
                                                    </div>
                                                    {!n.read && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2"></div>}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <div className="p-3 border-t border-white/5">
                                        <button
                                            onClick={() => { setShowNotifications(false); router.push('/admin'); }}
                                            className="w-full text-center text-xs font-black text-primary uppercase tracking-widest py-2 hover:bg-primary/5 rounded-lg transition-colors"
                                        >
                                            View All Activity
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3 border-l border-white/5 pl-6 cursor-pointer">
                            <div className="text-right hidden sm:block">
                                <div className="text-sm font-bold text-text-main">{user.firstName} {user.lastName}</div>
                                <div className="text-[10px] text-text-main/60 uppercase tracking-widest font-bold">SUPER ADMIN</div>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-[#272A35] overflow-hidden">
                                {user.avatarUrl ? (
                                    <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-primary font-black">
                                        {user.firstName?.[0]}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8 custom-scrollbar">
                    <div className="overflow-x-auto">
                        {children}
                    </div>
                </div>

            </main>

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

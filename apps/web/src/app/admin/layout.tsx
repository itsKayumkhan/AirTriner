"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { getSession, clearSession, AuthUser } from "@/lib/auth";
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
    Zap
} from "lucide-react";

export default function AdminLayout({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const checkAuth = async () => {
            const session = await getSession();
            if (!session) {
                router.push("/auth/login");
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
        { icon: <CreditCard size={20} />, label: "Payments", href: "/admin/payments" },
    ];

    return (
        <div className="flex h-screen bg-bg text-text-main font-sans overflow-hidden">
            {/* Desktop Sidebar */}
            <aside className="w-64 bg-surface border-r border-white/5 flex-col hidden lg:flex relative">
                <div className="h-20 flex items-center px-6">
                    <Link href="/admin" className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-bg">
                            <Zap size={18} className="fill-current" />
                        </div>
                        <span className="text-xl font-black tracking-tight text-text-main leading-none">AirTrainr <span className="text-text-main/60 font-normal">Admin</span></span>
                    </Link>
                </div>

                <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
                    {menuItems.map((item) => {
                        const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all font-bold text-sm ${isActive
                                    ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(163,255,18,0.1)]"
                                    : "text-text-main/60 hover:text-text-main hover:bg-white/5"
                                    }`}
                            >
                                {item.icon}
                                {item.label}
                            </Link>
                        )
                    })}
                </nav>

                <div className="p-4 mt-auto">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-4 px-4 py-3.5 text-text-main/60 font-bold text-sm hover:text-text-main transition-colors w-full"
                    >
                        <LogOut size={20} />
                        Logout
                    </button>
                    <Link href="/admin/settings" className="flex items-center gap-4 px-4 py-3.5 text-text-main/60 font-bold text-sm hover:text-text-main transition-colors w-full mt-2">
                        <Settings size={20} />
                        Settings
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden relative">

                {/* Header Navbar */}
                <header className="h-20 border-b border-white/5 bg-bg flex items-center justify-between px-8 shrink-0">
                    <div className="flex items-center w-full max-w-xl">
                        {/* Empty on left if we want, or a search bar */}
                        {pathname === "/admin/disputes" && <div className="hidden lg:block"></div>}
                    </div>

                    <div className="flex items-center gap-6">
                        <button className="relative w-10 h-10 rounded-full bg-surface border border-white/5 flex items-center justify-center text-text-main/60 hover:text-text-main transition-colors">
                            <Bell size={18} />
                            <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-red-500"></span>
                        </button>

                        <div className="flex items-center gap-3 border-l border-white/5 pl-6 cursor-pointer">
                            <div className="text-right">
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
                    {children}
                </div>

            </main>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #333;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: #555;
                }
            `}</style>
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
import { Plus, Search, ChevronDown, Users, Activity, CheckCircle, Loader2, X, Download } from "lucide-react";
import { supabase } from "@/lib/supabase";
import UserDetailsModal from "@/components/admin/UserDetailsModal";
import PopupModal from "@/components/common/PopupModal";

export default function AdminAthletesPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [athletes, setAthletes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ totalAthletes: 0, totalSessions: 0, activeNow: 0 });
    const [currentPage, setCurrentPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState("All");
    const [dateSort, setDateSort] = useState("newest");
    const [sessionsSort, setSessionsSort] = useState("none");
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    
    // User Modal State
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [showUserModal, setShowUserModal] = useState(false);
    
    // Add User Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [addForm, setAddForm] = useState({ firstName: "", lastName: "", email: "", password: "" });
    const [addingUser, setAddingUser] = useState(false);
    const [addError, setAddError] = useState("");

    // Alert/Confirmation Popup State
    const [popup, setPopup] = useState<{
        type: "success" | "error" | "confirm" | "warning" | "info";
        title: string;
        message: string;
        onConfirm?: () => void;
    } | null>(null);

    const showAlert = (type: "success" | "error" | "info", title: string, message: string) => {
        setPopup({ type, title, message });
    };

    const showConfirm = (title: string, message: string, onConfirm: () => void) => {
        setPopup({ type: "confirm", title, message, onConfirm });
    };

    const itemsPerPage = 10;

    useEffect(() => {
        const loadAthletesData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Athletes with session counts
                const { data: usersData, count: totalCount } = await supabase
                    .from("users")
                    .select("*", { count: "exact" })
                    .eq("role", "athlete")
                    .order("created_at", { ascending: false });

                if (usersData) {
                    // Fetch booking counts for these athletes
                    const { data: bookingsData } = await supabase
                        .from("bookings")
                        .select("athlete_id");
                    
                    const bookingCounts = (bookingsData || []).reduce((acc: any, b: any) => {
                        acc[b.athlete_id] = (acc[b.athlete_id] || 0) + 1;
                        return acc;
                    }, {});

                    setAthletes(usersData.map(u => ({
                        id: u.id,
                        name: `${u.first_name || ""} ${u.last_name || ""}`.trim(),
                        email: u.email,
                        date: new Date(u.created_at).toLocaleDateString(),
                        createdAt: u.created_at,
                        status: u.deleted_at ? "Suspended" : "Active",
                        sessions: bookingCounts[u.id] || 0,
                        initials: `${u.first_name?.[0] || ""}${u.last_name?.[0] || ""}`
                    })));

                    // 2. Fetch Stats
                    // Total Sessions
                    const { count: sessionCount } = await supabase
                        .from("bookings")
                        .select("*", { count: "exact", head: true });
                    
                    // Active Now (logged in last 24h)
                    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                    const { count: activeCount } = await supabase
                        .from("users")
                        .select("*", { count: "exact", head: true })
                        .eq("role", "athlete")
                        .gt("last_login_at", twentyFourHoursAgo);

                    setStats({
                        totalAthletes: totalCount || 0,
                        totalSessions: sessionCount || 0,
                        activeNow: activeCount || 0
                    });
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadAthletesData();
    }, [refreshTrigger]);

    const handleAddAthlete = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddingUser(true);
        setAddError("");
        
        try {
            const { data: session } = await supabase.auth.getSession();
            if (!session.session) throw new Error("No active session");
            
            const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.session.access_token}`
                },
                body: JSON.stringify({
                    ...addForm,
                    role: 'athlete'
                })
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to create user");
            
            // Success
            setShowAddModal(false);
            setAddForm({ firstName: "", lastName: "", email: "", password: "" });
            setRefreshTrigger(prev => prev + 1);
        } catch (err: any) {
            setAddError(err.message);
        } finally {
            setAddingUser(false);
        }
    };

    const handleToggleStatus = async (id: string, suspend: boolean) => {
        showConfirm(
            suspend ? "Suspend Athlete" : "Activate Athlete",
            `Are you sure you want to ${suspend ? "suspend" : "activate"} this athlete?`,
            async () => {
                try {
                    const { error } = await supabase
                        .from("users")
                        .update({ deleted_at: suspend ? new Date().toISOString() : null })
                        .eq("id", id);
                    
                    if (error) throw error;

                    setAthletes(prev => prev.map(a => 
                        a.id === id ? { ...a, status: suspend ? "Suspended" : "Active" } : a
                    ));
                    showAlert("success", "Success", `Athlete has been ${suspend ? "suspended" : "activated"}.`);
                } catch (err) {
                    console.error(err);
                    showAlert("error", "Error", "Failed to update status. Please try again.");
                }
            }
        );
    };

    const filteredAthletes = athletes
        .filter(a => {
            const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                a.email.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === "All" || a.status === statusFilter;
            return matchesSearch && matchesStatus;
        })
        .sort((a, b) => {
            if (sessionsSort === "high-to-low") return b.sessions - a.sessions;
            if (sessionsSort === "low-to-high") return a.sessions - b.sessions;
            
            if (dateSort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            if (dateSort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            
            return 0;
        });

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter, dateSort, sessionsSort]);

    const totalPages = Math.ceil(filteredAthletes.length / itemsPerPage);
    const paginatedAthletes = filteredAthletes.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleExportCSV = () => {
        const headers = ["Athlete ID", "Name", "Email", "Join Date", "Total Sessions", "Status"];
        
        const exportData = athletes.map(a => [
            a.id,
            a.name,
            a.email,
            a.date,
            a.sessions,
            a.status
        ]);

        const csvContent = [
            headers.join(","),
            ...exportData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `athletes_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-8 max-w-[1200px]">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-text-main tracking-tight mb-2">All Athletes</h1>
                    <p className="text-sm font-medium text-text-main/60">Manage and monitor professional athlete performance across all disciplines.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-6 py-3 rounded-full border border-gray-700 bg-surface text-sm font-bold text-text-main/80 hover:text-text-main hover:border-gray-500 transition-colors"
                    >
                        <Download size={16} /> Export CSV
                    </button>
                    <button 
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-bg font-black text-sm hover:shadow-[0_0_10px_rgba(163,255,18,0.2)] transition-all"
                    >
                        <Plus size={18} strokeWidth={3} /> Add Athlete
                    </button>
                </div>
            </div>

            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-surface border border-white/5 rounded-[24px] p-6 flex flex-col">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <Users size={20} className="text-primary" />
                    </div>
                    <div className="text-text-main/60 text-xs font-bold tracking-wide mb-1">Total Athletes</div>
                    <div className="text-3xl font-black text-text-main mb-6">{stats.totalAthletes.toLocaleString()}</div>
                    <div className="mt-auto h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-full rounded-full shadow-[0_0_10px_rgba(163,255,18,0.5)]"></div>
                    </div>
                </div>

                <div className="bg-surface border border-white/5 rounded-[24px] p-6 flex flex-col">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <Activity size={20} className="text-primary" />
                    </div>
                    <div className="text-text-main/60 text-xs font-bold tracking-wide mb-1">Total Sessions</div>
                    <div className="text-3xl font-black text-text-main mb-6">{stats.totalSessions.toLocaleString()}</div>
                    <div className="mt-auto h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-full rounded-full shadow-[0_0_10px_rgba(163,255,18,0.5)]"></div>
                    </div>
                </div>

                <div className="bg-surface border border-white/5 rounded-[24px] p-6 flex flex-col">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle size={20} className="text-primary" />
                    </div>
                    <div className="text-text-main/60 text-xs font-bold tracking-wide mb-1">Active Now</div>
                    <div className="text-3xl font-black text-text-main mb-6">{stats.activeNow.toLocaleString()}</div>
                    <div className="mt-auto h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-full rounded-full shadow-[0_0_10px_rgba(163,255,18,0.5)]"></div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-main/40" />
                    <input
                        type="text"
                        placeholder="Filter by name, email, or discipline..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-surface border border-white/5 rounded-full pl-12 pr-4 py-3 text-sm font-medium text-text-main focus:outline-none focus:border-gray-600 transition-colors"
                    />
                </div>
                <div className="flex flex-wrap gap-3">
                    <div className="relative group">
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="appearance-none bg-surface border border-white/5 rounded-full px-5 py-3 pr-10 text-sm font-bold text-text-main/80 w-40 focus:outline-none focus:border-gray-600 transition-colors cursor-pointer"
                        >
                            <option value="All">Status: All</option>
                            <option value="Active">Active</option>
                            <option value="Suspended">Suspended</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-main/40 pointer-events-none" />
                    </div>

                    <div className="relative group">
                        <select 
                            value={dateSort}
                            onChange={(e) => {
                                setDateSort(e.target.value);
                                setSessionsSort("none");
                            }}
                            className="appearance-none bg-surface border border-white/5 rounded-full px-5 py-3 pr-10 text-sm font-bold text-text-main/80 w-44 focus:outline-none focus:border-gray-600 transition-colors cursor-pointer"
                        >
                            <option value="newest">Joined: Newest</option>
                            <option value="oldest">Joined: Oldest</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-main/40 pointer-events-none" />
                    </div>

                    <div className="relative group">
                        <select 
                            value={sessionsSort}
                            onChange={(e) => {
                                setSessionsSort(e.target.value);
                                setDateSort("none");
                            }}
                            className="appearance-none bg-surface border border-white/5 rounded-full px-5 py-3 pr-10 text-sm font-bold text-text-main/80 w-44 focus:outline-none focus:border-gray-600 transition-colors cursor-pointer"
                        >
                            <option value="none">Sessions: Any</option>
                            <option value="high-to-low">High to Low</option>
                            <option value="low-to-high">Low to High</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-text-main/40 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-surface border border-white/5 rounded-[24px] overflow-hidden">
                <div className="overflow-x-auto min-h-[400px]">
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="w-10 h-10 text-primary animate-spin" />
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 bg-surface text-[10px] uppercase font-black tracking-widest text-text-main/40">
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4">Email</th>
                                    <th className="px-6 py-4">Joined Date</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Sessions</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-surface text-sm">
                                {paginatedAthletes.map((a, i) => (
                                    <tr key={a.id} className="border-b border-white/5/50 hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black flex-shrink-0 border border-primary/30 text-sm">
                                                    {a.initials}
                                                </div>
                                                <div className="font-bold text-text-main tracking-wide">{a.name}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-text-main/60 font-medium text-sm">{a.email}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-text-main/80 font-bold text-sm tracking-wide">{a.date}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest inline-flex border ${a.status === "Active"
                                                ? "border-primary text-primary"
                                                : "border-red-500/50 text-red-500 bg-red-500/10"
                                                }`}>
                                                {a.status}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-text-main font-black text-sm">{a.sessions}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => {
                                                        setSelectedUserId(a.id);
                                                        setShowUserModal(true);
                                                    }}
                                                    className="px-4 py-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/10 text-[10px] font-black uppercase tracking-widest transition-colors"
                                                >
                                                    View
                                                </button>
                                                {a.status === "Suspended" ? (
                                                    <button 
                                                        onClick={() => handleToggleStatus(a.id, false)}
                                                        className="px-4 py-1.5 rounded-full bg-primary text-bg text-[10px] font-black uppercase tracking-widest hover:shadow-[0_0_10px_rgba(163,255,18,0.3)] transition-all"
                                                    >
                                                        Activate
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={() => handleToggleStatus(a.id, true)}
                                                        className="px-4 py-1.5 rounded-full border border-red-500/30 text-red-500 hover:bg-red-500/10 text-[10px] font-black uppercase tracking-widest transition-colors"
                                                    >
                                                        Suspend
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {paginatedAthletes.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-20 text-text-main/40 font-bold">No athletes found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {!loading && filteredAthletes.length > 0 && (
                    <div className="px-6 py-4 flex items-center justify-between border-t border-white/5 bg-surface">
                        <div className="text-xs font-bold text-text-main/40 tracking-wide">
                            Showing <span className="text-text-main">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-text-main">{Math.min(currentPage * itemsPerPage, filteredAthletes.length)}</span> of <span className="text-text-main">{filteredAthletes.length}</span> results
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="w-8 h-8 flex items-center justify-center text-text-main/40 hover:text-text-main disabled:opacity-30 disabled:cursor-not-allowed"
                            >‹</button>
                            
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <button
                                    key={page}
                                    onClick={() => setCurrentPage(page)}
                                    className={`w-8 h-8 rounded-full font-black transition-all ${
                                        currentPage === page 
                                        ? "bg-primary text-bg shadow-[0_0_10px_rgba(163,255,18,0.3)]" 
                                        : "text-text-main/60 hover:text-text-main"
                                    }`}
                                >
                                    {page}
                                </button>
                            ))}

                            <button 
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="w-8 h-8 flex items-center justify-center text-text-main/40 hover:text-text-main disabled:opacity-30 disabled:cursor-not-allowed"
                            >›</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Add Athlete Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#1A1C23] border border-white/10 rounded-2xl p-6 shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black font-display uppercase tracking-wider text-white">Add Athlete</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-text-main/40 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleAddAthlete} className="space-y-4">
                            {addError && <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-sm rounded-xl">{addError}</div>}
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-text-main/60 mb-2">First Name</label>
                                    <input required value={addForm.firstName} onChange={e => setAddForm({...addForm, firstName: e.target.value})} className="w-full bg-[#12141A] border border-white/5 mx-0 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-primary/50 transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-text-main/60 mb-2">Last Name</label>
                                    <input required value={addForm.lastName} onChange={e => setAddForm({...addForm, lastName: e.target.value})} className="w-full bg-[#12141A] border border-white/5 mx-0 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-primary/50 transition-colors" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-text-main/60 mb-2">Email Address</label>
                                <input required type="email" value={addForm.email} onChange={e => setAddForm({...addForm, email: e.target.value})} className="w-full bg-[#12141A] border border-white/5 mx-0 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-primary/50 transition-colors" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-text-main/60 mb-2">Password</label>
                                <input required type="password" value={addForm.password} onChange={e => setAddForm({...addForm, password: e.target.value})} className="w-full bg-[#12141A] border border-white/5 mx-0 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-primary/50 transition-colors" />
                            </div>
                            
                            <div className="mt-6 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-2.5 rounded-full border border-white/10 text-white font-bold text-sm bg-transparent hover:bg-white/5 transition-colors">Cancel</button>
                                <button type="submit" disabled={addingUser} className="px-6 py-2.5 rounded-full bg-primary text-bg font-black text-sm hover:shadow-[0_0_15px_rgba(163,255,18,0.3)] transition-all disabled:opacity-50 flex items-center gap-2">
                                    {addingUser ? <Loader2 size={16} className="animate-spin" /> : null}
                                    Create Athlete
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* User Details Modal */}
            {showUserModal && selectedUserId && (
                <UserDetailsModal 
                    userId={selectedUserId} 
                    userRole="athlete" 
                    onClose={() => {
                        setShowUserModal(false);
                        setSelectedUserId(null);
                    }} 
                />
            )}

            <PopupModal 
                isOpen={!!popup}
                onClose={() => setPopup(null)}
                type={popup?.type || "info"}
                title={popup?.title || ""}
                message={popup?.message || ""}
                onConfirm={popup?.onConfirm}
            />
        </div>
    );
}

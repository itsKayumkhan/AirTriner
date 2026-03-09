"use client";

import { useState, useEffect } from "react";
import { Download, Plus, FileText, CheckCircle, Search, X, Loader2, Eye, Shield } from "lucide-react";
import UserDetailsModal from "@/components/admin/UserDetailsModal";
import PopupModal from "@/components/common/PopupModal";

const SPORTS_LIST = [
    "hockey", "baseball", "basketball", "football", "soccer",
    "tennis", "golf", "swimming", "boxing", "lacrosse",
    "wrestling", "martial_arts", "gymnastics", "track_and_field", "volleyball",
];
import { supabase } from "@/lib/supabase";

export default function AdminTrainersPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("Pending");
    const [trainers, setTrainers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedCertifications, setSelectedCertifications] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // User Modal State
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [showUserModal, setShowUserModal] = useState(false);

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

    // Add Trainer Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [addForm, setAddForm] = useState({ firstName: "", lastName: "", email: "", password: "", sports: [] as string[] });
    const [addingUser, setAddingUser] = useState(false);
    const [addError, setAddError] = useState("");

    const itemsPerPage = 5;

    useEffect(() => {
        const loadTrainers = async () => {
            try {
                const { data: usersData } = await supabase.from("users").select("*").eq("role", "trainer");
                if (!usersData) return;

                const userIds = usersData.map(u => u.id);
                const { data: profilesData } = await supabase.from("trainer_profiles").select("user_id, verification_status, sports, certifications").in("user_id", userIds);
                const profilesMap = new Map((profilesData || []).map(p => [p.user_id, p]));

                setTrainers(usersData.map(u => {
                    const profile = profilesMap.get(u.id);
                    const isVerified = profile?.verification_status === "verified";
                    const isDeclined = profile?.verification_status === "declined";
                    const statusText = isVerified ? "Verified" : (isDeclined ? "Declined" : "Pending Review");
                    const sports = profile?.sports || [];
                    
                    let certs = "No certifications provided.";
                    if (typeof profile?.certifications === "string") certs = profile.certifications;
                    else if (Array.isArray(profile?.certifications)) certs = profile.certifications.join("\n");

                    return {
                        id: u.id,
                        name: `${u.first_name || ""} ${u.last_name || ""}`.trim(),
                        email: u.email,
                        initials: `${u.first_name?.[0] || ""}${u.last_name?.[0] || ""}`,
                        specialty: sports.length > 0 ? sports[0] : "General",
                        status: statusText,
                        isVerified,
                        isDeclined,
                        certifications: certs
                    };
                }));
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadTrainers();
    }, [refreshTrigger]);

    const handleAddTrainer = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (addForm.sports.length === 0) {
            setAddError("Please select at least one sport");
            return;
        }

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
                    role: 'trainer'
                })
            });
            
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to create user");
            
            // Success
            setShowAddModal(false);
            setAddForm({ firstName: "", lastName: "", email: "", password: "", sports: [] });
            setRefreshTrigger(prev => prev + 1);
            showAlert("success", "Trainer Added", `Successfully created account for ${addForm.firstName}.`);
        } catch (err: any) {
            setAddError(err.message);
        } finally {
            setAddingUser(false);
        }
    };

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        try {
            await supabase.from("trainer_profiles").update({ 
                verification_status: newStatus,
                is_verified: newStatus === "verified"
            }).eq("user_id", id);
            
            setTrainers(prev => prev.map(t => {
                if (t.id === id) {
                    const isVerified = newStatus === "verified";
                    const isDeclined = newStatus === "declined";
                    return { ...t, isVerified, isDeclined, status: isVerified ? "Verified" : (isDeclined ? "Declined" : "Pending Review") };
                }
                return t;
            }));
            if (newStatus === "verified") {
                showAlert("success", "Trainer Approved", "The trainer has been successfully verified and is now discoverable.");
            } else if (newStatus === "declined") {
                showAlert("error", "Application Declined", "The trainer application has been rejected.");
            }
        } catch (err) {
            console.error(err);
            showAlert("error", "Action Failed", "There was an error updating the trainer status.");
        }
    };

    const handleApproveAll = async () => {
        const pendingTrainers = trainers.filter(t => !t.isVerified && !t.isDeclined);
        if (pendingTrainers.length === 0) return;

        showConfirm(
            "Bulk Approval",
            `Are you sure you want to approve all ${pendingTrainers.length} pending trainers? This will make them immediately bookable.`,
            async () => {
                try {
                    const ids = pendingTrainers.map(t => t.id);
                    const { error } = await supabase
                        .from("trainer_profiles")
                        .update({ 
                            verification_status: "verified",
                            is_verified: true
                        })
                        .in("user_id", ids);

                    if (error) throw error;

                    setRefreshTrigger(prev => prev + 1);
                    showAlert("success", "Batch Approved", `Successfully verified ${ids.length} trainers.`);
                } catch (err) {
                    console.error("Failed to approve all:", err);
                    showAlert("error", "Batch Failed", "Could not complete bulk approval.");
                }
            }
        );
    };

    const filteredTrainers = trainers.filter(t => {
        if (activeTab === "Verified" && !t.isVerified) return false;
        if (activeTab === "Declined" && !t.isDeclined) return false;
        if (activeTab === "Pending" && (t.isVerified || t.isDeclined)) return false;
        return t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.email.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // Reset pagination when filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab, searchQuery]);

    const totalPages = Math.ceil(filteredTrainers.length / itemsPerPage);
    const paginatedTrainers = filteredTrainers.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const pendingCount = trainers.filter(t => !t.isVerified && !t.isDeclined).length;

    const handleExportCSV = () => {
        const headers = ["Trainer ID", "Name", "Email", "Specialty", "Status", "Is Verified"];
        
        const exportData = trainers.map(t => [
            t.id,
            t.name,
            t.email,
            t.specialty,
            t.status,
            t.isVerified ? "Yes" : "No"
        ]);

        const csvContent = [
            headers.join(","),
            ...exportData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `trainers_export_${new Date().toISOString().split('T')[0]}.csv`);
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
                    <h1 className="text-3xl font-black text-text-main tracking-tight mb-2">Trainer Approvals</h1>
                    <p className="text-sm font-medium text-text-main/60">Review and verify professional certifications for new training partners.</p>
                </div>
                <div className="flex items-center gap-3">
                    {pendingCount > 0 && (
                        <button 
                            onClick={handleApproveAll}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-primary/30 bg-primary/10 text-sm font-bold text-primary hover:bg-primary/20 transition-all shadow-[0_0_10px_rgba(163,255,18,0.1)]"
                        >
                            <CheckCircle size={16} /> Approve All ({pendingCount})
                        </button>
                    )}
                    <button 
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-700 bg-surface text-sm font-bold text-text-main/80 hover:text-text-main hover:border-gray-500 transition-colors"
                    >
                        <Download size={16} /> Export CSV
                    </button>
                    <button 
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-bg font-black text-sm hover:shadow-[0_0_10px_rgba(163,255,18,0.2)] transition-all"
                    >
                        <Plus size={18} strokeWidth={3} /> Add Trainer
                    </button>
                </div>
            </div>

            {/* Tabs & Search */}
            <div className="flex justify-between items-center border-b border-white/5 pb-2 bg-bg sticky top-0 z-10 pt-2">
                <div className="flex gap-8">
                    {["Pending", "Verified", "Declined"].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-4 text-sm font-bold tracking-wide relative whitespace-nowrap ${activeTab === tab ? "text-primary border-b-2 border-primary" : "text-text-main/40 hover:text-text-main/80"
                                }`}
                        >
                            {tab === "Pending" ? `Pending Requests (${pendingCount})` : tab}
                        </button>
                    ))}
                </div>

                <div className="relative w-64 hidden md:block">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-main/40" />
                    <input
                        type="text"
                        placeholder="Search trainers..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-surface border border-white/5 rounded-full pl-10 pr-4 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-gray-500 transition-colors"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-surface border border-white/5 rounded-[24px] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-surface text-[10px] uppercase font-black tracking-widest text-text-main/40">
                                <th className="px-6 py-4">Trainer Name</th>
                                <th className="px-6 py-4">Specialty</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Documents</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-surface text-sm">
                            {paginatedTrainers.map((t, i) => (
                                <tr key={t.id} className="border-b border-white/5/50 hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <button 
                                                    onClick={() => {
                                                        setSelectedUserId(t.id);
                                                        setShowUserModal(true);
                                                    }}
                                                    className="w-10 h-10 rounded-full bg-[#272A35] flex items-center justify-center text-primary font-black flex-shrink-0 border border-gray-700 hover:border-primary/50 transition-colors"
                                                >
                                                    {t.initials}
                                                </button>
                                                <div>
                                                    <div className="font-bold text-text-main tracking-wide hover:text-primary cursor-pointer" onClick={() => {
                                                        setSelectedUserId(t.id);
                                                        setShowUserModal(true);
                                                    }}>
                                                        {t.name}
                                                    </div>
                                                    <div className="text-text-main/40 font-medium text-xs">{t.email}</div>
                                                </div>
                                            </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="bg-[#272A35] text-text-main/80 font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full inline-flex border border-gray-700">
                                            {t.specialty}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {t.isVerified ? (
                                                <span className="flex items-center gap-1.5 text-primary text-[10px] uppercase font-black tracking-widest bg-primary/10 px-2 py-1 rounded">
                                                    <CheckCircle size={14} className="fill-current text-gray-900" />
                                                    Verified
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-orange-500 text-[10px] uppercase font-black tracking-widest">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                                    Pending Review
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button 
                                            onClick={() => setSelectedCertifications(t.certifications)}
                                            className="flex items-center gap-2 text-primary text-xs font-black uppercase tracking-widest hover:text-text-main transition-colors"
                                        >
                                            <FileText size={16} />
                                            View Certs
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button 
                                                onClick={() => {
                                                    setSelectedUserId(t.id);
                                                    setShowUserModal(true);
                                                }}
                                                className="px-3 py-1.5 rounded-md border border-white/10 text-text-main/60 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                                            >
                                                <Eye size={14} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">View</span>
                                            </button>
                                            {!t.isVerified && (
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleUpdateStatus(t.id, "verified")} className="px-4 py-1.5 rounded-md border border-primary/20 text-primary hover:bg-primary/10 text-xs font-black uppercase tracking-widest transition-colors">
                                                        Approve
                                                    </button>
                                                    <button onClick={() => handleUpdateStatus(t.id, "declined")} className="px-4 py-1.5 rounded-md border border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs font-black uppercase tracking-widest transition-colors">
                                                        Reject
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 flex items-center justify-between border-t border-white/5 bg-surface">
                    <div className="text-xs font-bold text-text-main/40 tracking-wide">
                        Showing <span className="text-text-main">{paginatedTrainers.length}</span> of <span className="text-text-main">{filteredTrainers.length}</span> requests
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="w-8 h-8 flex items-center justify-center text-text-main/40 hover:text-text-main disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            ‹
                        </button>
                        
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`w-8 h-8 rounded-full font-bold transition-all ${
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
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="w-8 h-8 flex items-center justify-center text-text-main/40 hover:text-text-main disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            ›
                        </button>
                    </div>
                </div>
            </div>

            {/* Certifications Modal */}
            {selectedCertifications !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#1A1C23] border border-white/10 rounded-2xl p-6 shadow-2xl max-w-lg w-full animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black font-display uppercase tracking-wider text-white">Certifications</h3>
                            <button onClick={() => setSelectedCertifications(null)} className="text-text-main/40 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="bg-[#12141A] rounded-xl p-5 border border-white/5 whitespace-pre-wrap text-sm text-text-main/80 min-h-[100px] max-h-[300px] overflow-y-auto">
                            {selectedCertifications}
                        </div>
                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => setSelectedCertifications(null)}
                                className="px-6 py-2.5 rounded-full bg-surface border border-white/10 text-white font-bold text-sm hover:bg-white/5 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Trainer Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#1A1C23] border border-white/10 rounded-2xl p-6 shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black font-display uppercase tracking-wider text-white">Add Trainer</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-text-main/40 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        
                        <form onSubmit={handleAddTrainer} className="space-y-4">
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
                            
                            <div>
                                <label className="block text-xs font-bold text-text-main/60 mb-2 mt-4 text-primary">SELECT DISCIPLINES (Required)</label>
                                <div className="flex flex-wrap gap-2 p-2 bg-[#12141A] rounded-xl border border-white/5">
                                    {SPORTS_LIST.map((sport) => {
                                        const isSelected = addForm.sports.includes(sport);
                                        return (
                                            <button
                                                key={sport}
                                                type="button"
                                                onClick={() => {
                                                    setAddForm(prev => ({
                                                        ...prev,
                                                        sports: isSelected ? prev.sports.filter(s => s !== sport) : [...prev.sports, sport]
                                                    }))
                                                }}
                                                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${
                                                    isSelected 
                                                    ? 'bg-primary text-bg shadow-[0_4px_15px_rgba(163,255,18,0.25)] border-transparent' 
                                                    : 'bg-transparent border border-white/10 text-text-main/50 hover:border-white/30 hover:text-white'
                                                }`}
                                            >
                                                {sport.replace(/_/g, " ")}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            
                            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-white/5">
                                <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-2.5 rounded-full border border-white/10 text-white font-bold text-sm bg-transparent hover:bg-white/5 transition-colors">Cancel</button>
                                <button type="submit" disabled={addingUser} className="px-6 py-2.5 rounded-full bg-primary text-bg font-black text-sm hover:shadow-[0_0_15px_rgba(163,255,18,0.3)] transition-all disabled:opacity-50 flex items-center gap-2">
                                    {addingUser ? <Loader2 size={16} className="animate-spin" /> : null}
                                    Create Trainer
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
                    userRole="trainer" 
                    onClose={() => {
                        setShowUserModal(false);
                        setSelectedUserId(null);
                    }} 
                />
            )}

            {/* Global Alert/Confirm Modal */}
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

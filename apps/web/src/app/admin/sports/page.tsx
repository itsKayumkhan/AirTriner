"use client";

import { useState, useEffect } from "react";
import { 
    Plus, 
    Search, 
    Trophy, 
    MoreVertical, 
    Edit2, 
    Trash2, 
    Eye, 
    EyeOff,
    CheckCircle2,
    XCircle,
    Loader2,
    Upload,
    ImageIcon
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import PopupModal from "@/components/common/PopupModal";

interface Sport {
    id: string;
    name: string;
    slug: string;
    icon: string;
    image_url?: string;
    is_active: boolean;
    created_at: string;
}

export default function AdminSportsPage() {
    const [sports, setSports] = useState<Sport[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState<Sport | null>(null);
    const [formLoading, setFormLoading] = useState(false);
    
    // Form State
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [icon, setIcon] = useState("Activity");
    const [imageUrl, setImageUrl] = useState("");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState("");
    const [uploading, setUploading] = useState(false);

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

    useEffect(() => {
        loadSports();
    }, []);

    useEffect(() => {
        if (name && !isEditing) {
            setSlug(name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]/g, ''));
        }
    }, [name, isEditing]);

    const loadSports = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("sports")
                .select("*")
                .order("name", { ascending: true });
            
            if (error) throw error;
            setSports(data || []);
        } catch (err) {
            console.error("Failed to load sports:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const uploadImage = async (file: File): Promise<string> => {
        const result = await uploadToCloudinary(file, "airtrainer/sports", { resourceType: "image" });
        return result.url;
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            let finalImageUrl = imageUrl;
            
            if (imageFile) {
                setUploading(true);
                try {
                    finalImageUrl = await uploadImage(imageFile);
                } catch (err: any) {
                    console.error("Image upload failed:", err);
                    showAlert("error", "Upload Failed", `Image upload failed: ${err.message || 'Unknown error'}.`);
                    setFormLoading(false);
                    setUploading(false);
                    return;
                }
                setUploading(false);
            }

            if (isEditing) {
                const { error } = await supabase
                    .from("sports")
                    .update({ name, slug, icon, image_url: finalImageUrl })
                    .eq("id", isEditing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from("sports")
                    .insert([{ name, slug, icon, image_url: finalImageUrl, is_active: true }]);
                if (error) throw error;
            }
            
            await loadSports();
            closeModal();
            showAlert("success", isEditing ? "Updated" : "Created", `Sport "${name}" has been ${isEditing ? "updated" : "created"} successfully.`);
        } catch (err: any) {
            console.error("Failed to save sport:", err);
            showAlert("error", "Save Failed", `Error saving sport: ${err.message || 'Unknown error'}`);
        } finally {
            setFormLoading(false);
        }
    };

    const toggleStatus = async (sport: Sport) => {
        try {
            const { error } = await supabase
                .from("sports")
                .update({ is_active: !sport.is_active })
                .eq("id", sport.id);
            
            if (error) throw error;
            setSports(sports.map(s => s.id === sport.id ? { ...s, is_active: !s.is_active } : s));
        } catch (err) {
            console.error("Failed to toggle status:", err);
        }
    };

    const deleteSport = async (id: string) => {
        showConfirm(
            "Deactivate Category",
            "Deactivate this sport? It will no longer appear in search/booking flows. Existing bookings and trainer profiles referencing it remain intact, and you can re-activate later.",
            async () => {
                try {
                    const { error } = await supabase
                        .from("sports")
                        .update({ is_active: false })
                        .eq("id", id);

                    if (error) throw error;
                    setSports(sports.map(s => s.id === id ? { ...s, is_active: false } : s));
                    showAlert("success", "Deactivated", "The sport category has been deactivated.");
                } catch (err: any) {
                    console.error("Failed to deactivate sport:", err);
                    showAlert("error", "Failed", err?.message || "Could not deactivate sport.");
                }
            }
        );
    };

    const openModal = (sport?: Sport) => {
        if (sport) {
            setIsEditing(sport);
            setName(sport.name);
            setSlug(sport.slug);
            setIcon(sport.icon || "Activity");
            setImageUrl(sport.image_url || "");
            setImagePreview(sport.image_url || "");
        } else {
            setIsEditing(null);
            setName("");
            setSlug("");
            setIcon("Activity");
            setImageUrl("");
            setImagePreview("");
        }
        setImageFile(null);
        setIsAddModalOpen(true);
    };

    const closeModal = () => {
        setIsAddModalOpen(false);
        setIsEditing(null);
        setName("");
        setSlug("");
        setIcon("Activity");
        setImageUrl("");
        setImagePreview("");
        setImageFile(null);
    };

    const filteredSports = sports.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-8 max-w-[1200px]">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h1 className="text-3xl font-black text-text-main tracking-tight mb-2">Sports Categories</h1>
                    <p className="text-sm font-medium text-text-main/60">Manage the global catalog of sports available on AirTrainr.</p>
                </div>
                <button 
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-bg font-black text-sm hover:shadow-[0_0_10px_rgba(69,208,255,0.2)] transition-all"
                >
                    <Plus size={18} strokeWidth={3} /> Add New Sport
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-surface border border-white/5 p-4 rounded-2xl">
                <div className="relative w-full md:w-96">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-main/40" />
                    <input 
                        type="text"
                        placeholder="Search categories..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-bg border border-white/5 rounded-xl pl-12 pr-4 py-3 text-sm font-bold text-text-main focus:outline-none focus:border-primary/50 transition-colors"
                    />
                </div>
                <div className="text-xs font-bold text-text-main/40 uppercase tracking-widest">
                    Total: <span className="text-primary">{sports.length}</span> Categories
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full flex justify-center py-20">
                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    </div>
                ) : filteredSports.length === 0 ? (
                    <div className="col-span-full text-center py-20 bg-surface rounded-3xl border border-dashed border-white/[0.04]">
                        <Trophy size={48} className="mx-auto text-text-main/20 mb-4" />
                        <h3 className="text-lg font-bold text-text-main/40">No sports found</h3>
                    </div>
                ) : (
                    filteredSports.map(sport => (
                        <div key={sport.id} className={`bg-surface border ${sport.is_active ? 'border-white/5' : 'border-red-500/20 opacity-60'} rounded-2xl p-6 hover:border-gray-700 transition-all group`}>
                            <div className="flex justify-between items-start mb-6">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden ${sport.is_active ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-500'}`}>
                                    {sport.image_url ? (
                                        <img src={sport.image_url} alt={sport.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <Trophy size={24} />
                                    )}
                                </div>
                                <div className="flex gap-1">
                                    <button 
                                        onClick={() => openModal(sport)}
                                        className="p-2 text-text-main/40 hover:text-primary transition-colors hover:bg-white/5 rounded-lg"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button 
                                        onClick={() => toggleStatus(sport)}
                                        className={`p-2 transition-colors hover:bg-white/5 rounded-lg ${sport.is_active ? 'text-text-main/40 hover:text-red-500' : 'text-primary'}`}
                                        title={sport.is_active ? "Deactivate" : "Activate"}
                                    >
                                        {sport.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                                    </button>
                                    <button 
                                        onClick={() => deleteSport(sport.id)}
                                        className="p-2 text-text-main/40 hover:text-red-500 transition-colors hover:bg-white/5 rounded-lg"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-xl font-black text-text-main tracking-tight group-hover:text-primary transition-colors flex items-center gap-2">
                                    {sport.name}
                                    {!sport.is_active && <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded uppercase tracking-widest font-black">Inactive</span>}
                                </h3>
                                <div className="text-text-main/40 text-xs font-bold uppercase tracking-widest mt-1">/{sport.slug}</div>
                                <div className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-main/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                    Added {new Date(sport.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={closeModal}></div>
                    <div className="relative bg-surface border border-white/[0.04] w-full max-w-md rounded-3xl p-8 shadow-2xl overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
                        
                        <h2 className="text-2xl font-black text-text-main mb-6 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                {isEditing ? <Edit2 size={20} /> : <Plus size={20} strokeWidth={3} />}
                            </div>
                            {isEditing ? "Edit Sport" : "Add Sport"}
                        </h2>

                        <form onSubmit={handleSave} className="space-y-6">
                            <div className="flex items-center gap-6 mb-2">
                                <div className="relative group">
                                    <div className="w-[50px] h-[50px] rounded-xl bg-bg border border-white/5 flex items-center justify-center overflow-hidden">
                                        {imagePreview ? (
                                            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <ImageIcon size={20} className="text-text-main/20" />
                                        )}
                                    </div>
                                    <label className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-xl">
                                        <Upload size={16} className="text-primary" />
                                        <input 
                                            type="file" 
                                            accept="image/*" 
                                            onChange={handleImageChange} 
                                            className="hidden" 
                                        />
                                    </label>
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-text-main/40 mb-1">Sport Image</label>
                                    <p className="text-[10px] text-text-main/20 font-medium">Click box to upload (50x50 recommended)</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-text-main/40 mb-2">Sport Name</label>
                                <input 
                                    type="text" 
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Pickleball"
                                    required
                                    className="w-full bg-bg border border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-text-main focus:outline-none focus:border-primary/50 transition-colors"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-text-main/40 mb-2">URL Slug</label>
                                <input 
                                    type="text" 
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value)}
                                    placeholder="e.g. pickleball"
                                    required
                                    className="w-full bg-bg border border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-text-main focus:outline-none focus:border-primary/50 transition-colors"
                                />
                                <p className="text-[10px] text-text-main/20 mt-2 font-medium">Used for filtering and URLs. Unique identifier.</p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button 
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 px-6 py-4 rounded-xl border border-white/5 text-text-main/60 font-black text-sm hover:bg-white/5 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={formLoading}
                                    className="flex-1 px-6 py-4 rounded-xl bg-primary text-bg font-black text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2"
                                >
                                    {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isEditing ? "Update" : "Create")}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
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

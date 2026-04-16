"use client";

import { useEffect, useState } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Settings, Save, RefreshCw, Shield, Bell, Globe, CreditCard, Users, Calendar, AlertOctagon, TrendingUp } from "lucide-react";
import PopupModal from "@/components/common/PopupModal";

interface PlatformSettings {
    platform_fee_percentage: number;
    max_booking_distance: number;
    auto_approve_trainers: boolean;
    require_trainer_verification: boolean;
    cancellation_policy_hours: number;
    dispute_resolution_days: number;
    support_email: string;
    maintenance_mode: boolean;
    allowed_countries: string[];
}

const ALL_COUNTRIES = [
    { code: "US", name: "United States", flag: "🇺🇸" },
    { code: "CA", name: "Canada", flag: "🇨🇦" },
    { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
    { code: "AU", name: "Australia", flag: "🇦🇺" },
    { code: "IN", name: "India", flag: "🇮🇳" },
    { code: "DE", name: "Germany", flag: "🇩🇪" },
    { code: "FR", name: "France", flag: "🇫🇷" },
    { code: "BR", name: "Brazil", flag: "🇧🇷" },
    { code: "MX", name: "Mexico", flag: "🇲🇽" },
    { code: "JP", name: "Japan", flag: "🇯🇵" },
    { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
    { code: "IE", name: "Ireland", flag: "🇮🇪" },
    { code: "ZA", name: "South Africa", flag: "🇿🇦" },
    { code: "AE", name: "UAE", flag: "🇦🇪" },
    { code: "SG", name: "Singapore", flag: "🇸🇬" },
];

export default function AdminSettingsPage() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [originalSettings, setOriginalSettings] = useState<PlatformSettings | null>(null);
    const [settings, setSettings] = useState<PlatformSettings>({
        platform_fee_percentage: 3,
        max_booking_distance: 50,
        auto_approve_trainers: false,
        require_trainer_verification: true,
        cancellation_policy_hours: 24,
        dispute_resolution_days: 7,
        support_email: "support@airtrainer.com",
        maintenance_mode: false,
        allowed_countries: ["US", "CA"],
    });
    const [popup, setPopup] = useState<{
        type: "success" | "error" | "confirm" | "warning" | "info";
        title: string;
        message: string;
        onConfirm?: () => void;
    } | null>(null);

    const [locationLeads, setLocationLeads] = useState<{ country: string; count: number }[]>([]);

    const showAlert = (type: "success" | "error" | "info", title: string, message: string) => {
        setPopup({ type, title, message });
    };

    useEffect(() => {
        const session = getSession();
        if (session) {
            setUser(session);
            loadSettings();
        }
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("platform_settings")
                .select("*")
                .maybeSingle();

            if (error) {
                if (error.code === "PGRST116") {
                    console.log("No settings found, using defaults");
                } else {
                    throw error;
                }
            }

            if (data) {
                const loaded: PlatformSettings = {
                    platform_fee_percentage: data.platform_fee_percentage,
                    max_booking_distance: data.max_booking_distance,
                    auto_approve_trainers: data.auto_approve_trainers,
                    require_trainer_verification: data.require_trainer_verification,
                    cancellation_policy_hours: data.cancellation_policy_hours,
                    dispute_resolution_days: data.dispute_resolution_days,
                    support_email: data.support_email,
                    maintenance_mode: data.maintenance_mode,
                    allowed_countries: data.allowed_countries || ["US", "CA"],
                };
                setSettings(loaded);
                setOriginalSettings(loaded);
            }
            // Load location leads
            const { data: leads } = await supabase
                .from("location_leads")
                .select("searched_country");
            if (leads?.length) {
                const counts: Record<string, number> = {};
                leads.forEach((l: { searched_country: string }) => {
                    const c = l.searched_country || "Unknown";
                    counts[c] = (counts[c] || 0) + 1;
                });
                setLocationLeads(
                    Object.entries(counts)
                        .map(([country, count]) => ({ country, count }))
                        .sort((a, b) => b.count - a.count)
                );
            }
        } catch (err) {
            console.error("Failed to load settings:", err);
            showAlert("error", "Error", "Failed to load settings from server");
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/admin/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Save failed");

            setOriginalSettings({ ...settings });
            showAlert("success", "Settings Saved", "Your platform configuration has been updated successfully.");
        } catch (err: any) {
            console.error("Failed to save settings:", err);
            showAlert("error", "Save Failed", err.message || "Make sure you have admin permissions.");
        } finally {
            setSaving(false);
        }
    };

    const handleSettingChange = (key: keyof PlatformSettings, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-[1600px] w-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight uppercase leading-none flex items-center gap-4">
                        <span className="text-text-main">Global</span>
                        <span className="text-primary border-b-4 border-primary pb-1">Settings</span>
                    </h1>
                    <p className="text-text-main/60 font-medium max-w-xl text-sm md:text-base mt-2">
                        Configure core platform parameters, thresholds, and administrative policies across all systems.
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                        type="button"
                        onClick={saveSettings}
                        disabled={saving || (originalSettings !== null && JSON.stringify(settings) === JSON.stringify(originalSettings))}
                        className="flex items-center justify-center gap-2 w-full md:w-auto px-8 py-3.5 rounded-2xl bg-primary text-bg font-black text-sm uppercase tracking-widest hover:shadow-[0_0_30px_rgba(69,208,255,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
                    >
                        {saving ? (
                            <><RefreshCw size={18} className="animate-spin" /> Saving...</>
                        ) : (
                            <><Save size={18} strokeWidth={3} /> Save Configuration</>
                        )}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Platform Configuration */}
                <div className="bg-gradient-to-br from-surface to-surface/50 border border-white/5 rounded-[24px] p-8 shadow-2xl relative overflow-hidden group hover:border-white/[0.04] transition-colors">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                            <Settings size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-text-main uppercase tracking-widest">Platform Core</h3>
                            <p className="text-xs font-semibold uppercase tracking-widest text-text-main/40 mt-1">Financials & Meta</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="relative">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-text-main/60 mb-2 ml-1">
                                Platform Fee Percentage
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="20"
                                step="0.1"
                                value={settings.platform_fee_percentage}
                                onChange={(e) => handleSettingChange('platform_fee_percentage', Number(e.target.value))}
                                className="w-full bg-[#12141A] border border-white/5 rounded-xl px-5 py-3.5 text-sm font-bold text-text-main focus:outline-none focus:border-primary/50 shadow-inner transition-colors"
                            />
                            <p className="text-[11px] text-text-main/40 mt-2 font-medium px-1">Percentage charged on each transaction</p>
                        </div>

                        <div className="relative">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-text-main/60 mb-2 ml-1">
                                Max Booking Distance (Miles)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="200"
                                value={settings.max_booking_distance}
                                onChange={(e) => handleSettingChange('max_booking_distance', Number(e.target.value))}
                                className="w-full bg-[#12141A] border border-white/5 rounded-xl px-5 py-3.5 text-sm font-bold text-text-main focus:outline-none focus:border-primary/50 shadow-inner transition-colors"
                            />
                            <p className="text-[11px] text-text-main/40 mt-2 font-medium px-1">Maximum distance for trainer-athlete matching</p>
                        </div>

                        <div className="relative">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-text-main/60 mb-2 ml-1">
                                Support Contact Route
                            </label>
                            <input
                                type="email"
                                value={settings.support_email}
                                onChange={(e) => handleSettingChange('support_email', e.target.value)}
                                className="w-full bg-[#12141A] border border-white/5 rounded-xl px-5 py-3.5 text-sm font-bold text-text-main focus:outline-none focus:border-primary/50 shadow-inner transition-colors"
                            />
                            <p className="text-[11px] text-text-main/40 mt-2 font-medium px-1">Email displayed to users for support</p>
                        </div>

                        <div className="pt-4 border-t border-white/5 mt-6">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                                <div>
                                    <h4 className="text-sm font-bold text-red-500 mb-0.5">Maintenance Mode</h4>
                                    <p className="text-xs text-text-main/50 font-medium">Take system offline for updates</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleSettingChange('maintenance_mode', !settings.maintenance_mode)}
                                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors border ${
                                        settings.maintenance_mode ? 'bg-red-500 border-red-400' : 'bg-[#12141A] border-white/[0.04]'
                                    }`}
                                >
                                    <span
                                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                                            settings.maintenance_mode ? 'translate-x-6 shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* User & Identity Management */}
                <div className="bg-gradient-to-br from-surface to-surface/50 border border-white/5 rounded-[24px] p-8 shadow-2xl relative overflow-hidden group hover:border-white/[0.04] transition-colors">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-500">
                            <Users size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-text-main uppercase tracking-widest">Identity Control</h3>
                            <p className="text-xs font-semibold uppercase tracking-widest text-text-main/40 mt-1">Provider Validation</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-5 rounded-xl bg-[#12141A] border border-white/5 hover:border-white/[0.04] transition-colors">
                            <div className="pr-4">
                                <h4 className="text-sm font-bold text-text-main mb-1">Auto-approve Trainers</h4>
                                <p className="text-xs text-text-main/50 font-medium leading-relaxed">Skip manual review for new trainer registrations. Accounts go live immediately.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleSettingChange('auto_approve_trainers', !settings.auto_approve_trainers)}
                                className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors border ${
                                    settings.auto_approve_trainers ? 'bg-primary border-primary' : 'bg-[#1A1D24] border-white/[0.04]'
                                }`}
                            >
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-bg transition-transform ${
                                    settings.auto_approve_trainers ? 'translate-x-6 bg-surface shadow-[0_0_10px_rgba(69,208,255,0.5)]' : 'translate-x-1 bg-white/50'
                                }`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-5 rounded-xl bg-[#12141A] border border-white/5 hover:border-white/[0.04] transition-colors">
                            <div className="pr-4">
                                <h4 className="text-sm font-bold text-text-main mb-1">Require Strict Verification</h4>
                                <p className="text-xs text-text-main/50 font-medium leading-relaxed">Mandate ID uploads and background checks before a trainer can accept payments.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleSettingChange('require_trainer_verification', !settings.require_trainer_verification)}
                                className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors border ${
                                    settings.require_trainer_verification ? 'bg-primary border-primary' : 'bg-[#1A1D24] border-white/[0.04]'
                                }`}
                            >
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-bg transition-transform ${
                                    settings.require_trainer_verification ? 'translate-x-6 bg-surface shadow-[0_0_10px_rgba(69,208,255,0.5)]' : 'translate-x-1 bg-white/50'
                                }`} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Policies & Resolving */}
                <div className="bg-gradient-to-br from-surface to-surface/50 border border-white/5 rounded-[24px] p-8 shadow-2xl relative overflow-hidden group hover:border-white/[0.04] transition-colors">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500">
                            <Shield size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-text-main uppercase tracking-widest">Policy Engine</h3>
                            <p className="text-xs font-semibold uppercase tracking-widest text-text-main/40 mt-1">Cancellations & Rules</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="relative">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-text-main/60 mb-2 ml-1">
                                Strict Cancel Window (hrs)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="168"
                                value={settings.cancellation_policy_hours}
                                onChange={(e) => handleSettingChange('cancellation_policy_hours', Number(e.target.value))}
                                className="w-full bg-[#12141A] border border-white/5 rounded-xl px-5 py-3.5 text-sm font-bold text-text-main focus:outline-none focus:border-primary/50 shadow-inner transition-colors"
                            />
                            <p className="text-[11px] text-text-main/40 mt-2 font-medium px-1">Any cancellation within this timeframe yields no refunds.</p>
                        </div>

                        <div className="relative">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-text-main/60 mb-2 ml-1">
                                Auto-Resolution Timeframe (Days)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="30"
                                value={settings.dispute_resolution_days}
                                onChange={(e) => handleSettingChange('dispute_resolution_days', Number(e.target.value))}
                                className="w-full bg-[#12141A] border border-white/5 rounded-xl px-5 py-3.5 text-sm font-bold text-text-main focus:outline-none focus:border-primary/50 shadow-inner transition-colors"
                            />
                            <p className="text-[11px] text-text-main/40 mt-2 font-medium px-1">Max days allowed to resolve disputes before forceful admin closure.</p>
                        </div>
                    </div>
                </div>

                {/* System Infrastructure */}
                <div className="bg-gradient-to-br from-surface to-surface/50 border border-white/5 rounded-[24px] p-8 shadow-2xl relative overflow-hidden group hover:border-white/[0.04] transition-colors flex flex-col">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center border border-green-500/20 text-green-500">
                            <Globe size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-text-main uppercase tracking-widest">Global Status</h3>
                            <p className="text-xs font-semibold uppercase tracking-widest text-text-main/40 mt-1">Infrastructure Health</p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 flex-1 justify-center">
                        <div className="flex items-center justify-between p-4 bg-[#12141A] border border-white/5 rounded-xl">
                            <p className="font-black text-sm uppercase tracking-widest text-text-main/80">Edge Database</p>
                            <span className="flex items-center gap-2 text-green-500 text-[10px] uppercase font-black tracking-widest bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> Healthy
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-[#12141A] border border-white/5 rounded-xl">
                            <p className="font-black text-sm uppercase tracking-widest text-text-main/80">API Gateway</p>
                            <span className="flex items-center gap-2 text-green-500 text-[10px] uppercase font-black tracking-widest bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> Operating
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-[#12141A] border border-white/5 rounded-xl">
                            <p className="font-black text-sm uppercase tracking-widest text-text-main/80">Payments Link</p>
                            <span className="flex items-center gap-2 text-green-500 text-[10px] uppercase font-black tracking-widest bg-green-500/10 px-3 py-1.5 rounded-full border border-green-500/20">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> Linked
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Allowed Countries */}
            <div className="bg-gradient-to-br from-surface to-surface/50 border border-white/5 rounded-[24px] p-8 shadow-2xl relative overflow-hidden">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-500">
                        <Globe size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-text-main uppercase tracking-widest">Country Access</h3>
                        <p className="text-xs font-semibold uppercase tracking-widest text-text-main/40 mt-1">Where AirTrainr operates</p>
                    </div>
                </div>
                <p className="text-xs text-text-main/50 font-medium mb-5">
                    Select which countries trainers and athletes can register from. Only users from allowed countries will appear in search results.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {ALL_COUNTRIES.map((c) => {
                        const isActive = settings.allowed_countries.includes(c.code);
                        return (
                            <button
                                key={c.code}
                                type="button"
                                onClick={() => {
                                    if (isActive) {
                                        if (settings.allowed_countries.length <= 1) return; // Keep at least 1
                                        handleSettingChange("allowed_countries", settings.allowed_countries.filter(cc => cc !== c.code));
                                    } else {
                                        handleSettingChange("allowed_countries", [...settings.allowed_countries, c.code]);
                                    }
                                }}
                                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-left transition-all ${
                                    isActive
                                        ? "bg-emerald-500/10 border-emerald-500/30 text-white"
                                        : "bg-[#12141A] border-white/5 text-text-main/40 hover:border-white/10 hover:text-text-main/60"
                                }`}
                            >
                                <span className="text-lg">{c.flag}</span>
                                <div>
                                    <p className={`text-xs font-bold ${isActive ? "text-white" : "text-text-main/50"}`}>{c.code}</p>
                                    <p className={`text-[10px] ${isActive ? "text-emerald-400/70" : "text-text-main/30"}`}>{c.name}</p>
                                </div>
                                {isActive && (
                                    <div className="ml-auto w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" className="w-2.5 h-2.5"><polyline points="20 6 9 17 4 12" /></svg>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
                <p className="text-[10px] text-text-main/30 mt-4 font-medium">
                    {settings.allowed_countries.length} {settings.allowed_countries.length === 1 ? "country" : "countries"} active. At least 1 required.
                </p>
            </div>

            {/* Location Demand / Leads */}
            {locationLeads.length > 0 && (
                <div className="bg-gradient-to-br from-surface to-surface/50 border border-white/5 rounded-[24px] p-8 shadow-2xl">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-text-main uppercase tracking-widest">Location Demand</h3>
                            <p className="text-xs font-semibold uppercase tracking-widest text-text-main/40 mt-1">Users searching from unavailable regions</p>
                        </div>
                    </div>
                    <p className="text-xs text-text-main/50 font-medium mb-5">
                        These are countries where users tried to register but AirTrainr isn&apos;t available yet. Consider enabling them above.
                    </p>
                    <div className="space-y-2">
                        {locationLeads.map((lead) => (
                            <div key={lead.country} className="flex items-center justify-between p-3 bg-[#12141A] border border-white/5 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-bold text-white">{lead.country}</span>
                                    {!settings.allowed_countries.includes(lead.country) && (
                                        <span className="text-[9px] font-black uppercase tracking-widest text-amber-400/60 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/10">Not Enabled</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-black text-primary">{lead.count}</span>
                                    <span className="text-[10px] text-text-main/40 font-bold uppercase">requests</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-text-main/30 mt-4">
                        Total: {locationLeads.reduce((s, l) => s + l.count, 0)} requests from {locationLeads.length} {locationLeads.length === 1 ? "country" : "countries"}
                    </p>
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

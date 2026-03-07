"use client";

import { useEffect, useState } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Settings, Save, RefreshCw, Shield, Bell, Globe, CreditCard, Users, Calendar, AlertOctagon } from "lucide-react";

interface PlatformSettings {
    platform_fee_percentage: number;
    max_booking_distance: number;
    auto_approve_trainers: boolean;
    require_trainer_verification: boolean;
    cancellation_policy_hours: number;
    dispute_resolution_days: number;
    support_email: string;
    maintenance_mode: boolean;
}

export default function AdminSettingsPage() {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<PlatformSettings>({
        platform_fee_percentage: 3,
        max_booking_distance: 50,
        auto_approve_trainers: false,
        require_trainer_verification: true,
        cancellation_policy_hours: 24,
        dispute_resolution_days: 7,
        support_email: "support@airtrainer.com",
        maintenance_mode: false,
    });
    const [notification, setNotification] = useState<{message: string; type: "success" | "error"} | null>(null);

    useEffect(() => {
        const session = getSession();
        if (session) {
            setUser(session);
            loadSettings();
        }
    }, []);

    const loadSettings = async () => {
        try {
            // Load from localStorage for demonstration
            const savedSettings = localStorage.getItem('airtrainer_platform_settings');
            if (savedSettings) {
                setSettings(JSON.parse(savedSettings));
            }
            setLoading(false);
        } catch (err) {
            console.error("Failed to load settings:", err);
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        setSaving(true);
        try {
            // Save to localStorage simulation
            await new Promise(resolve => setTimeout(resolve, 800)); 
            localStorage.setItem('airtrainer_platform_settings', JSON.stringify(settings));
            
            setNotification({ message: "Settings saved successfully!", type: "success" });
            setTimeout(() => setNotification(null), 3000);
        } catch (err) {
            console.error("Failed to save settings:", err);
            setNotification({ message: "Failed to save settings", type: "error" });
            setTimeout(() => setNotification(null), 3000);
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
                        disabled={saving}
                        className="flex items-center justify-center gap-2 w-full md:w-auto px-8 py-3.5 rounded-2xl bg-primary text-bg font-black text-sm uppercase tracking-widest hover:shadow-[0_0_30px_rgba(163,255,18,0.4)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
                    >
                        {saving ? (
                            <><RefreshCw size={18} className="animate-spin" /> Committing...</>
                        ) : (
                            <><Save size={18} strokeWidth={3} /> Save Configuration</>
                        )}
                    </button>
                </div>
            </div>

            {/* Notification */}
            {notification && (
                <div className={`p-4 rounded-xl font-bold flex items-center gap-3 transition-all animate-in fade-in slide-in-from-top-4 ${
                    notification.type === "success" 
                        ? "bg-green-500/10 text-green-500 border border-green-500/20" 
                        : "bg-red-500/10 text-red-500 border border-red-500/20"
                }`}>
                    {notification.type === "success" ? <Globe size={20} /> : <AlertOctagon size={20} />}
                    {notification.message}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Platform Configuration */}
                <div className="bg-gradient-to-br from-surface to-surface/50 border border-white/5 rounded-[24px] p-8 shadow-2xl relative overflow-hidden group hover:border-white/10 transition-colors">
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
                                        settings.maintenance_mode ? 'bg-red-500 border-red-400' : 'bg-[#12141A] border-white/10'
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
                <div className="bg-gradient-to-br from-surface to-surface/50 border border-white/5 rounded-[24px] p-8 shadow-2xl relative overflow-hidden group hover:border-white/10 transition-colors">
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
                        <div className="flex items-center justify-between p-5 rounded-xl bg-[#12141A] border border-white/5 hover:border-white/10 transition-colors">
                            <div className="pr-4">
                                <h4 className="text-sm font-bold text-text-main mb-1">Auto-approve Trainers</h4>
                                <p className="text-xs text-text-main/50 font-medium leading-relaxed">Skip manual review for new trainer registrations. Accounts go live immediately.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleSettingChange('auto_approve_trainers', !settings.auto_approve_trainers)}
                                className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors border ${
                                    settings.auto_approve_trainers ? 'bg-primary border-primary' : 'bg-[#1A1D24] border-white/10'
                                }`}
                            >
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-bg transition-transform ${
                                    settings.auto_approve_trainers ? 'translate-x-6 bg-surface shadow-[0_0_10px_rgba(163,255,18,0.5)]' : 'translate-x-1 bg-white/50'
                                }`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-5 rounded-xl bg-[#12141A] border border-white/5 hover:border-white/10 transition-colors">
                            <div className="pr-4">
                                <h4 className="text-sm font-bold text-text-main mb-1">Require Strict Verification</h4>
                                <p className="text-xs text-text-main/50 font-medium leading-relaxed">Mandate ID uploads and background checks before a trainer can accept payments.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleSettingChange('require_trainer_verification', !settings.require_trainer_verification)}
                                className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors border ${
                                    settings.require_trainer_verification ? 'bg-primary border-primary' : 'bg-[#1A1D24] border-white/10'
                                }`}
                            >
                                <span className={`inline-block h-5 w-5 transform rounded-full bg-bg transition-transform ${
                                    settings.require_trainer_verification ? 'translate-x-6 bg-surface shadow-[0_0_10px_rgba(163,255,18,0.5)]' : 'translate-x-1 bg-white/50'
                                }`} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Policies & Resolving */}
                <div className="bg-gradient-to-br from-surface to-surface/50 border border-white/5 rounded-[24px] p-8 shadow-2xl relative overflow-hidden group hover:border-white/10 transition-colors">
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
                <div className="bg-gradient-to-br from-surface to-surface/50 border border-white/5 rounded-[24px] p-8 shadow-2xl relative overflow-hidden group hover:border-white/10 transition-colors flex flex-col">
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
        </div>
    );
}

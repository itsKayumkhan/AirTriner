"use client";

import { useEffect, useState } from "react";
import { getSession, AuthUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Settings, Save, RefreshCw, Shield, Bell, Globe, CreditCard, Users, Calendar } from "lucide-react";

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
    const [notification, setNotification] = useState<string | null>(null);

    useEffect(() => {
        const session = getSession();
        if (session) {
            setUser(session);
            loadSettings();
        }
    }, []);

    const loadSettings = async () => {
        try {
            // In a real implementation, this would fetch from a settings table
            // For now, we'll use default values
            setLoading(false);
        } catch (err) {
            console.error("Failed to load settings:", err);
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        setSaving(true);
        try {
            // In a real implementation, this would save to database
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
            setNotification("Settings saved successfully!");
            setTimeout(() => setNotification(null), 3000);
        } catch (err) {
            console.error("Failed to save settings:", err);
            setNotification("Failed to save settings");
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
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black text-[#0f172a] tracking-tight mb-2">Platform Settings</h2>
                    <p className="text-[#64748b] text-lg">
                        Configure platform-wide settings and policies
                    </p>
                </div>
                <button
                    onClick={saveSettings}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-text-main font-bold shadow-[0_4px_14px_0_rgba(59,130,246,0.39)] hover:shadow-[0_6px_20px_rgba(59,130,246,0.23)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? (
                        <>
                            <RefreshCw size={18} className="animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save size={18} />
                            Save Settings
                        </>
                    )}
                </button>
            </div>

            {/* Notification */}
            {notification && (
                <div className={`p-4 rounded-lg font-medium ${
                    notification.includes("success") 
                        ? "bg-[#d1fae5] text-[#059669]" 
                        : "bg-[#fee2e2] text-[#dc2626]"
                }`}>
                    {notification}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Platform Settings */}
                <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-[#eff6ff] flex items-center justify-center">
                            <Settings size={20} className="text-[#3b82f6]" />
                        </div>
                        <h3 className="text-lg font-bold text-[#0f172a]">Platform Configuration</h3>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] mb-2">
                                Platform Fee Percentage
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="20"
                                step="0.1"
                                value={settings.platform_fee_percentage}
                                onChange={(e) => handleSettingChange('platform_fee_percentage', Number(e.target.value))}
                                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                            />
                            <p className="text-xs text-[#64748b] mt-1">Percentage charged on each transaction</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[#64748b] mb-2">
                                Max Booking Distance (miles)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="200"
                                value={settings.max_booking_distance}
                                onChange={(e) => handleSettingChange('max_booking_distance', Number(e.target.value))}
                                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                            />
                            <p className="text-xs text-[#64748b] mt-1">Maximum distance for trainer-athlete matching</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[#64748b] mb-2">
                                Support Email
                            </label>
                            <input
                                type="email"
                                value={settings.support_email}
                                onChange={(e) => handleSettingChange('support_email', e.target.value)}
                                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                            />
                            <p className="text-xs text-[#64748b] mt-1">Email displayed to users for support</p>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <label className="block text-sm font-medium text-[#64748b] mb-1">
                                    Maintenance Mode
                                </label>
                                <p className="text-xs text-[#64748b]">Disable platform for maintenance</p>
                            </div>
                            <button
                                onClick={() => handleSettingChange('maintenance_mode', !settings.maintenance_mode)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    settings.maintenance_mode ? 'bg-[#ef4444]' : 'bg-[#cbd5e1]'
                                }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        settings.maintenance_mode ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>
                    </div>
                </div>

                {/* User Management */}
                <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-[#ecfdf5] flex items-center justify-center">
                            <Users size={20} className="text-[#10b981]" />
                        </div>
                        <h3 className="text-lg font-bold text-[#0f172a]">User Management</h3>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="block text-sm font-medium text-[#64748b] mb-1">
                                    Auto-approve Trainers
                                </label>
                                <p className="text-xs text-[#64748b]">Automatically approve new trainer accounts</p>
                            </div>
                            <button
                                onClick={() => handleSettingChange('auto_approve_trainers', !settings.auto_approve_trainers)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    settings.auto_approve_trainers ? 'bg-[#10b981]' : 'bg-[#cbd5e1]'
                                }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        settings.auto_approve_trainers ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <label className="block text-sm font-medium text-[#64748b] mb-1">
                                    Require Trainer Verification
                                </label>
                                <p className="text-xs text-[#64748b]">Trainers must be verified before booking</p>
                            </div>
                            <button
                                onClick={() => handleSettingChange('require_trainer_verification', !settings.require_trainer_verification)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    settings.require_trainer_verification ? 'bg-[#10b981]' : 'bg-[#cbd5e1]'
                                }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        settings.require_trainer_verification ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Booking Policies */}
                <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-[#dbeafe] flex items-center justify-center">
                            <Calendar size={20} className="text-[#2563eb]" />
                        </div>
                        <h3 className="text-lg font-bold text-[#0f172a]">Booking Policies</h3>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] mb-2">
                                Cancellation Policy (hours)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="168"
                                value={settings.cancellation_policy_hours}
                                onChange={(e) => handleSettingChange('cancellation_policy_hours', Number(e.target.value))}
                                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                            />
                            <p className="text-xs text-[#64748b] mt-1">Hours before booking when cancellation is allowed</p>
                        </div>
                    </div>
                </div>

                {/* Dispute Resolution */}
                <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 rounded-xl bg-[#fef3c7] flex items-center justify-center">
                            <Shield size={20} className="text-[#f59e0b]" />
                        </div>
                        <h3 className="text-lg font-bold text-[#0f172a]">Dispute Resolution</h3>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[#64748b] mb-2">
                                Dispute Resolution Timeframe (days)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="30"
                                value={settings.dispute_resolution_days}
                                onChange={(e) => handleSettingChange('dispute_resolution_days', Number(e.target.value))}
                                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                            />
                            <p className="text-xs text-[#64748b] mt-1">Days to resolve disputes before escalation</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* System Status */}
            <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-[#d1fae5] flex items-center justify-center">
                        <Globe size={20} className="text-[#10b981]" />
                    </div>
                    <h3 className="text-lg font-bold text-[#0f172a]">System Status</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-[#10b981] animate-pulse"></div>
                        <div>
                            <p className="font-medium text-[#0f172a]">Database</p>
                            <p className="text-sm text-[#64748b]">Connected</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-[#10b981] animate-pulse"></div>
                        <div>
                            <p className="font-medium text-[#0f172a]">API</p>
                            <p className="text-sm text-[#64748b]">Operational</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-[#10b981] animate-pulse"></div>
                        <div>
                            <p className="font-medium text-[#0f172a]">Storage</p>
                            <p className="text-sm text-[#64748b]">Available</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

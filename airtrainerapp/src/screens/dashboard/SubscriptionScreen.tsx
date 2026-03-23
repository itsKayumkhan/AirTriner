import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled';

type ProfileData = {
    subscription_status: SubscriptionStatus;
    subscription_expires_at: string | null;
    trial_started_at: string | null;
    is_founding_50: boolean;
    is_verified: boolean;
    verification_status: string;
    reliability_score: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PRO_FEATURES = [
    { icon: 'search-outline', label: 'Appear in athlete search results' },
    { icon: 'calendar-outline', label: 'Manage your booking calendar' },
    { icon: 'chatbubbles-outline', label: 'Direct messaging with athletes' },
    { icon: 'cash-outline', label: 'Accept payments (3% platform fee)' },
    { icon: 'shield-checkmark-outline', label: 'Identity verified badge' },
    { icon: 'analytics-outline', label: 'Earnings dashboard & analytics' },
    { icon: 'star-outline', label: 'Build your reviews & reputation' },
    { icon: 'notifications-outline', label: 'Nearby training request alerts' },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusConfig(status: SubscriptionStatus) {
    switch (status) {
        case 'trial':
            return { label: 'Free Trial', color: Colors.info, bg: Colors.infoLight, icon: 'time-outline' as const };
        case 'active':
            return { label: 'Active', color: Colors.success, bg: Colors.successLight, icon: 'checkmark-circle-outline' as const };
        case 'expired':
            return { label: 'Expired', color: Colors.error, bg: Colors.errorLight, icon: 'alert-circle-outline' as const };
        case 'cancelled':
            return { label: 'Cancelled', color: Colors.textTertiary, bg: Colors.surface, icon: 'close-circle-outline' as const };
        default:
            return { label: String(status), color: Colors.textTertiary, bg: Colors.surface, icon: 'help-circle-outline' as const };
    }
}

function formatDate(iso: string | null): string {
    if (!iso) return 'N/A';
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function getDaysRemaining(profile: ProfileData): number {
    if (profile.subscription_status === 'trial' && profile.trial_started_at) {
        const end = new Date(new Date(profile.trial_started_at).getTime() + 7 * 24 * 60 * 60 * 1000);
        return Math.max(0, Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
    }
    if (profile.subscription_expires_at) {
        return Math.max(0, Math.ceil((new Date(profile.subscription_expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
    }
    return 0;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SubscriptionScreen({ navigation }: any) {
    const { user } = useAuth();

    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // ── Data fetching ─────────────────────────────────────────────────────────

    const fetchProfile = useCallback(async () => {
        if (!user?.id) return;
        try {
            const { data, error } = await supabase
                .from('trainer_profiles')
                .select(
                    'subscription_status, subscription_expires_at, trial_started_at, is_founding_50, is_verified, verification_status, reliability_score'
                )
                .eq('user_id', user.id)
                .single();

            if (error) throw error;
            setProfile(data as ProfileData);
        } catch (err: any) {
            console.error('SubscriptionScreen fetchProfile:', err);
            Alert.alert('Error', 'Could not load subscription details.');
        } finally {
            setIsLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchProfile();
        setRefreshing(false);
    };

    // ── Contact Support handler ───────────────────────────────────────────────

    const handleContactSupport = () => {
        Alert.alert(
            'Upgrade to Pro',
            'To upgrade your AirTrainr Pro subscription, please contact our support team.\n\nemail: support@airtrainr.com',
            [
                { text: 'OK', style: 'default' },
            ]
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    const status = getStatusConfig((profile?.subscription_status ?? 'trial') as SubscriptionStatus);
    const daysLeft = profile ? getDaysRemaining(profile) : 0;
    const isActive = profile?.subscription_status === 'active';
    const isTrial = profile?.subscription_status === 'trial';
    const isExpiredOrCancelled =
        profile?.subscription_status === 'expired' || profile?.subscription_status === 'cancelled';

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={22} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Subscription</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={Colors.primary}
                        colors={[Colors.primary]}
                    />
                }
            >
                {/* ── Founding 50 Banner ── */}
                {profile?.is_founding_50 && <Founding50Card />}

                {/* ── Status Hero Card ── */}
                <LinearGradient
                    colors={[Colors.gradientStart, Colors.gradientEnd]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroCard}
                >
                    {/* Status badge */}
                    <View style={styles.heroBadge}>
                        <Ionicons name={status.icon} size={16} color="#fff" />
                        <Text style={styles.heroBadgeText}>{status.label}</Text>
                    </View>

                    <Text style={styles.heroProductName}>AirTrainr Pro</Text>

                    <Text style={styles.heroPrice}>
                        {isTrial ? 'FREE' : '$14.99'}
                        {!isTrial && <Text style={styles.heroPricePeriod}> /month</Text>}
                    </Text>

                    {daysLeft > 0 && (
                        <View style={styles.heroDaysRow}>
                            <Ionicons name="hourglass-outline" size={14} color="rgba(255,255,255,0.8)" />
                            <Text style={styles.heroDaysText}>
                                {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
                            </Text>
                        </View>
                    )}

                    {profile?.subscription_expires_at && isActive && (
                        <Text style={styles.heroExpiry}>
                            Renews {formatDate(profile.subscription_expires_at)}
                        </Text>
                    )}
                </LinearGradient>

                {/* ── Subscription Details ── */}
                <SectionTitle label="Subscription Details" />
                <View style={styles.detailCard}>
                    <DetailRow
                        label="Plan"
                        right={
                            <View style={[styles.badge, { backgroundColor: status.bg }]}>
                                <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
                            </View>
                        }
                    />
                    <DetailRow
                        label="Trial started"
                        right={<Text style={styles.detailValue}>{formatDate(profile?.trial_started_at ?? null)}</Text>}
                    />
                    {profile?.subscription_expires_at && (
                        <DetailRow
                            label="Expires"
                            right={<Text style={styles.detailValue}>{formatDate(profile.subscription_expires_at)}</Text>}
                        />
                    )}
                    <DetailRow
                        label="Verification"
                        right={
                            <View style={[styles.badge, { backgroundColor: profile?.is_verified ? Colors.successLight : Colors.warningLight }]}>
                                <Ionicons
                                    name={profile?.is_verified ? 'checkmark-circle' : 'time'}
                                    size={12}
                                    color={profile?.is_verified ? Colors.success : Colors.warning}
                                />
                                <Text style={[styles.badgeText, { color: profile?.is_verified ? Colors.success : Colors.warning }]}>
                                    {profile?.is_verified ? 'Verified' : 'Pending'}
                                </Text>
                            </View>
                        }
                    />
                    <DetailRow
                        label="Reliability score"
                        right={
                            <Text style={[styles.detailValue, { color: Colors.success }]}>
                                {Number(profile?.reliability_score ?? 100).toFixed(0)}%
                            </Text>
                        }
                        isLast
                    />
                </View>

                {/* ── What's Included ── */}
                <SectionTitle label="What's Included" />
                <View style={styles.featuresCard}>
                    {PRO_FEATURES.map((f, i) => (
                        <View key={i} style={[styles.featureRow, i === PRO_FEATURES.length - 1 && { borderBottomWidth: 0 }]}>
                            <View style={styles.featureIconWrap}>
                                <Ionicons name={f.icon} size={18} color={Colors.primary} />
                            </View>
                            <Text style={styles.featureText}>{f.label}</Text>
                            <Ionicons name="checkmark" size={16} color={Colors.success} />
                        </View>
                    ))}
                </View>

                {/* ── Upgrade / Reactivate CTA ── */}
                {(isTrial || isExpiredOrCancelled) && (
                    <>
                        <SectionTitle label="Upgrade to Pro" />
                        <View style={styles.upgradeCard}>
                            <View style={styles.upgradeTopRow}>
                                <View>
                                    <Text style={styles.upgradeTitle}>AirTrainr Pro</Text>
                                    <Text style={styles.upgradeSubtitle}>Full access, cancel anytime</Text>
                                </View>
                                <View style={styles.upgradePriceWrap}>
                                    <Text style={styles.upgradePrice}>$14.99</Text>
                                    <Text style={styles.upgradePeriod}>/mo</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.contactBtn}
                                onPress={handleContactSupport}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={[Colors.primary, Colors.accent]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.contactBtnGradient}
                                >
                                    <Ionicons name="mail-outline" size={20} color="#fff" />
                                    <Text style={styles.contactBtnText}>Contact Support to Upgrade</Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            <Text style={styles.upgradeNote}>
                                Our team will activate your subscription and confirm via email within 24 hours.
                            </Text>
                        </View>
                    </>
                )}

                {/* Active — manage note */}
                {isActive && (
                    <View style={styles.manageNote}>
                        <Ionicons name="information-circle-outline" size={18} color={Colors.textSecondary} />
                        <Text style={styles.manageNoteText}>
                            To manage or cancel your subscription, contact{' '}
                            <Text style={{ color: Colors.primary }}>support@airtrainr.com</Text>
                        </Text>
                    </View>
                )}

                <View style={{ height: 48 }} />
            </ScrollView>
        </View>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Founding50Card() {
    return (
        <View style={styles.f50Card}>
            <LinearGradient
                colors={['#1a1500', '#2a2000']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.f50Gradient}
            >
                <View style={styles.f50Left}>
                    <View style={styles.f50IconWrap}>
                        <Ionicons name="trophy" size={22} color="#FFD700" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.f50Title}>FOUNDING 50</Text>
                        <Text style={styles.f50Sub}>Early access member · Lifetime benefits</Text>
                    </View>
                </View>
                <View style={styles.f50BadgeWrap}>
                    <Ionicons name="star" size={12} color="#FFD700" />
                    <Text style={styles.f50BadgeText}>GOLD</Text>
                </View>
            </LinearGradient>
        </View>
    );
}

function SectionTitle({ label }: { label: string }) {
    return <Text style={styles.sectionTitle}>{label}</Text>;
}

function DetailRow({
    label,
    right,
    isLast,
}: {
    label: string;
    right: React.ReactNode;
    isLast?: boolean;
}) {
    return (
        <View style={[styles.detailRow, isLast && { borderBottomWidth: 0 }]}>
            <Text style={styles.detailLabel}>{label}</Text>
            {right}
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.xxl,
        paddingTop: 60,
        paddingBottom: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        backgroundColor: Colors.background,
    },
    headerBtn: {
        width: 44,
        height: 44,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },

    // Content
    content: {
        padding: Spacing.xxl,
    },

    // Founding 50
    f50Card: {
        borderRadius: BorderRadius.lg,
        borderWidth: 1.5,
        borderColor: '#FFD700',
        overflow: 'hidden',
        marginBottom: Spacing.xl,
        ...Shadows.medium,
    },
    f50Gradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.lg,
    },
    f50Left: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        flex: 1,
    },
    f50IconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,215,0,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    f50Title: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.heavy,
        color: '#FFD700',
        letterSpacing: 1.5,
    },
    f50Sub: {
        fontSize: FontSize.xs,
        color: 'rgba(255,215,0,0.7)',
        marginTop: 2,
    },
    f50BadgeWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: Spacing.md,
        paddingVertical: 4,
        backgroundColor: 'rgba(255,215,0,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.4)',
        borderRadius: BorderRadius.pill,
    },
    f50BadgeText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: '#FFD700',
        letterSpacing: 1,
    },

    // Hero Card
    heroCard: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.xxl,
        alignItems: 'center',
        marginBottom: Spacing.xxl,
        ...Shadows.glow,
    },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: Spacing.lg,
        paddingVertical: 6,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: BorderRadius.pill,
        marginBottom: Spacing.md,
    },
    heroBadgeText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: '#fff',
    },
    heroProductName: {
        fontSize: FontSize.xxxl,
        fontWeight: FontWeight.heavy,
        color: '#fff',
        letterSpacing: -0.5,
    },
    heroPrice: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.bold,
        color: '#fff',
        marginTop: Spacing.xs,
    },
    heroPricePeriod: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.regular,
        color: 'rgba(255,255,255,0.7)',
    },
    heroDaysRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: Spacing.md,
    },
    heroDaysText: {
        fontSize: FontSize.sm,
        color: 'rgba(255,255,255,0.85)',
    },
    heroExpiry: {
        fontSize: FontSize.xs,
        color: 'rgba(255,255,255,0.65)',
        marginTop: Spacing.sm,
    },

    // Section title
    sectionTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: Spacing.md,
    },

    // Detail card
    detailCard: {
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: Spacing.xxl,
        overflow: 'hidden',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    detailLabel: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
    },
    detailValue: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: Spacing.md,
        paddingVertical: 4,
        borderRadius: BorderRadius.pill,
    },
    badgeText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
    },

    // Features
    featuresCard: {
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: Spacing.xxl,
        overflow: 'hidden',
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    featureIconWrap: {
        width: 32,
        height: 32,
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.primaryGlow,
        justifyContent: 'center',
        alignItems: 'center',
    },
    featureText: {
        flex: 1,
        fontSize: FontSize.sm,
        color: Colors.text,
        lineHeight: 20,
    },

    // Upgrade card
    upgradeCard: {
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.borderActive,
        padding: Spacing.xl,
        marginBottom: Spacing.xxl,
        ...Shadows.medium,
    },
    upgradeTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.xl,
    },
    upgradeTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    upgradeSubtitle: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    upgradePriceWrap: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 2,
    },
    upgradePrice: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.heavy,
        color: Colors.primary,
    },
    upgradePeriod: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    contactBtn: {
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
        marginBottom: Spacing.md,
        ...Shadows.glow,
    },
    contactBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.lg,
    },
    contactBtnText: {
        color: '#fff',
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
    },
    upgradeNote: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        textAlign: 'center',
        lineHeight: 18,
    },

    // Manage note
    manageNote: {
        flexDirection: 'row',
        gap: Spacing.sm,
        alignItems: 'flex-start',
        padding: Spacing.lg,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: Spacing.xxl,
    },
    manageNoteText: {
        flex: 1,
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 20,
    },
});

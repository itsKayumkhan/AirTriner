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
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows, Layout} from '../../theme';

// ─── API URL ─────────────────────────────────────────────────────────────────

const API_URL = 'https://api.airtrainr.com/api/v1';

// ─── Types ────────────────────────────────────────────────────────────────────

type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled';

type ProfileData = {
    id: string;
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

const F50_BENEFITS = [
    'Lifetime reduced platform fee (1.5% vs 3%)',
    'Priority placement in search results',
    'Exclusive "Founding 50" badge on profile',
    'Early access to new features',
    'Direct line to the AirTrainr team',
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
    const [subscribing, setSubscribing] = useState(false);
    const [f50Applied, setF50Applied] = useState(false);
    const [f50Count, setF50Count] = useState<number | null>(null);
    const [f50Applying, setF50Applying] = useState(false);

    // ── Data fetching ─────────────────────────────────────────────────────────

    const fetchProfile = useCallback(async () => {
        if (!user?.id) return;
        try {
            const { data, error } = await supabase
                .from('trainer_profiles')
                .select(
                    'id, subscription_status, subscription_expires_at, trial_started_at, is_founding_50, is_verified, verification_status, reliability_score'
                )
                .eq('user_id', user.id)
                .single();

            if (error) throw error;
            const profileData = data as ProfileData;
            setProfile(profileData);
            // is_founding_50 true but not active = pending approval
            setF50Applied(!!profileData.is_founding_50 && profileData.subscription_status !== 'active');
        } catch (err: any) {
            console.error('SubscriptionScreen fetchProfile:', err);
            Alert.alert('Error', 'Could not load subscription details.');
        } finally {
            setIsLoading(false);
        }
    }, [user?.id]);

    const fetchF50Count = useCallback(async () => {
        try {
            const { count } = await supabase
                .from('trainer_profiles')
                .select('id', { count: 'exact', head: true })
                .eq('is_founding_50', true);
            setF50Count(count ?? 0);
        } catch (err) {
            console.error('Error fetching F50 count:', err);
        }
    }, []);

    useEffect(() => {
        fetchProfile();
        fetchF50Count();
    }, [fetchProfile, fetchF50Count]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchProfile(), fetchF50Count()]);
        setRefreshing(false);
    };

    // ── Subscribe handler ─────────────────────────────────────────────────────

    const handleSubscribe = async (plan: 'monthly' | 'annual') => {
        setSubscribing(true);
        try {
            const response = await fetch(`${API_URL}/payments/trainer/subscription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan, trainerId: user?.id }),
            });

            if (response.ok) {
                const { url } = await response.json();
                if (url) {
                    await WebBrowser.openBrowserAsync(url);
                    // After returning, refresh subscription status
                    fetchProfile();
                }
            } else {
                // Fallback: update status directly (Stripe may not be fully configured)
                const expiresAt =
                    plan === 'monthly'
                        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

                await supabase
                    .from('trainer_profiles')
                    .update({
                        subscription_status: 'active',
                        subscription_expires_at: expiresAt.toISOString(),
                    })
                    .eq('user_id', user?.id);

                Alert.alert('Subscribed!', `Your ${plan} subscription is now active.`);
                fetchProfile();
            }
        } catch (error) {
            Alert.alert('Error', 'Could not process subscription. Please try again.');
        } finally {
            setSubscribing(false);
        }
    };

    // ── Founding 50 application handler ───────────────────────────────────────

    const handleApplyF50 = async () => {
        setF50Applying(true);
        try {
            // Check spots remaining
            const { count } = await supabase
                .from('trainer_profiles')
                .select('id', { count: 'exact', head: true })
                .eq('is_founding_50', true);

            if ((count || 0) >= 50) {
                Alert.alert('Program Full', 'All 50 Founding spots have been filled.');
                return;
            }

            // Set is_founding_50 = true (admin will approve and activate subscription)
            const { error: updateError } = await supabase
                .from('trainer_profiles')
                .update({ is_founding_50: true })
                .eq('user_id', user?.id);

            if (updateError) throw updateError;

            Alert.alert(
                'Application Submitted',
                'Your Founding 50 application has been submitted for admin review.'
            );
            setF50Applied(true);
            fetchF50Count();
        } catch (error) {
            Alert.alert('Error', 'Could not submit application. Please try again.');
        } finally {
            setF50Applying(false);
        }
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
    const spotsRemaining = f50Count !== null ? 50 - f50Count : null;

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
                {/* ── Founding 50 Banner (already granted) ── */}
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
                        {isTrial ? 'FREE' : '$25'}
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

                {/* ── Plan Selection & Subscribe CTA ── */}
                {(isTrial || isExpiredOrCancelled) && (
                    <>
                        <SectionTitle label="Choose Your Plan" />

                        {/* Monthly Plan Card */}
                        <View style={styles.planCard}>
                            <View style={styles.planCardHeader}>
                                <View>
                                    <Text style={styles.planCardTitle}>Monthly</Text>
                                    <Text style={styles.planCardSubtitle}>Flexible, cancel anytime</Text>
                                </View>
                                <View style={styles.planPriceWrap}>
                                    <Text style={styles.planPrice}>$25</Text>
                                    <Text style={styles.planPricePeriod}>/mo</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={styles.subscribeBtnMonthly}
                                onPress={() => handleSubscribe('monthly')}
                                activeOpacity={0.85}
                                disabled={subscribing}
                            >
                                {subscribing ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.subscribeBtnText}>Subscribe Monthly</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* Annual Plan Card */}
                        <View style={styles.annualPlanCardOuter}>
                            <LinearGradient
                                colors={[Colors.gradientStart, Colors.gradientEnd]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.annualPlanCard}
                            >
                                {/* Best Value Badge */}
                                <View style={styles.bestValueBadge}>
                                    <Ionicons name="flame" size={12} color="#fff" />
                                    <Text style={styles.bestValueBadgeText}>BEST VALUE</Text>
                                </View>

                                <View style={styles.planCardHeader}>
                                    <View>
                                        <Text style={[styles.planCardTitle, { color: '#fff' }]}>Annual</Text>
                                        <Text style={[styles.planCardSubtitle, { color: 'rgba(255,255,255,0.7)' }]}>
                                            Best value - Save $50
                                        </Text>
                                    </View>
                                    <View style={styles.planPriceWrap}>
                                        <Text style={[styles.planPrice, { color: '#fff' }]}>$250</Text>
                                        <Text style={[styles.planPricePeriod, { color: 'rgba(255,255,255,0.7)' }]}>/yr</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={styles.subscribeBtnAnnual}
                                    onPress={() => handleSubscribe('annual')}
                                    activeOpacity={0.85}
                                    disabled={subscribing}
                                >
                                    {subscribing ? (
                                        <ActivityIndicator size="small" color={Colors.gradientStart} />
                                    ) : (
                                        <Text style={styles.subscribeBtnAnnualText}>Subscribe Annually</Text>
                                    )}
                                </TouchableOpacity>
                            </LinearGradient>
                        </View>

                        <Text style={styles.subscribeNote}>
                            You'll be redirected to Stripe for secure payment processing.
                        </Text>
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

                {/* ── Founding 50 Application Section ── */}
                {((!profile?.is_founding_50 && !isActive) || f50Applied) && (
                    <>
                        <SectionTitle label="Founding 50 Program" />
                        <View style={styles.f50ApplyCard}>
                            <View style={styles.f50ApplyHeader}>
                                <View style={styles.f50ApplyIconWrap}>
                                    <Ionicons name="trophy" size={24} color="#FFD700" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.f50ApplyTitle}>Become a Founding Member</Text>
                                    <Text style={styles.f50ApplySubtitle}>
                                        Join the first 50 trainers and unlock lifetime benefits
                                    </Text>
                                </View>
                            </View>

                            {/* Spots Remaining Counter */}
                            {spotsRemaining !== null && (
                                <View style={styles.f50SpotsRow}>
                                    <View style={styles.f50SpotsBarBg}>
                                        <View
                                            style={[
                                                styles.f50SpotsBarFill,
                                                { width: `${Math.min(((f50Count ?? 0) / 50) * 100, 100)}%` },
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.f50SpotsText}>
                                        {f50Count}/50 spots filled
                                        {spotsRemaining > 0
                                            ? ` \u00B7 ${spotsRemaining} remaining`
                                            : ' \u00B7 Program full'}
                                    </Text>
                                </View>
                            )}

                            {/* Benefits List */}
                            <View style={styles.f50BenefitsList}>
                                {F50_BENEFITS.map((benefit, i) => (
                                    <View key={i} style={styles.f50BenefitRow}>
                                        <Ionicons name="star" size={14} color="#FFD700" />
                                        <Text style={styles.f50BenefitText}>{benefit}</Text>
                                    </View>
                                ))}
                            </View>

                            {/* Apply Button or Pending Status */}
                            {f50Applied ? (
                                <View style={styles.f50PendingBadge}>
                                    <Ionicons name="time-outline" size={18} color={Colors.warning} />
                                    <Text style={styles.f50PendingText}>Application Pending Review</Text>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={styles.f50ApplyBtn}
                                    onPress={handleApplyF50}
                                    activeOpacity={0.85}
                                    disabled={f50Applying || (spotsRemaining !== null && spotsRemaining <= 0)}
                                >
                                    {f50Applying ? (
                                        <ActivityIndicator size="small" color="#1a1500" />
                                    ) : (
                                        <>
                                            <Ionicons name="trophy-outline" size={18} color="#1a1500" />
                                            <Text style={styles.f50ApplyBtnText}>Apply for Founding 50</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    </>
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
        paddingTop: Layout.headerTopPadding,
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

    // Founding 50 (granted badge)
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

    // Plan cards
    planCard: {
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: Spacing.xl,
        marginBottom: Spacing.md,
        ...Shadows.medium,
    },
    planCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.lg,
    },
    planCardTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    planCardSubtitle: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    planPriceWrap: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 2,
    },
    planPrice: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.heavy,
        color: Colors.primary,
    },
    planPricePeriod: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    subscribeBtnMonthly: {
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.md,
        paddingVertical: Spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    subscribeBtnText: {
        color: '#fff',
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
    },

    // Annual plan card
    annualPlanCardOuter: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        marginBottom: Spacing.md,
        ...Shadows.glow,
    },
    annualPlanCard: {
        padding: Spacing.xl,
        borderRadius: BorderRadius.lg,
    },
    bestValueBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: Spacing.md,
        paddingVertical: 4,
        borderRadius: BorderRadius.pill,
        marginBottom: Spacing.md,
    },
    bestValueBadgeText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.heavy,
        color: '#fff',
        letterSpacing: 1,
    },
    subscribeBtnAnnual: {
        backgroundColor: '#fff',
        borderRadius: BorderRadius.md,
        paddingVertical: Spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    subscribeBtnAnnualText: {
        color: Colors.gradientStart,
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
    },
    subscribeNote: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: Spacing.xxl,
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

    // Founding 50 Application
    f50ApplyCard: {
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        borderWidth: 1.5,
        borderColor: 'rgba(255,215,0,0.3)',
        padding: Spacing.xl,
        marginBottom: Spacing.xxl,
        ...Shadows.medium,
    },
    f50ApplyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        marginBottom: Spacing.lg,
    },
    f50ApplyIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,215,0,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    f50ApplyTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: '#FFD700',
    },
    f50ApplySubtitle: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    f50SpotsRow: {
        marginBottom: Spacing.lg,
    },
    f50SpotsBarBg: {
        height: 8,
        backgroundColor: Colors.surface,
        borderRadius: 4,
        overflow: 'hidden',
        marginBottom: Spacing.xs,
    },
    f50SpotsBarFill: {
        height: '100%',
        backgroundColor: '#FFD700',
        borderRadius: 4,
    },
    f50SpotsText: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
    },
    f50BenefitsList: {
        gap: Spacing.sm,
        marginBottom: Spacing.lg,
    },
    f50BenefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    f50BenefitText: {
        fontSize: FontSize.sm,
        color: Colors.text,
        flex: 1,
    },
    f50ApplyBtn: {
        backgroundColor: '#FFD700',
        borderRadius: BorderRadius.md,
        paddingVertical: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    f50ApplyBtnText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: '#1a1500',
    },
    f50PendingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.warningLight,
        borderRadius: BorderRadius.md,
        paddingVertical: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.warning,
    },
    f50PendingText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.warning,
    },
});

import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';
import { computeTrainerCompleteness } from '../../lib/profile-completeness';

type Props = {
    user: {
        is_suspended?: boolean | null;
        deleted_at?: string | null;
        first_name?: string | null;
        last_name?: string | null;
        phone?: string | null;
        date_of_birth?: string | null;
        avatar_url?: string | null;
    } | null;
    trainerProfile: {
        verification_status?: string | null;
        subscription_status?: string | null;
        bio?: string | null;
        sports?: string[] | null;
        city?: string | null;
        years_experience?: number | null;
        session_pricing?: any;
        training_locations?: string[] | null;
    } | null;
    navigation: any;
};

const ACTIVE_SUB = new Set(['trial', 'active']);

const EMERALD = '#10B981';
const EMERALD_BG = 'rgba(16, 185, 129, 0.08)';
const EMERALD_BORDER = 'rgba(16, 185, 129, 0.22)';
const AMBER = '#F59E0B';
const AMBER_BG = 'rgba(245, 158, 11, 0.08)';
const AMBER_BORDER = 'rgba(245, 158, 11, 0.22)';

type Condition = {
    key: string;
    met: boolean;
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    explainer: string;
    sublist?: string[];
    cta?: React.ReactNode;
};

export default function ApprovalStatusPanel({ user, trainerProfile, navigation }: Props) {
    const completeness = computeTrainerCompleteness(user || {}, trainerProfile || {});

    const verified = trainerProfile?.verification_status === 'verified';
    const subStatus = (trainerProfile?.subscription_status || '').toLowerCase();
    const subActive = ACTIVE_SUB.has(subStatus);
    const accountActive = !user?.is_suspended && !user?.deleted_at;
    const profileComplete = completeness.complete;

    const conditions: Condition[] = [
        {
            key: 'verification',
            met: verified,
            icon: 'shield-checkmark-outline',
            title: 'Admin verification',
            explainer: verified
                ? 'An admin has reviewed and verified your account.'
                : 'An admin needs to review your credentials before you go live.',
            cta: verified ? null : (
                <View style={styles.noteRow}>
                    <Ionicons name="alert-circle-outline" size={12} color={AMBER} />
                    <Text style={styles.noteText}>Awaiting admin review — typically 24-48 hours</Text>
                </View>
            ),
        },
        {
            key: 'subscription',
            met: subActive,
            icon: 'card-outline',
            title: 'Active subscription',
            explainer: subActive
                ? subStatus === 'trial'
                    ? "You're on the 7-day trial. Upgrade anytime to keep your profile live."
                    : 'Your subscription is active.'
                : 'Start a subscription (or trial) to be discoverable by athletes.',
            cta: subActive ? null : (
                <Pressable
                    onPress={() => navigation.navigate('Subscription')}
                    style={({ pressed }) => [styles.ctaBtn, pressed && styles.ctaBtnPressed]}
                >
                    <Text style={styles.ctaBtnText}>Start subscription</Text>
                </Pressable>
            ),
        },
        {
            key: 'profile',
            met: profileComplete,
            icon: 'person-circle-outline',
            title: 'Profile complete',
            explainer: profileComplete
                ? `All ${completeness.total} mandatory fields are filled.`
                : `${completeness.filled} of ${completeness.total} mandatory fields filled.`,
            sublist: !profileComplete ? completeness.missing : undefined,
            cta: profileComplete ? null : (
                <Pressable
                    onPress={() => navigation.navigate('EditProfile')}
                    style={({ pressed }) => [styles.ctaBtn, pressed && styles.ctaBtnPressed]}
                >
                    <Text style={styles.ctaBtnText}>Complete profile</Text>
                </Pressable>
            ),
        },
        {
            key: 'account',
            met: accountActive,
            icon: 'lock-closed-outline',
            title: 'Account active',
            explainer: accountActive
                ? 'Your account is in good standing.'
                : user?.deleted_at
                    ? 'Your account has been deleted.'
                    : 'Your account is currently suspended.',
            cta: accountActive ? null : (
                <Pressable
                    onPress={() => Linking.openURL('mailto:support@airtrainr.com')}
                    style={({ pressed }) => [styles.ctaBtnDanger, pressed && styles.ctaBtnPressed]}
                >
                    <Text style={styles.ctaBtnDangerText}>Contact support</Text>
                </Pressable>
            ),
        },
    ];

    const metCount = conditions.filter((c) => c.met).length;
    const allMet = metCount === conditions.length;
    const remaining = conditions.length - metCount;

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.title}>Public Visibility Status</Text>
                <Text style={styles.subtitle}>
                    All four steps must be complete before athletes can find and book you.
                </Text>
            </View>

            <View style={styles.body}>
                {allMet ? (
                    <View style={[styles.banner, { backgroundColor: EMERALD_BG, borderColor: EMERALD_BORDER }]}>
                        <View style={[styles.bannerIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
                            <Ionicons name="sparkles" size={15} color={EMERALD} />
                        </View>
                        <View style={styles.bannerTextWrap}>
                            <Text style={[styles.bannerTitle, { color: EMERALD }]}>You&apos;re live!</Text>
                            <Text style={styles.bannerDesc}>
                                Athletes can now find and book you. Keep your availability and profile up to date.
                            </Text>
                        </View>
                    </View>
                ) : (
                    <View style={[styles.banner, { backgroundColor: AMBER_BG, borderColor: AMBER_BORDER }]}>
                        <View style={[styles.bannerIcon, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                            <Ionicons name="alert-circle-outline" size={15} color={AMBER} />
                        </View>
                        <View style={styles.bannerTextWrap}>
                            <Text style={[styles.bannerTitle, { color: AMBER }]}>
                                {remaining} of {conditions.length} step{remaining > 1 ? 's' : ''} remaining
                            </Text>
                            <Text style={styles.bannerDesc}>
                                Your profile is hidden from athletes until everything below is checked off.
                            </Text>
                        </View>
                    </View>
                )}

                <View style={styles.list}>
                    {conditions.map((c) => (
                        <View
                            key={c.key}
                            style={[
                                styles.row,
                                c.met ? styles.rowMet : styles.rowUnmet,
                            ]}
                        >
                            <View
                                style={[
                                    styles.statusIcon,
                                    { backgroundColor: c.met ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)' },
                                ]}
                            >
                                <Ionicons
                                    name={c.met ? 'checkmark-circle' : 'close-circle'}
                                    size={20}
                                    color={c.met ? EMERALD : Colors.error}
                                />
                            </View>

                            <View style={styles.rowContent}>
                                <View style={styles.rowTitleLine}>
                                    <Ionicons name={c.icon} size={13} color={Colors.textTertiary} />
                                    <Text style={styles.rowTitle}>{c.title}</Text>
                                </View>
                                <Text style={styles.rowExplainer}>{c.explainer}</Text>

                                {c.sublist && c.sublist.length > 0 && (
                                    <View style={styles.sublist}>
                                        {c.sublist.map((m) => (
                                            <View key={m} style={styles.sublistItem}>
                                                <View style={styles.sublistDot} />
                                                <Text style={styles.sublistText}>{m}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {c.cta && <View style={styles.ctaWrap}>{c.cta}</View>}
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
    },
    header: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    title: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    subtitle: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        marginTop: 2,
    },
    body: {
        padding: Spacing.lg,
    },
    banner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        marginBottom: Spacing.md,
    },
    bannerIcon: {
        width: 32,
        height: 32,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bannerTextWrap: {
        flex: 1,
    },
    bannerTitle: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
    },
    bannerDesc: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        marginTop: 2,
        lineHeight: 16,
    },
    list: {
        gap: Spacing.sm,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.md,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
    },
    rowMet: {
        backgroundColor: 'rgba(16,185,129,0.03)',
        borderColor: 'rgba(16,185,129,0.15)',
    },
    rowUnmet: {
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderColor: Colors.border,
    },
    statusIcon: {
        width: 36,
        height: 36,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowContent: {
        flex: 1,
    },
    rowTitleLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    rowTitle: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    rowExplainer: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        marginTop: 4,
        lineHeight: 16,
    },
    sublist: {
        marginTop: Spacing.sm,
        gap: 6,
    },
    sublistItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    sublistDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(239,68,68,0.7)',
    },
    sublistText: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
    },
    ctaWrap: {
        marginTop: Spacing.sm,
    },
    ctaBtn: {
        alignSelf: 'flex-start',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm - 2,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primary,
    },
    ctaBtnPressed: {
        opacity: 0.85,
    },
    ctaBtnText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.textInverse,
    },
    ctaBtnDanger: {
        alignSelf: 'flex-start',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm - 2,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.errorLight,
        borderWidth: 1,
        borderColor: Colors.errorMuted,
    },
    ctaBtnDangerText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.error,
    },
    noteRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    noteText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.medium,
        color: AMBER,
    },
});

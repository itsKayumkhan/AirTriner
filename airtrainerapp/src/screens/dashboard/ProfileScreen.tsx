import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';
import { formatSportName } from '../../lib/format';
import { detectCountry, miToKm, radiusUnit } from '../../lib/units';
import {
    ScreenWrapper, Card, Button, Avatar, Badge,
    ListItem, SectionHeader, Divider,
} from '../../components/ui';

// ── Quick action definition ──
interface QuickAction {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    screen: string;
}

const QUICK_ACTIONS: QuickAction[] = [
    { icon: 'person-outline', label: 'Edit Profile', screen: 'EditProfile' },
    { icon: 'notifications-outline', label: 'Notifications', screen: 'Notifications' },
    { icon: 'card-outline', label: 'Payments', screen: 'PaymentMethods' },
    { icon: 'help-circle-outline', label: 'Help', screen: 'HelpCenter' },
];

// ── Skill level progress mapping ──
const SKILL_PROGRESS: Record<string, number> = {
    beginner: 0.25,
    intermediate: 0.5,
    advanced: 0.75,
    elite: 1.0,
};

// ── Sport tag colors (cycle) ──
const TAG_COLORS = [
    { bg: 'rgba(69, 208, 255, 0.14)', text: Colors.primary },
    { bg: 'rgba(16, 185, 129, 0.14)', text: Colors.success },
    { bg: 'rgba(245, 158, 11, 0.14)', text: Colors.warning },
    { bg: 'rgba(59, 130, 246, 0.14)', text: Colors.info },
    { bg: 'rgba(108, 92, 231, 0.14)', text: '#a29bfe' },
    { bg: 'rgba(253, 203, 110, 0.14)', text: '#fdcb6e' },
];

export default function ProfileScreen({ navigation }: any) {
    const { user, logout, refreshUser } = useAuth();
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            refreshUser();
        });
        return unsubscribe;
    }, [navigation, refreshUser]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await refreshUser();
        setRefreshing(false);
    }, [refreshUser]);

    const handleLogout = () => {
        const { Alert } = require('react-native');
        Alert.alert('Logout', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: logout },
        ]);
    };

    const isTrainer = user?.role === 'trainer';
    const tp = user?.trainerProfile;
    const ap = user?.athleteProfile;
    const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();

    // ── Menu sections (same logic, reorganized for cards) ──
    const menuSections = [
        {
            title: 'Account',
            items: [
                { icon: 'person-outline' as const, label: 'Edit Profile', screen: 'EditProfile' },
                { icon: 'notifications-outline' as const, label: 'Notifications', screen: 'Notifications' },
                ...(!isTrainer ? [
                    { icon: 'people-outline' as const, label: 'Sub-Accounts', screen: 'SubAccounts', badge: '0/6' },
                ] : []),
                { icon: 'card-outline' as const, label: 'Payment Methods', screen: 'PaymentMethods' },
            ],
        },
        ...(isTrainer ? [{
            title: 'Trainer Tools',
            items: [
                { icon: 'calendar-outline' as const, label: 'Availability', screen: 'Availability' },
                { icon: 'wallet-outline' as const, label: 'Earnings', screen: 'Earnings' },
                { icon: 'star-outline' as const, label: 'Reviews', screen: 'Reviews' },
                { icon: 'diamond-outline' as const, label: 'Subscription', screen: 'Subscription', badgeLabel: tp?.subscription_status === 'trial' ? 'Trial' : tp?.subscription_status === 'active' ? 'Active' : undefined },
                { icon: 'shield-checkmark-outline' as const, label: 'Verification', screen: 'Verification', badgeLabel: tp?.is_verified ? 'Verified' : 'Pending' },
                { icon: 'document-text-outline' as const, label: 'Certifications', screen: 'Certifications' },
            ],
        }] : [{
            title: 'Training',
            items: [
                { icon: 'star-outline' as const, label: 'My Reviews', screen: 'Reviews' },
                { icon: 'trophy-outline' as const, label: 'Training History', screen: 'TrainingHistory' },
            ],
        }]),
        {
            title: 'Preferences',
            items: [
                { icon: 'notifications-outline' as const, label: 'Push Notifications', toggle: true as const },
                { icon: 'moon-outline' as const, label: 'Dark Mode', info: 'Enabled' },
                { icon: 'globe-outline' as const, label: 'Language', info: 'English' },
            ],
        },
        {
            title: 'Support',
            items: [
                { icon: 'help-circle-outline' as const, label: 'Help Center', screen: 'HelpCenter' },
                { icon: 'chatbubble-ellipses-outline' as const, label: 'Contact Support', screen: 'Support' },
                { icon: 'document-text-outline' as const, label: 'Terms of Service', screen: 'Terms' },
                { icon: 'shield-outline' as const, label: 'Privacy Policy', screen: 'Privacy' },
            ],
        },
    ];

    // Stagger delay helper
    let sectionIndex = 0;
    const nextDelay = () => (sectionIndex++) * 100;

    return (
        <ScreenWrapper refreshing={refreshing} onRefresh={handleRefresh}>

            {/* ─────────────────────────────────────────────
                1. HERO PROFILE SECTION
            ───────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(nextDelay()).duration(250)}>
                <View style={styles.heroSection}>
                    {/* Avatar with glow ring */}
                    <View style={[styles.avatarGlow, Shadows.glow]}>
                        <Avatar
                            uri={user?.avatarUrl}
                            name={fullName}
                            size={100}
                            borderColor={Colors.primary}
                        />
                    </View>

                    {/* Name */}
                    <Text style={styles.heroName}>{fullName || 'User'}</Text>

                    {/* Email */}
                    <Text style={styles.heroEmail}>{user?.email}</Text>

                    {/* Role badge with dot */}
                    <Badge
                        label={isTrainer ? 'Trainer' : 'Athlete'}
                        color={Colors.primary}
                        bgColor={Colors.primaryGlow}
                        size="md"
                        dot
                        style={{ marginTop: Spacing.sm, alignSelf: 'center' }}
                    />

                    {/* Trainer stats bar */}
                    {isTrainer && tp && (
                        <View style={styles.statsGlassCard}>
                            <View style={styles.statsRow}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statNumber}>{tp.total_sessions || 0}</Text>
                                    <Text style={styles.statLabel}>Sessions</Text>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statItem}>
                                    <Text style={styles.statNumber}>
                                        {tp.average_rating ? Number(tp.average_rating).toFixed(1) : 'N/A'}
                                    </Text>
                                    <Text style={styles.statLabel}>Rating</Text>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statItem}>
                                    <Text style={styles.statNumber}>{tp.sports?.length || 0}</Text>
                                    <Text style={styles.statLabel}>Sports</Text>
                                </View>
                            </View>
                        </View>
                    )}
                </View>
            </Animated.View>

            {/* ─────────────────────────────────────────────
                2. QUICK ACTIONS ROW
            ───────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(nextDelay()).duration(250)}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.quickActionsContainer}
                >
                    {QUICK_ACTIONS.map((action) => (
                        <Pressable
                            key={action.label}
                            style={({ pressed }) => [
                                styles.quickActionButton,
                                pressed && styles.quickActionPressed,
                            ]}
                            onPress={() => navigation.navigate(action.screen)}
                            accessibilityLabel={action.label}
                            accessibilityRole="button"
                        >
                            <View style={styles.quickActionCircle}>
                                <Ionicons name={action.icon} size={24} color={Colors.primary} />
                            </View>
                            <Text style={styles.quickActionLabel}>{action.label}</Text>
                        </Pressable>
                    ))}
                </ScrollView>
            </Animated.View>

            {/* ─────────────────────────────────────────────
                3. DETAILS CARD
            ───────────────────────────────────────────── */}
            {isTrainer && tp && (
                <Animated.View entering={FadeInDown.delay(nextDelay()).duration(250)}>
                    <Card style={styles.detailsCard}>
                        {/* Headline */}
                        {tp.headline && (
                            <Text style={styles.detailHeadline}>"{tp.headline}"</Text>
                        )}

                        {/* Hourly rate — big styled number */}
                        <View style={styles.rateRow}>
                            <Text style={styles.rateDollar}>$</Text>
                            <Text style={styles.rateNumber}>{Number(tp.hourly_rate || 0).toFixed(0)}</Text>
                            <Text style={styles.rateUnit}>/hr</Text>
                        </View>

                        {/* Location */}
                        {(tp.city || tp.state) && (
                            <View style={styles.detailRow}>
                                <Ionicons name="location-outline" size={18} color={Colors.primary} />
                                <Text style={styles.detailText}>
                                    {tp.city || ''}{tp.state ? `, ${tp.state}` : ''}
                                </Text>
                            </View>
                        )}

                        {/* Verification status */}
                        <View style={styles.detailRow}>
                            <View style={[
                                styles.verificationDot,
                                { backgroundColor: tp.is_verified ? Colors.success : Colors.warning },
                            ]} />
                            <Text style={[
                                styles.detailText,
                                { color: tp.is_verified ? Colors.success : Colors.warning },
                            ]}>
                                {tp.is_verified ? 'Verified Trainer' : 'Verification Pending'}
                            </Text>
                        </View>

                        {/* Sports tags */}
                        {tp.sports && tp.sports.length > 0 && (
                            <View style={styles.tagsRow}>
                                {tp.sports.map((sport: string, i: number) => {
                                    const color = TAG_COLORS[i % TAG_COLORS.length];
                                    return (
                                        <View key={sport} style={[styles.tag, { backgroundColor: color.bg }]}>
                                            <Text style={[styles.tagText, { color: color.text }]}>
                                                {formatSportName(sport)}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </Card>
                </Animated.View>
            )}

            {!isTrainer && ap && (
                <Animated.View entering={FadeInDown.delay(nextDelay()).duration(250)}>
                    <Card style={styles.detailsCard}>
                        {/* Skill level as progress indicator */}
                        {ap.skill_level && (
                            <View style={styles.skillBlock}>
                                <View style={styles.skillLabelRow}>
                                    <Text style={styles.skillLabel}>Skill Level</Text>
                                    <Text style={styles.skillValue}>
                                        {ap.skill_level.charAt(0).toUpperCase() + ap.skill_level.slice(1)}
                                    </Text>
                                </View>
                                <View style={styles.skillBarBg}>
                                    <View style={[
                                        styles.skillBarFill,
                                        { width: `${(SKILL_PROGRESS[ap.skill_level] || 0.5) * 100}%` },
                                    ]} />
                                </View>
                            </View>
                        )}

                        {/* Location */}
                        {(ap.city || ap.state) && (
                            <View style={styles.detailRow}>
                                <Ionicons name="location-outline" size={18} color={Colors.primary} />
                                <Text style={styles.detailText}>
                                    {ap.city || ''}{ap.state ? `, ${ap.state}` : ''}
                                </Text>
                            </View>
                        )}

                        {/* Travel radius — show km for Canadian postal codes */}
                        {ap.travel_radius_miles > 0 && (() => {
                            const country = detectCountry(ap.zip_code || '');
                            const unit = radiusUnit(country);
                            const displayValue = country === 'CA'
                                ? Math.round(miToKm(ap.travel_radius_miles))
                                : ap.travel_radius_miles;
                            return (
                                <View style={styles.detailRow}>
                                    <Ionicons name="navigate-outline" size={18} color={Colors.primary} />
                                    <Text style={styles.detailText}>
                                        Travel Radius: <Text style={{ fontWeight: FontWeight.semibold, color: Colors.text }}>{displayValue} {unit}</Text>
                                    </Text>
                                </View>
                            );
                        })()}

                        {/* Preferred times as tags */}
                        {ap.preferredTrainingTimes && ap.preferredTrainingTimes.length > 0 && (
                            <>
                                <Text style={styles.detailSectionLabel}>Preferred Times</Text>
                                <View style={styles.tagsRow}>
                                    {ap.preferredTrainingTimes.map((time: string) => (
                                        <View key={time} style={[styles.tag, { backgroundColor: Colors.infoLight }]}>
                                            <Text style={[styles.tagText, { color: Colors.info }]}>
                                                {formatSportName(time)}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </>
                        )}

                        {/* Sports tags */}
                        {ap.sports && ap.sports.length > 0 && (
                            <>
                                <Text style={styles.detailSectionLabel}>Sports</Text>
                                <View style={styles.tagsRow}>
                                    {ap.sports.map((sport: string, i: number) => {
                                        const color = TAG_COLORS[i % TAG_COLORS.length];
                                        return (
                                            <View key={sport} style={[styles.tag, { backgroundColor: color.bg }]}>
                                                <Text style={[styles.tagText, { color: color.text }]}>
                                                    {formatSportName(sport)}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            </>
                        )}

                        {/* Training preferences */}
                        {ap.trainingPreferences && ap.trainingPreferences.length > 0 && (
                            <>
                                <Text style={styles.detailSectionLabel}>Training Style</Text>
                                <View style={styles.tagsRow}>
                                    {ap.trainingPreferences.map((pref: string) => (
                                        <View key={pref} style={[styles.tag, { backgroundColor: Colors.successLight }]}>
                                            <Text style={[styles.tagText, { color: Colors.success }]}>
                                                {formatSportName(pref)}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </>
                        )}
                    </Card>
                </Animated.View>
            )}

            {/* ─────────────────────────────────────────────
                4. MENU SECTIONS (grouped cards)
            ───────────────────────────────────────────── */}
            {menuSections.map((section) => (
                <Animated.View
                    key={section.title}
                    entering={FadeInDown.delay(nextDelay()).duration(250)}
                    style={styles.menuSection}
                >
                    <SectionHeader title={section.title} />
                    <Card noPadding>
                        {section.items.map((item, index) => {
                            const isLast = index === section.items.length - 1;

                            if ('toggle' in item && item.toggle) {
                                return (
                                    <Pressable
                                        key={item.label}
                                        style={({ pressed }) => [
                                            styles.menuItem,
                                            !isLast && styles.menuItemBorder,
                                            pressed && styles.menuItemPressed,
                                        ]}
                                        accessibilityLabel={item.label}
                                        accessibilityRole="switch"
                                    >
                                        <View style={[styles.menuIconCircle, { backgroundColor: Colors.primaryMuted }]}>
                                            <Ionicons name={item.icon as any} size={18} color={Colors.primary} />
                                        </View>
                                        <Text style={styles.menuLabel}>{item.label}</Text>
                                        <Switch
                                            value={notificationsEnabled}
                                            onValueChange={setNotificationsEnabled}
                                            trackColor={{ false: Colors.glass, true: Colors.primaryMuted }}
                                            thumbColor={notificationsEnabled ? Colors.primary : Colors.textTertiary}
                                        />
                                    </Pressable>
                                );
                            }

                            const hasScreen = 'screen' in item;
                            const hasInfo = 'info' in item;

                            return (
                                <Pressable
                                    key={item.label}
                                    style={({ pressed }) => [
                                        styles.menuItem,
                                        !isLast && styles.menuItemBorder,
                                        pressed && hasScreen && styles.menuItemPressed,
                                    ]}
                                    onPress={hasScreen ? () => navigation.navigate((item as any).screen) : undefined}
                                    accessibilityLabel={item.label}
                                    accessibilityRole="button"
                                    disabled={!hasScreen}
                                >
                                    <View style={[styles.menuIconCircle, { backgroundColor: Colors.primaryMuted }]}>
                                        <Ionicons name={item.icon as any} size={18} color={Colors.primary} />
                                    </View>
                                    <Text style={styles.menuLabel}>{item.label}</Text>
                                    {hasInfo && (
                                        <Text style={styles.menuInfoText}>{(item as any).info}</Text>
                                    )}
                                    {'badge' in item && (
                                        <View style={styles.menuBadge}>
                                            <Text style={styles.menuBadgeText}>{(item as any).badge}</Text>
                                        </View>
                                    )}
                                    {'badgeLabel' in item && (item as any).badgeLabel && (
                                        <Badge
                                            label={(item as any).badgeLabel}
                                            color={
                                                (item as any).badgeLabel === 'Verified' || (item as any).badgeLabel === 'Active'
                                                    ? Colors.success
                                                    : Colors.warning
                                            }
                                            size="sm"
                                            style={{ marginRight: Spacing.xs }}
                                        />
                                    )}
                                    {(hasScreen || (!hasInfo && !('toggle' in item))) && (
                                        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                                    )}
                                </Pressable>
                            );
                        })}
                    </Card>
                </Animated.View>
            ))}

            {/* ─────────────────────────────────────────────
                5. LOGOUT + VERSION
            ───────────────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(nextDelay()).duration(250)}>
                <View style={styles.logoutSection}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.logoutButton,
                            pressed && styles.logoutButtonPressed,
                        ]}
                        onPress={handleLogout}
                        accessibilityLabel="Log Out"
                        accessibilityRole="button"
                    >
                        <Ionicons name="log-out-outline" size={20} color={Colors.error} />
                        <Text style={styles.logoutText}>Log Out</Text>
                    </Pressable>
                </View>

                <Text style={styles.versionText}>AirTrainr v1.0.0</Text>
            </Animated.View>
        </ScreenWrapper>
    );
}

// ── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
    // ── 1. Hero section ──
    heroSection: {
        alignItems: 'center',
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.xxl,
        marginBottom: Spacing.md,
        position: 'relative',
        overflow: 'hidden',
    },
    heroGradient: {
        position: 'absolute',
        top: 0,
        left: -Spacing.xl,
        right: -Spacing.xl,
        height: 120,
    },
    avatarGlow: {
        borderRadius: 56,
        padding: 3,
        backgroundColor: Colors.primaryGlow,
        marginBottom: Spacing.lg,
    },
    heroName: {
        fontSize: 28,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        textAlign: 'center',
        marginBottom: 2,
    },
    heroEmail: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginBottom: Spacing.xs,
    },

    // ── Trainer stats glass card ──
    statsGlassCard: {
        marginTop: Spacing.xl,
        width: '100%',
        backgroundColor: Colors.glass,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.lg,
        paddingHorizontal: Spacing.md,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statNumber: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    statLabel: {
        fontSize: FontSize.xxs,
        color: Colors.textTertiary,
        marginTop: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statDivider: {
        width: 1,
        height: 32,
        backgroundColor: Colors.glassBorder,
    },

    // ── 2. Quick actions ──
    quickActionsContainer: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xs,
        gap: Spacing.xl,
    },
    quickActionButton: {
        alignItems: 'center',
        width: 72,
    },
    quickActionPressed: {
        opacity: 0.7,
    },
    quickActionCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.glass,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    quickActionLabel: {
        fontSize: FontSize.xxs,
        color: Colors.textSecondary,
        textAlign: 'center',
        fontWeight: FontWeight.medium,
    },

    // ── 3. Details card ──
    detailsCard: {
        marginTop: Spacing.lg,
        marginBottom: Spacing.md,
    },
    detailHeadline: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        fontStyle: 'italic',
        marginBottom: Spacing.lg,
        textAlign: 'center',
    },
    rateRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        marginBottom: Spacing.lg,
    },
    rateDollar: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.semibold,
        color: Colors.primary,
    },
    rateNumber: {
        fontSize: FontSize.hero,
        fontWeight: FontWeight.heavy,
        color: Colors.text,
    },
    rateUnit: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.medium,
        color: Colors.textTertiary,
        marginLeft: 2,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    detailText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    verificationDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    detailSectionLabel: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
        color: Colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
    },
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    tag: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.pill,
    },
    tagText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.medium,
        textTransform: 'capitalize',
    },

    // ── Skill bar (athlete) ──
    skillBlock: {
        marginBottom: Spacing.lg,
    },
    skillLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    skillLabel: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    skillValue: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },
    skillBarBg: {
        height: 6,
        borderRadius: 3,
        backgroundColor: Colors.glass,
        overflow: 'hidden',
    },
    skillBarFill: {
        height: 6,
        borderRadius: 3,
        backgroundColor: Colors.primary,
    },

    // ── 4. Menu sections ──
    menuSection: {
        marginTop: Spacing.lg,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        minHeight: 52,
    },
    menuItemBorder: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    menuItemPressed: {
        backgroundColor: Colors.glass,
    },
    menuIconCircle: {
        width: 34,
        height: 34,
        borderRadius: BorderRadius.sm,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    menuLabel: {
        flex: 1,
        fontSize: FontSize.md,
        fontWeight: FontWeight.medium,
        color: Colors.text,
    },
    menuInfoText: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
        marginRight: Spacing.sm,
    },
    menuBadge: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: Colors.error,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
        marginRight: Spacing.sm,
    },
    menuBadgeText: {
        fontSize: FontSize.xxs,
        fontWeight: FontWeight.bold,
        color: '#fff',
    },

    // ── 5. Logout + version ──
    logoutSection: {
        marginTop: Spacing.xxxl,
        alignItems: 'center',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        height: 50,
        width: '100%',
        borderRadius: BorderRadius.md,
        borderWidth: 1.5,
        borderColor: Colors.error,
        backgroundColor: 'transparent',
    },
    logoutButtonPressed: {
        backgroundColor: Colors.errorMuted,
    },
    logoutText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.error,
    },
    versionText: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        textAlign: 'center',
        marginTop: Spacing.xl,
        marginBottom: Spacing.md,
    },
});

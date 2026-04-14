import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    ScrollView,
    Alert,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../theme';
import { Avatar, Badge, Divider } from './ui';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface MenuItem {
    label: string;
    icon: IoniconsName;
    screen: string;
    roles: ('athlete' | 'trainer' | 'admin')[];
    badge?: number;
}

interface MenuSection {
    title: string;
    items: MenuItem[];
}

export default function CustomDrawerContent(props: any) {
    const { user, logout } = useAuth();
    const { navigation, state } = props;
    const role = user?.role || 'athlete';

    // Determine the active screen from navigation state
    const activeRoute = state?.routes?.[state?.index]?.name || '';

    const menuSections: MenuSection[] = [
        {
            title: 'Main',
            items: [
                { label: 'Dashboard', icon: 'home-outline', screen: 'Dashboard', roles: ['athlete', 'trainer', 'admin'] },
                { label: 'Discover Trainers', icon: 'compass-outline', screen: 'Discover', roles: ['athlete'] },
                { label: 'Bookings', icon: 'calendar-outline', screen: 'Bookings', roles: ['athlete', 'trainer', 'admin'] },
                { label: 'Messages', icon: 'chatbubbles-outline', screen: 'Messages', roles: ['athlete', 'trainer', 'admin'] },
            ],
        },
        {
            title: 'Account',
            items: [
                { label: 'Profile', icon: 'person-outline', screen: 'Profile', roles: ['athlete', 'trainer', 'admin'] },
                { label: 'Edit Profile', icon: 'create-outline', screen: 'EditProfile', roles: ['athlete', 'trainer', 'admin'] },
                { label: 'Notifications', icon: 'notifications-outline', screen: 'Notifications', roles: ['athlete', 'trainer', 'admin'] },
                { label: 'Verification', icon: 'shield-checkmark-outline', screen: 'Verification', roles: ['athlete', 'trainer', 'admin'] },
                { label: 'Sub Accounts', icon: 'people-outline', screen: 'SubAccounts', roles: ['athlete'] },
            ],
        },
        {
            title: 'Training',
            items: [
                { label: 'Training History', icon: 'time-outline', screen: 'TrainingHistory', roles: ['athlete', 'trainer'] },
                { label: 'Training Offers', icon: 'pricetag-outline', screen: 'TrainingOffers', roles: ['trainer'] },
                { label: 'Availability', icon: 'calendar-number-outline', screen: 'Availability', roles: ['trainer'] },
                { label: 'Certifications', icon: 'ribbon-outline', screen: 'Certifications', roles: ['trainer'] },
                { label: 'Reviews', icon: 'star-outline', screen: 'Reviews', roles: ['athlete', 'trainer'] },
            ],
        },
        {
            title: 'Payments',
            items: [
                { label: 'Payment Methods', icon: 'card-outline', screen: 'PaymentMethods', roles: ['athlete', 'trainer'] },
                { label: 'Earnings', icon: 'wallet-outline', screen: 'Earnings', roles: ['trainer'] },
                { label: 'Subscription', icon: 'diamond-outline', screen: 'Subscription', roles: ['trainer'] },
            ],
        },
        {
            title: 'Support',
            items: [
                { label: 'Help Center', icon: 'help-circle-outline', screen: 'HelpCenter', roles: ['athlete', 'trainer', 'admin'] },
                { label: 'Support', icon: 'headset-outline', screen: 'Support', roles: ['athlete', 'trainer', 'admin'] },
                { label: 'Terms of Service', icon: 'document-text-outline', screen: 'Terms', roles: ['athlete', 'trainer', 'admin'] },
                { label: 'Privacy Policy', icon: 'lock-closed-outline', screen: 'Privacy', roles: ['athlete', 'trainer', 'admin'] },
            ],
        },
    ];

    const tabScreens = ['Dashboard', 'Discover', 'Bookings', 'Messages', 'Profile'];

    const handleNavigation = (screen: string) => {
        navigation.closeDrawer();
        if (tabScreens.includes(screen)) {
            navigation.navigate('Main', { screen: 'Tabs', params: { screen } });
        } else {
            navigation.navigate('Main', { screen });
        }
    };

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout',
                style: 'destructive',
                onPress: async () => {
                    await logout();
                    navigation.closeDrawer();
                },
            },
        ]);
    };

    const getRoleBadge = () => {
        switch (role) {
            case 'trainer': return { label: 'Trainer', color: Colors.success, bg: Colors.successLight };
            case 'admin': return { label: 'Admin', color: Colors.warning, bg: Colors.warningLight };
            default: return { label: 'Athlete', color: Colors.primary, bg: Colors.primaryGlow };
        }
    };

    const roleBadge = getRoleBadge();
    const userName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();

    return (
        <View style={styles.container}>
            {/* Header: dark card background, avatar + name + email + role badge */}
            <View style={styles.header}>
                <View style={styles.headerCard}>
                    <View style={styles.headerContent}>
                        <Avatar
                            uri={user?.avatarUrl}
                            name={userName}
                            size={56}
                            borderColor={Colors.borderActive}
                        />
                        <View style={styles.userInfo}>
                            <Text style={styles.userName} numberOfLines={1}>
                                {userName}
                            </Text>
                            <Text style={styles.userEmail} numberOfLines={1}>
                                {user?.email}
                            </Text>
                            <View style={styles.roleBadgeWrap}>
                                <View style={[styles.roleBadgePill, { backgroundColor: roleBadge.bg }]}>
                                    <View style={[styles.roleDot, { backgroundColor: roleBadge.color }]} />
                                    <Text style={[styles.roleBadgeText, { color: roleBadge.color }]}>
                                        {roleBadge.label}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </View>

            {/* Menu items with animated press feedback + active highlight */}
            <ScrollView
                style={styles.menuContainer}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.menuContent}
            >
                {menuSections.map((section, sectionIndex) => {
                    const visibleItems = section.items.filter((item) =>
                        item.roles.includes(role as 'athlete' | 'trainer' | 'admin')
                    );
                    if (visibleItems.length === 0) return null;

                    return (
                        <View key={section.title} style={styles.section}>
                            {sectionIndex > 0 && <Divider />}
                            <Text style={styles.sectionTitle}>{section.title}</Text>
                            {visibleItems.map((item) => {
                                const isActive = activeRoute === item.screen;
                                return (
                                    <Pressable
                                        key={item.screen}
                                        style={({ pressed }) => [
                                            styles.menuItem,
                                            isActive && styles.menuItemActive,
                                            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                                        ]}
                                        onPress={() => handleNavigation(item.screen)}
                                        accessibilityLabel={item.label}
                                    >
                                        <View style={[
                                            styles.menuIconContainer,
                                            isActive && styles.menuIconContainerActive,
                                        ]}>
                                            <Ionicons
                                                name={item.icon}
                                                size={20}
                                                color={isActive ? Colors.primary : Colors.textSecondary}
                                            />
                                        </View>
                                        <Text style={[
                                            styles.menuLabel,
                                            isActive && styles.menuLabelActive,
                                        ]}>
                                            {item.label}
                                        </Text>
                                        {isActive ? (
                                            <View style={styles.activeIndicator} />
                                        ) : (
                                            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                                        )}
                                    </Pressable>
                                );
                            })}
                        </View>
                    );
                })}
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
                <Pressable
                    style={({ pressed }) => [
                        styles.logoutButton,
                        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                    ]}
                    onPress={handleLogout}
                    accessibilityLabel="Logout"
                >
                    <View style={styles.logoutIconContainer}>
                        <Ionicons name="log-out-outline" size={20} color={Colors.error} />
                    </View>
                    <Text style={styles.logoutText}>Logout</Text>
                </Pressable>
                <Text style={styles.versionText}>AirTrainr v1.0.0</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    // Header: dark card background
    header: {
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: Spacing.lg,
        paddingHorizontal: Spacing.lg,
    },
    headerCard: {
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadows.small,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    userInfo: {
        flex: 1,
        marginLeft: Spacing.md,
    },
    userName: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    userEmail: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    roleBadgeWrap: {
        marginTop: Spacing.sm,
        flexDirection: 'row',
    },
    roleBadgePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.pill,
    },
    roleDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    roleBadgeText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
    },
    menuContainer: {
        flex: 1,
    },
    menuContent: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
    },
    section: {
        marginBottom: Spacing.xs,
    },
    sectionTitle: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
        color: Colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: Spacing.sm,
        marginTop: Spacing.sm,
    },
    // Menu items with active highlight
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.sm,
        borderRadius: BorderRadius.md,
        marginBottom: 2,
        minHeight: 44,
    },
    menuItemActive: {
        backgroundColor: Colors.primaryGlow,
    },
    menuIconContainer: {
        width: 34,
        height: 34,
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.glass,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    menuIconContainerActive: {
        backgroundColor: Colors.primaryMuted,
    },
    menuLabel: {
        flex: 1,
        fontSize: FontSize.md,
        fontWeight: FontWeight.medium,
        color: Colors.text,
    },
    menuLabelActive: {
        color: Colors.primary,
        fontWeight: FontWeight.semibold,
    },
    activeIndicator: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: Colors.primary,
    },
    footer: {
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.lg,
        paddingBottom: Platform.OS === 'ios' ? 34 : Spacing.lg,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        minHeight: 44,
    },
    logoutIconContainer: {
        width: 34,
        height: 34,
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.errorMuted,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    logoutText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.error,
    },
    versionText: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        marginTop: Spacing.sm,
    },
});

import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Platform,
    Image,
} from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../theme';

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
    const { navigation } = props;
    const role = user?.role || 'athlete';

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
            navigation.navigate('Tabs', { screen });
        } else {
            navigation.navigate(screen);
        }
    };

    const handleLogout = async () => {
        navigation.closeDrawer();
        await logout();
    };

    const getInitials = () => {
        if (!user) return '?';
        return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();
    };

    const getRoleBadge = () => {
        switch (role) {
            case 'trainer': return { label: 'Trainer', color: Colors.success };
            case 'admin': return { label: 'Admin', color: Colors.warning };
            default: return { label: 'Athlete', color: Colors.primary };
        }
    };

    const roleBadge = getRoleBadge();

    return (
        <View style={styles.container}>
            {/* Header with user info */}
            <LinearGradient
                colors={[Colors.gradientStart, Colors.gradientEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
            >
                <View style={styles.headerContent}>
                    {user?.avatarUrl ? (
                        <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarText}>{getInitials()}</Text>
                        </View>
                    )}
                    <View style={styles.userInfo}>
                        <Text style={styles.userName} numberOfLines={1}>
                            {user?.firstName} {user?.lastName}
                        </Text>
                        <Text style={styles.userEmail} numberOfLines={1}>
                            {user?.email}
                        </Text>
                        <View style={[styles.roleBadge, { backgroundColor: roleBadge.color + '30' }]}>
                            <View style={[styles.roleDot, { backgroundColor: roleBadge.color }]} />
                            <Text style={[styles.roleText, { color: roleBadge.color }]}>
                                {roleBadge.label}
                            </Text>
                        </View>
                    </View>
                </View>
            </LinearGradient>

            {/* Menu items */}
            <ScrollView
                style={styles.menuContainer}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.menuContent}
            >
                {menuSections.map((section) => {
                    const visibleItems = section.items.filter((item) =>
                        item.roles.includes(role as 'athlete' | 'trainer' | 'admin')
                    );
                    if (visibleItems.length === 0) return null;

                    return (
                        <View key={section.title} style={styles.section}>
                            <Text style={styles.sectionTitle}>{section.title}</Text>
                            {visibleItems.map((item) => (
                                <TouchableOpacity
                                    key={item.screen}
                                    style={styles.menuItem}
                                    onPress={() => handleNavigation(item.screen)}
                                    activeOpacity={0.6}
                                >
                                    <View style={styles.menuIconContainer}>
                                        <Ionicons name={item.icon} size={20} color={Colors.textSecondary} />
                                    </View>
                                    <Text style={styles.menuLabel}>{item.label}</Text>
                                    <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    );
                })}
            </ScrollView>

            {/* Logout button */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleLogout}
                    activeOpacity={0.7}
                >
                    <Ionicons name="log-out-outline" size={20} color={Colors.error} />
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
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
    header: {
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 20,
        paddingHorizontal: Spacing.lg,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    avatarPlaceholder: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    avatarText: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: '#fff',
    },
    userInfo: {
        flex: 1,
        marginLeft: Spacing.md,
    },
    userName: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: '#fff',
    },
    userEmail: {
        fontSize: FontSize.xs,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 2,
    },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: BorderRadius.pill,
        marginTop: 6,
    },
    roleDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 5,
    },
    roleText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
    },
    menuContainer: {
        flex: 1,
    },
    menuContent: {
        paddingVertical: Spacing.sm,
    },
    section: {
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
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
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: Spacing.sm,
        borderRadius: BorderRadius.sm,
        marginBottom: 2,
    },
    menuIconContainer: {
        width: 32,
        height: 32,
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.glass,
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
    },
    logoutText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.error,
        marginLeft: Spacing.sm,
    },
    versionText: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        marginTop: Spacing.sm,
    },
});

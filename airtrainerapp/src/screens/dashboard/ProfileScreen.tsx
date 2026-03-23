import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

export default function ProfileScreen({ navigation }: any) {
    const { user, logout } = useAuth();
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: logout },
        ]);
    };

    const initials = (user?.firstName?.[0] || '') + (user?.lastName?.[0] || '');

    const menuSections = [
        {
            title: 'Account',
            items: [
                { icon: 'person-outline', label: 'Edit Profile', screen: 'EditProfile' },
                { icon: 'shield-checkmark-outline', label: 'Verification', screen: 'Verification' },
                { icon: 'people-outline', label: 'Sub-Accounts', screen: 'SubAccounts', badge: user?.role === 'athlete' ? '0/6' : undefined },
                { icon: 'card-outline', label: 'Payment Methods', screen: 'PaymentMethods' },
            ],
        },
        {
            title: user?.role === 'trainer' ? 'Business' : 'Training',
            items: user?.role === 'trainer'
                ? [
                    { icon: 'calendar-outline', label: 'Availability', screen: 'Availability' },
                    { icon: 'wallet-outline', label: 'Earnings', screen: 'Earnings' },
                    { icon: 'paper-plane-outline', label: 'Training Offers', screen: 'TrainingOffers' },
                    { icon: 'diamond-outline', label: 'Subscription', screen: 'Subscription', badge: user?.trainerProfile?.subscription_status === 'trial' ? 'Trial' : undefined },
                    { icon: 'star-outline', label: 'Reviews', screen: 'Reviews' },
                    { icon: 'document-text-outline', label: 'Certifications', screen: 'Certifications' },
                ]
                : [
                    { icon: 'star-outline', label: 'My Reviews', screen: 'Reviews' },
                    { icon: 'trophy-outline', label: 'Training History', screen: 'TrainingHistory' },
                ],
        },
        {
            title: 'Preferences',
            items: [
                { icon: 'notifications-outline', label: 'Notifications', toggle: true },
                { icon: 'moon-outline', label: 'Dark Mode', info: 'Enabled' },
                { icon: 'globe-outline', label: 'Language', info: 'English' },
            ],
        },
        {
            title: 'Support',
            items: [
                { icon: 'help-circle-outline', label: 'Help Center', screen: 'HelpCenter' },
                { icon: 'chatbubble-ellipses-outline', label: 'Contact Support', screen: 'Support' },
                { icon: 'document-text-outline', label: 'Terms of Service', screen: 'Terms' },
                { icon: 'shield-outline', label: 'Privacy Policy', screen: 'Privacy' },
            ],
        },
    ];

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
            {/* Header / Profile Card */}
            <View style={styles.profileCard}>
                <LinearGradient
                    colors={['#45D0FF', '#0047AB']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.avatarBg}
                >
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initials}</Text>
                    </View>
                </LinearGradient>
                <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
                <Text style={styles.email}>{user?.email}</Text>
                <View style={styles.roleBadge}>
                    <Ionicons
                        name={user?.role === 'trainer' ? 'barbell' : 'person'}
                        size={14}
                        color="#45D0FF"
                    />
                    <Text style={styles.roleText}>
                        {user?.role === 'trainer' ? 'Trainer' : 'Athlete'}
                    </Text>
                </View>

                {/* Stats */}
                {user?.role === 'trainer' && user.trainerProfile && (
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{user.trainerProfile.total_sessions}</Text>
                            <Text style={styles.statLabel}>Sessions</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{Number(user.trainerProfile.reliability_score).toFixed(0)}%</Text>
                            <Text style={styles.statLabel}>Rating</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statNumber}>{user.trainerProfile.sports?.length || 0}</Text>
                            <Text style={styles.statLabel}>Sports</Text>
                        </View>
                    </View>
                )}
            </View>

            {/* Menu Sections */}
            {menuSections.map((section) => (
                <View key={section.title} style={styles.menuSection}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <View style={styles.menuCard}>
                        {section.items.map((item, index) => (
                            <TouchableOpacity
                                key={item.label}
                                style={[styles.menuItem, index < section.items.length - 1 && styles.menuItemBorder]}
                                onPress={() => !('toggle' in item) && ('screen' in item) && navigation.navigate(item.screen)}
                                activeOpacity={'toggle' in item ? 1 : 0.7}
                            >
                                <View style={styles.menuIcon}>
                                    <Ionicons name={item.icon as any} size={20} color="#45D0FF" />
                                </View>
                                <Text style={styles.menuLabel}>{item.label}</Text>
                                <View style={styles.menuRight}>
                                    {'badge' in item && item.badge && (
                                        <View style={styles.menuBadge}>
                                            <Text style={styles.menuBadgeText}>{item.badge}</Text>
                                        </View>
                                    )}
                                    {'info' in item && item.info && (
                                        <Text style={styles.menuInfo}>{item.info}</Text>
                                    )}
                                    {'toggle' in item && item.toggle ? (
                                        <Switch
                                            value={notificationsEnabled}
                                            onValueChange={setNotificationsEnabled}
                                            trackColor={{ false: Colors.surface, true: Colors.primaryGlow }}
                                            thumbColor={notificationsEnabled ? Colors.primary : Colors.textTertiary}
                                        />
                                    ) : (
                                        <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            ))}

            {/* Logout Button */}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={20} color="#ff4444" />
                <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>

            {/* App Version */}
            <Text style={styles.versionText}>AirTrainr v1.0.0</Text>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0D14' },
    contentContainer: { paddingHorizontal: Spacing.xxl, paddingTop: 60, paddingBottom: 40 },
    profileCard: { alignItems: 'center', marginBottom: Spacing.xxxl },
    avatarBg: { width: 88, height: 88, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg, ...Shadows.glow },
    avatar: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#0A0D14', justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: '#45D0FF' },
    name: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: '#FFFFFF', marginBottom: 2 },
    email: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
    roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.lg, paddingVertical: 6, borderRadius: BorderRadius.pill, backgroundColor: Colors.primaryGlow },
    roleText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, color: '#45D0FF', textTransform: 'capitalize' },
    statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xxl, gap: Spacing.xxl },
    statItem: { alignItems: 'center' },
    statNumber: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    statLabel: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 2 },
    statDivider: { width: 1, height: 30, backgroundColor: Colors.border },
    menuSection: { marginBottom: Spacing.xxl },
    sectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm, paddingLeft: Spacing.sm },
    menuCard: { backgroundColor: '#161B22', borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.lg, paddingHorizontal: Spacing.lg },
    menuItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
    menuIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.primaryGlow, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    menuLabel: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.medium, color: '#FFFFFF' },
    menuRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    menuBadge: { paddingHorizontal: Spacing.md, paddingVertical: 2, borderRadius: BorderRadius.pill, backgroundColor: Colors.surface },
    menuBadgeText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: Colors.textSecondary },
    menuInfo: { fontSize: FontSize.sm, color: Colors.textTertiary },
    logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 52, borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.error, gap: Spacing.sm, marginTop: Spacing.lg },
    logoutText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: '#ff4444' },
    versionText: { fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'center', marginTop: Spacing.xl },
});

import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

export default function ProfileScreen({ navigation }: any) {
    const { user, logout, refreshUser } = useAuth();
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);

    useEffect(() => {
        // Refresh user data when screen comes into focus
        const unsubscribe = navigation.addListener('focus', () => {
            refreshUser();
        });
        return unsubscribe;
    }, [navigation, refreshUser]);

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: logout },
        ]);
    };

    const initials = (user?.firstName?.[0] || '') + (user?.lastName?.[0] || '');
    const isTrainer = user?.role === 'trainer';
    const tp = user?.trainerProfile;
    const ap = user?.athleteProfile;

    const menuSections = [
        {
            title: 'Account',
            items: [
                { icon: 'person-outline', label: 'Edit Profile', screen: 'EditProfile' },
                { icon: 'notifications-outline', label: 'Notifications', screen: 'Notifications' },
                ...(isTrainer ? [] : [
                    { icon: 'people-outline', label: 'Sub-Accounts', screen: 'SubAccounts', badge: '0/6' },
                ]),
                { icon: 'card-outline', label: 'Payment Methods', screen: 'PaymentMethods' },
            ],
        },
        ...(isTrainer ? [{
            title: 'Trainer Tools',
            items: [
                { icon: 'calendar-outline', label: 'Availability', screen: 'Availability' },
                { icon: 'wallet-outline', label: 'Earnings', screen: 'Earnings' },
                { icon: 'star-outline', label: 'Reviews', screen: 'Reviews' },
                { icon: 'diamond-outline', label: 'Subscription', screen: 'Subscription', badge: tp?.subscription_status === 'trial' ? 'Trial' : tp?.subscription_status === 'active' ? 'Active' : undefined },
                { icon: 'shield-checkmark-outline', label: 'Verification', screen: 'Verification', badge: tp?.is_verified ? 'Verified' : 'Pending' },
                { icon: 'document-text-outline', label: 'Certifications', screen: 'Certifications' },
            ],
        }] : [{
            title: 'Training',
            items: [
                { icon: 'star-outline', label: 'My Reviews', screen: 'Reviews' },
                { icon: 'trophy-outline', label: 'Training History', screen: 'TrainingHistory' },
            ],
        }]),
        {
            title: 'Preferences',
            items: [
                { icon: 'notifications-outline', label: 'Push Notifications', toggle: true },
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
                {user?.avatarUrl ? (
                    <Image source={{ uri: user.avatarUrl }} style={styles.avatarImg} />
                ) : (
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
                )}
                <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
                <Text style={styles.email}>{user?.email}</Text>
                <View style={styles.roleBadge}>
                    <Ionicons
                        name={isTrainer ? 'barbell' : 'person'}
                        size={14}
                        color="#45D0FF"
                    />
                    <Text style={styles.roleText}>
                        {isTrainer ? 'Trainer' : 'Athlete'}
                    </Text>
                </View>

                {/* Trainer Stats */}
                {isTrainer && tp && (
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
                )}

                {/* Trainer Profile Details */}
                {isTrainer && tp && (
                    <View style={styles.profileDetails}>
                        {tp.headline && (
                            <Text style={styles.detailHeadline}>{tp.headline}</Text>
                        )}
                        <View style={styles.detailRow}>
                            <Ionicons name="cash-outline" size={16} color={Colors.primary} />
                            <Text style={styles.detailText}>${Number(tp.hourly_rate || 0).toFixed(0)}/hr</Text>
                        </View>
                        {(tp.city || tp.state) && (
                            <View style={styles.detailRow}>
                                <Ionicons name="location-outline" size={16} color={Colors.primary} />
                                <Text style={styles.detailText}>
                                    {tp.city || ''}{tp.state ? `, ${tp.state}` : ''}
                                </Text>
                            </View>
                        )}
                        <View style={styles.detailRow}>
                            <Ionicons name="shield-checkmark-outline" size={16} color={tp.is_verified ? Colors.success : Colors.warning} />
                            <Text style={[styles.detailText, { color: tp.is_verified ? Colors.success : Colors.warning }]}>
                                {tp.is_verified ? 'Verified' : 'Verification Pending'}
                            </Text>
                        </View>
                        <View style={styles.detailRow}>
                            <Ionicons name="diamond-outline" size={16} color={Colors.primary} />
                            <Text style={styles.detailText}>
                                Subscription: {tp.subscription_status === 'active' ? 'Active' : tp.subscription_status === 'trial' ? 'Trial' : tp.subscription_status || 'N/A'}
                            </Text>
                        </View>
                        {tp.sports && tp.sports.length > 0 && (
                            <View style={styles.sportTagsRow}>
                                {tp.sports.map((sport) => (
                                    <View key={sport} style={styles.sportTag}>
                                        <Text style={styles.sportTagText}>{sport.replace(/_/g, ' ')}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                {/* Athlete Profile Details */}
                {!isTrainer && ap && (
                    <View style={styles.profileDetails}>
                        {ap.skill_level && (
                            <View style={styles.detailRow}>
                                <Ionicons name="fitness-outline" size={16} color={Colors.primary} />
                                <Text style={styles.detailText}>
                                    Skill Level: <Text style={{ color: Colors.primary, fontWeight: FontWeight.semibold, textTransform: 'capitalize' }}>{ap.skill_level}</Text>
                                </Text>
                            </View>
                        )}
                        {(ap.city || ap.state) && (
                            <View style={styles.detailRow}>
                                <Ionicons name="location-outline" size={16} color={Colors.primary} />
                                <Text style={styles.detailText}>
                                    {ap.city || ''}{ap.state ? `, ${ap.state}` : ''}
                                </Text>
                            </View>
                        )}
                        {ap.travel_radius_miles > 0 && (
                            <View style={styles.detailRow}>
                                <Ionicons name="navigate-outline" size={16} color={Colors.primary} />
                                <Text style={styles.detailText}>Travel Radius: {ap.travel_radius_miles} miles</Text>
                            </View>
                        )}
                        {ap.preferredTrainingTimes && ap.preferredTrainingTimes.length > 0 && (
                            <View style={styles.detailRow}>
                                <Ionicons name="time-outline" size={16} color={Colors.primary} />
                                <Text style={styles.detailText}>
                                    Prefers: {ap.preferredTrainingTimes.join(', ')}
                                </Text>
                            </View>
                        )}
                        {ap.sports && ap.sports.length > 0 && (
                            <View style={styles.sportTagsRow}>
                                {ap.sports.map((sport) => (
                                    <View key={sport} style={styles.sportTag}>
                                        <Text style={styles.sportTagText}>{sport.replace(/_/g, ' ')}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                        {ap.trainingPreferences && ap.trainingPreferences.length > 0 && (
                            <View style={styles.sportTagsRow}>
                                {ap.trainingPreferences.map((pref) => (
                                    <View key={pref} style={[styles.sportTag, { backgroundColor: Colors.successLight }]}>
                                        <Text style={[styles.sportTagText, { color: Colors.success }]}>{pref.replace(/_/g, ' ')}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
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
    avatarImg: { width: 88, height: 88, borderRadius: 28, marginBottom: Spacing.lg, borderWidth: 3, borderColor: Colors.primary },
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
    profileDetails: { width: '100%', marginTop: Spacing.xl, backgroundColor: '#161B22', borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
    detailHeadline: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic', marginBottom: Spacing.md, textAlign: 'center' },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    detailText: { fontSize: FontSize.sm, color: Colors.text },
    sportTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm },
    sportTag: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: BorderRadius.pill, backgroundColor: Colors.primaryGlow },
    sportTagText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: Colors.primary, textTransform: 'capitalize' },
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

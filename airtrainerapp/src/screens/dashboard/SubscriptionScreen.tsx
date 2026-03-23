import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

export default function SubscriptionScreen({ navigation }: any) {
    const { user, refreshUser } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchSubscription = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('trainer_profiles')
                .select('*')
                .eq('user_id', user.id)
                .single();
            if (error) throw error;
            setProfile(data);
        } catch (error) {
            console.error('Error fetching subscription:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchSubscription(); }, [fetchSubscription]);
    const onRefresh = async () => { setRefreshing(true); await fetchSubscription(); setRefreshing(false); };

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'trial': return { color: Colors.info, bg: Colors.infoLight, label: 'Free Trial', icon: 'time' };
            case 'active': return { color: Colors.success, bg: Colors.successLight, label: 'Active', icon: 'checkmark-circle' };
            case 'expired': return { color: Colors.error, bg: Colors.errorLight, label: 'Expired', icon: 'alert-circle' };
            case 'cancelled': return { color: Colors.textTertiary, bg: Colors.surface, label: 'Cancelled', icon: 'close-circle' };
            default: return { color: Colors.textTertiary, bg: Colors.surface, label: status, icon: 'help-circle' };
        }
    };

    const getDaysRemaining = () => {
        if (!profile) return 0;
        if (profile.subscription_status === 'trial') {
            const trialStart = new Date(profile.trial_started_at);
            const trialEnd = new Date(trialStart.getTime() + 7 * 24 * 60 * 60 * 1000);
            const daysLeft = Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
            return daysLeft;
        }
        if (profile.subscription_expires_at) {
            const daysLeft = Math.max(0, Math.ceil((new Date(profile.subscription_expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
            return daysLeft;
        }
        return 0;
    };

    const handleActivateSubscription = () => {
        Alert.alert(
            'Activate Subscription',
            'Your subscription will be $14.99/month. Stripe payment integration coming soon!',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Activate',
                    onPress: async () => {
                        try {
                            const expiresAt = new Date();
                            expiresAt.setMonth(expiresAt.getMonth() + 1);
                            await supabase.from('trainer_profiles').update({
                                subscription_status: 'active',
                                subscription_expires_at: expiresAt.toISOString(),
                            }).eq('user_id', user?.id);
                            await refreshUser();
                            fetchSubscription();
                            Alert.alert('Success', 'Your subscription is now active!');
                        } catch (e: any) {
                            Alert.alert('Error', e.message);
                        }
                    },
                },
            ]
        );
    };

    if (isLoading) {
        return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={Colors.primary} /></View>;
    }

    const status = getStatusConfig(profile?.subscription_status || 'trial');
    const daysRemaining = getDaysRemaining();

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Subscription</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            >
                {/* Status Card */}
                <LinearGradient colors={[Colors.primary, Colors.gradientEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statusCard}>
                    <View style={[styles.statusBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                        <Ionicons name={status.icon as any} size={18} color="#fff" />
                        <Text style={styles.statusBadgeText}>{status.label}</Text>
                    </View>
                    <Text style={styles.statusTitle}>AirTrainr Pro</Text>
                    <Text style={styles.statusPrice}>
                        {profile?.subscription_status === 'trial' ? 'FREE' : '$14.99'}
                        <Text style={styles.statusPeriod}>{profile?.subscription_status === 'trial' ? '' : '/month'}</Text>
                    </Text>
                    {daysRemaining > 0 && (
                        <Text style={styles.statusDays}>
                            {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
                        </Text>
                    )}
                </LinearGradient>

                {/* What's included */}
                <Text style={styles.sectionTitle}>What's Included</Text>
                <View style={styles.featuresCard}>
                    {[
                        { icon: 'search', text: 'Appear in athlete search results' },
                        { icon: 'calendar', text: 'Manage booking calendar' },
                        { icon: 'chatbubbles', text: 'Direct messaging with athletes' },
                        { icon: 'cash', text: 'Accept payments (3% platform fee)' },
                        { icon: 'shield-checkmark', text: 'Get identity verified badge' },
                        { icon: 'analytics', text: 'Earnings dashboard & analytics' },
                        { icon: 'star', text: 'Build reviews & reputation' },
                        { icon: 'notifications', text: 'Nearby training request alerts' },
                    ].map((feature, i) => (
                        <View key={i} style={styles.featureRow}>
                            <Ionicons name={feature.icon as any} size={20} color={Colors.success} />
                            <Text style={styles.featureText}>{feature.text}</Text>
                        </View>
                    ))}
                </View>

                {/* Subscription Info */}
                <Text style={styles.sectionTitle}>Subscription Details</Text>
                <View style={styles.detailCard}>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Status</Text>
                        <View style={[styles.detailBadge, { backgroundColor: status.bg }]}>
                            <Text style={[styles.detailBadgeText, { color: status.color }]}>{status.label}</Text>
                        </View>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Started</Text>
                        <Text style={styles.detailValue}>
                            {profile?.trial_started_at ? new Date(profile.trial_started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                        </Text>
                    </View>
                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Verification</Text>
                        <View style={[styles.detailBadge, { backgroundColor: profile?.is_verified ? Colors.successLight : Colors.warningLight }]}>
                            <Text style={[styles.detailBadgeText, { color: profile?.is_verified ? Colors.success : Colors.warning }]}>
                                {profile?.is_verified ? 'Verified ✓' : 'Pending'}
                            </Text>
                        </View>
                    </View>
                    <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                        <Text style={styles.detailLabel}>Reliability Score</Text>
                        <Text style={styles.detailValue}>{Number(profile?.reliability_score || 100).toFixed(0)}%</Text>
                    </View>
                </View>

                {/* Action Button */}
                {(profile?.subscription_status === 'expired' || profile?.subscription_status === 'cancelled') && (
                    <TouchableOpacity style={styles.activateButton} onPress={handleActivateSubscription}>
                        <Text style={styles.activateButtonText}>Reactivate Subscription</Text>
                    </TouchableOpacity>
                )}
                {profile?.subscription_status === 'trial' && (
                    <TouchableOpacity style={styles.activateButton} onPress={handleActivateSubscription}>
                        <Text style={styles.activateButtonText}>Upgrade to Pro — $14.99/mo</Text>
                    </TouchableOpacity>
                )}
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xxl, paddingTop: 60, paddingBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
    backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
    contentContainer: { padding: Spacing.xxl },
    statusCard: { borderRadius: BorderRadius.lg, padding: Spacing.xxl, alignItems: 'center', marginBottom: Spacing.xxl, ...Shadows.glow },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.lg, paddingVertical: 6, borderRadius: BorderRadius.pill, marginBottom: Spacing.md },
    statusBadgeText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#fff' },
    statusTitle: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, color: '#fff' },
    statusPrice: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: '#fff', marginTop: Spacing.xs },
    statusPeriod: { fontSize: FontSize.md, fontWeight: FontWeight.regular, color: 'rgba(255,255,255,0.7)' },
    statusDays: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)', marginTop: Spacing.sm },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.md },
    featuresCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xxl },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
    featureText: { fontSize: FontSize.md, color: Colors.text, flex: 1 },
    detailCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xxl },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
    detailLabel: { fontSize: FontSize.md, color: Colors.textSecondary },
    detailValue: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
    detailBadge: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: BorderRadius.pill },
    detailBadgeText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
    activateButton: { backgroundColor: Colors.primary, padding: Spacing.lg, borderRadius: BorderRadius.md, alignItems: 'center', ...Shadows.glow },
    activateButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },
});

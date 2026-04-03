import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

// ─── API URL ─────────────────────────────────────────────────────────────────

const API_URL = 'https://api.airtrainr.com/api/v1';

// ─── Types ───────────────────────────────────────────────────────────────────

type Transaction = {
    id: string;
    amount: number;
    platform_fee: number | null;
    total_paid: number | null;
    sport: string | null;
    status: string;
    created_at: string;
    athlete_id: string | null;
    trainer_id: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
    return `$${Number(amount).toFixed(2)}`;
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getStatusColor(status: string): string {
    switch (status) {
        case 'completed':
            return Colors.success;
        case 'pending':
            return Colors.warning;
        case 'cancelled':
        case 'disputed':
            return Colors.error;
        default:
            return Colors.textSecondary;
    }
}

function getStatusLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SportPill({ sport }: { sport: string | null }) {
    if (!sport) return null;
    return (
        <View style={styles.sportPill}>
            <Text style={styles.sportPillText}>{sport}</Text>
        </View>
    );
}

function TransactionItem({ tx }: { tx: Transaction }) {
    const displayAmount = tx.total_paid ?? tx.amount;
    const isPositive = true; // for trainer, received; for athlete, paid

    return (
        <View style={styles.txItem}>
            <View style={styles.txIconWrap}>
                <Ionicons
                    name="swap-horizontal-outline"
                    size={18}
                    color={Colors.primary}
                />
            </View>
            <View style={styles.txInfo}>
                <View style={styles.txTopRow}>
                    <Text style={styles.txAmount}>
                        {isPositive ? '+' : '-'}{formatCurrency(displayAmount)}
                    </Text>
                    <View
                        style={[
                            styles.txStatusBadge,
                            { backgroundColor: getStatusColor(tx.status) + '22' },
                        ]}
                    >
                        <Text
                            style={[styles.txStatusText, { color: getStatusColor(tx.status) }]}
                        >
                            {getStatusLabel(tx.status)}
                        </Text>
                    </View>
                </View>
                <View style={styles.txBottomRow}>
                    <Text style={styles.txDate}>{formatDate(tx.created_at)}</Text>
                    <SportPill sport={tx.sport} />
                </View>
            </View>
        </View>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PaymentMethodsScreen({ navigation }: any) {
    const { user } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [connecting, setConnecting] = useState(false);

    const isTrainer = user?.role === 'trainer';
    const trainerProfile = user?.trainerProfile;

    const fetchTransactions = useCallback(async () => {
        if (!user) return;
        try {
            let query = supabase
                .from('payment_transactions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            if (isTrainer && trainerProfile?.id) {
                query = query.eq('trainer_id', trainerProfile.id);
            } else {
                query = query.eq('athlete_id', user.id);
            }

            const { data, error } = await query;
            if (error) throw error;
            setTransactions((data || []) as Transaction[]);
        } catch (err) {
            console.error('Error fetching transactions:', err);
            // Fall through with empty array — table may not exist yet
        } finally {
            setIsLoading(false);
        }
    }, [user, isTrainer, trainerProfile]);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchTransactions();
        setRefreshing(false);
    };

    // ── Stripe Connect handler ───────────────────────────────────────────────

    const handleConnectStripe = async () => {
        setConnecting(true);
        try {
            // Get the current session for auth token
            const { data: sessionData } = await supabase.auth.getSession();
            const accessToken = sessionData?.session?.access_token;

            const response = await fetch(`${API_URL}/payments/trainer/onboarding`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
            });

            if (response.ok) {
                const { url } = await response.json();
                if (url) {
                    await WebBrowser.openBrowserAsync(url);
                    // Refresh status after returning from Stripe
                    fetchTransactions();
                }
            } else {
                // Fallback: direct user to web
                Alert.alert(
                    'Stripe Connect',
                    'To connect your Stripe account, please visit airtrainr.com on your computer and go to Payment Methods in your profile settings.'
                );
            }
        } catch (error) {
            Alert.alert(
                'Stripe Connect',
                'To connect your Stripe account, please visit airtrainr.com on your computer and go to Payment Methods.'
            );
        } finally {
            setConnecting(false);
        }
    };

    const handleAddPaymentMethod = () => {
        Alert.alert(
            'Stripe Payments Coming Soon',
            'Stripe payments coming soon! Contact support@airtrainr.com',
            [{ text: 'OK' }]
        );
    };

    if (isLoading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    const stripeConnected = !!(trainerProfile?.stripe_account_id);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={22} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Payments</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.contentContainer}
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
                {/* TRAINER: Payout Account Card */}
                {isTrainer ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>PAYOUT ACCOUNT</Text>

                        {stripeConnected ? (
                            /* Connected State */
                            <View style={styles.stripeConnectedCard}>
                                <View style={styles.stripeConnectedLeft}>
                                    <View style={styles.stripeConnectedIconWrap}>
                                        <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                                    </View>
                                    <View style={styles.paymentCardInfo}>
                                        <Text style={styles.paymentCardTitle}>Stripe Connected</Text>
                                        <Text style={styles.paymentCardSubtitle}>
                                            Account: {'\u00B7\u00B7\u00B7'}{trainerProfile!.stripe_account_id!.slice(-6)}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.stripeConnectedBadge}>
                                    <Ionicons name="checkmark" size={14} color={Colors.success} />
                                    <Text style={styles.stripeConnectedBadgeText}>Active</Text>
                                </View>
                            </View>
                        ) : (
                            /* Not Connected State */
                            <View style={styles.stripeWarningCard}>
                                <View style={styles.stripeWarningIconRow}>
                                    <View style={styles.stripeWarningIconWrap}>
                                        <Ionicons name="alert-circle-outline" size={28} color={Colors.warning} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.stripeWarningTitle}>Connect to Receive Payouts</Text>
                                        <Text style={styles.stripeWarningSubtitle}>
                                            Link your Stripe account to start receiving payments from completed sessions.
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={styles.stripeConnectBtn}
                                    onPress={handleConnectStripe}
                                    activeOpacity={0.85}
                                    disabled={connecting}
                                >
                                    {connecting ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <>
                                            <Ionicons name="link-outline" size={18} color="#fff" />
                                            <Text style={styles.stripeConnectBtnText}>Connect Stripe Account</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Payout info strip */}
                        <View style={styles.payoutInfoStrip}>
                            <View style={styles.payoutInfoItem}>
                                <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
                                <Text style={styles.payoutInfoText}>Payouts every 7 days</Text>
                            </View>
                            <View style={styles.payoutInfoItem}>
                                <Ionicons name="shield-checkmark-outline" size={16} color={Colors.textSecondary} />
                                <Text style={styles.payoutInfoText}>Secured by Stripe</Text>
                            </View>
                        </View>
                    </View>
                ) : (
                    /* ATHLETE: Payment Method Card */
                    <View style={styles.section}>
                        <Text style={styles.sectionLabel}>PAYMENT METHOD</Text>
                        <View style={styles.comingSoonCard}>
                            <Ionicons name="card-outline" size={28} color={Colors.primary} />
                            <Text style={styles.comingSoonText}>
                                Payment methods will be available soon. We're integrating Stripe for secure payments.
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={styles.addMethodButton}
                            onPress={handleAddPaymentMethod}
                        >
                            <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                            <Text style={styles.addMethodText}>Add Payment Method</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Recent Transactions */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>RECENT TRANSACTIONS</Text>

                    {transactions.length === 0 ? (
                        <View style={styles.emptyTransactions}>
                            <View style={styles.emptyIconWrap}>
                                <Ionicons name="receipt-outline" size={32} color={Colors.primary} />
                            </View>
                            <Text style={styles.emptyTitle}>No transactions yet</Text>
                            <Text style={styles.emptyText}>
                                {isTrainer
                                    ? 'Completed sessions will appear here once athletes pay.'
                                    : 'Your session payments will appear here.'}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.txList}>
                            {transactions.map((tx) => (
                                <TransactionItem key={tx.id} tx={tx} />
                            ))}
                        </View>
                    )}
                </View>

                {/* Trainer: Connect Stripe CTA if not connected */}
                {isTrainer && !stripeConnected && (
                    <View style={styles.stripeCta}>
                        <View style={styles.stripeCtaIcon}>
                            <Ionicons name="card-outline" size={24} color={Colors.primary} />
                        </View>
                        <Text style={styles.stripeCtaTitle}>Get Paid Faster</Text>
                        <Text style={styles.stripeCtaText}>
                            Connect your Stripe account to automatically receive payouts after each completed session. No delays, no hassle.
                        </Text>
                        <TouchableOpacity
                            style={styles.stripeCtaButton}
                            onPress={handleConnectStripe}
                            disabled={connecting}
                        >
                            {connecting ? (
                                <ActivityIndicator size="small" color={Colors.background} />
                            ) : (
                                <>
                                    <Ionicons name="link-outline" size={18} color={Colors.background} />
                                    <Text style={styles.stripeCtaButtonText}>Connect Stripe Account</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    center: {
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
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    headerTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },

    // Content
    contentContainer: {
        padding: Spacing.xxl,
        gap: Spacing.xl,
        flexGrow: 1,
    },

    // Section
    section: {
        gap: Spacing.md,
    },
    sectionLabel: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
        color: Colors.textTertiary,
        letterSpacing: 1.2,
    },

    // Stripe Connected Card
    stripeConnectedCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.success + '44',
        ...Shadows.small,
    },
    stripeConnectedLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        flex: 1,
    },
    stripeConnectedIconWrap: {
        width: 44,
        height: 44,
        borderRadius: BorderRadius.md,
        backgroundColor: 'rgba(0,200,83,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    stripeConnectedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(0,200,83,0.12)',
        paddingHorizontal: Spacing.md,
        paddingVertical: 4,
        borderRadius: BorderRadius.pill,
        borderWidth: 1,
        borderColor: Colors.success + '44',
    },
    stripeConnectedBadgeText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.success,
    },

    // Stripe Warning Card (not connected)
    stripeWarningCard: {
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.warning + '44',
        gap: Spacing.lg,
        ...Shadows.small,
    },
    stripeWarningIconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    stripeWarningIconWrap: {
        width: 48,
        height: 48,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.warningLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stripeWarningTitle: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    stripeWarningSubtitle: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: 2,
        lineHeight: 20,
    },
    stripeConnectBtn: {
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.md,
        paddingVertical: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    stripeConnectBtnText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: '#fff',
    },

    // Payment card info (shared)
    paymentCardInfo: {
        flex: 1,
        gap: 3,
    },
    paymentCardTitle: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
    },
    paymentCardSubtitle: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },

    // Payout info strip
    payoutInfoStrip: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.md,
        paddingVertical: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    payoutInfoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    payoutInfoText: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
    },

    // Coming soon card
    comingSoonCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadows.small,
    },
    comingSoonText: {
        flex: 1,
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 20,
    },

    // Add method button
    addMethodButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
        borderStyle: 'dashed',
        justifyContent: 'center',
    },
    addMethodText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.primary,
    },

    // Transactions
    txList: {
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
        ...Shadows.small,
    },
    txItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        padding: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    txIconWrap: {
        width: 40,
        height: 40,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primaryGlow,
        justifyContent: 'center',
        alignItems: 'center',
    },
    txInfo: {
        flex: 1,
        gap: 5,
    },
    txTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    txAmount: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    txStatusBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.pill,
    },
    txStatusText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
    },
    txBottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    txDate: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    sportPill: {
        backgroundColor: Colors.surface,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.pill,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    sportPillText: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        fontWeight: FontWeight.medium,
    },

    // Empty transactions
    emptyTransactions: {
        alignItems: 'center',
        padding: Spacing.xxxl,
        gap: Spacing.md,
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    emptyIconWrap: {
        width: 64,
        height: 64,
        borderRadius: BorderRadius.xl,
        backgroundColor: Colors.primaryGlow,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.borderActive,
    },
    emptyTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    emptyText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },

    // Stripe CTA
    stripeCta: {
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        borderWidth: 1,
        borderColor: Colors.borderActive,
        alignItems: 'center',
        gap: Spacing.md,
        ...Shadows.glow,
    },
    stripeCtaIcon: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.primaryGlow,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.borderActive,
    },
    stripeCtaTitle: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    stripeCtaText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    stripeCtaButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.sm,
    },
    stripeCtaButtonText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.background,
    },
});

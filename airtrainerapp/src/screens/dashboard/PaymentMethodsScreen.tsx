import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Alert,
    ActivityIndicator,
    Linking,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Config } from '../../lib/config';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';
import { ScreenWrapper, ScreenHeader, Card, Badge, EmptyState, LoadingScreen, Button, SectionHeader } from '../../components/ui';

type ConnectStatus = {
    hasAccount: boolean;
    onboardingComplete: boolean;
    payoutsEnabled: boolean;
    chargesEnabled: boolean;
    bankLast4: string | null;
    bankName: string | null;
    dashboardUrl: string | null;
    accountId?: string;
};

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

function formatCurrency(amount: number): string {
    return `$${Number(amount).toFixed(2)}`;
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getStatusColor(status: string): string {
    switch (status) {
        case 'completed': return Colors.success;
        case 'pending': return Colors.warning;
        case 'cancelled':
        case 'disputed': return Colors.error;
        default: return Colors.textSecondary;
    }
}

function getStatusLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function TransactionItem({ tx }: { tx: Transaction }) {
    const displayAmount = tx.total_paid ?? tx.amount;

    return (
        <View style={styles.txItem}>
            <View style={styles.txIconWrap}>
                <Ionicons name="swap-horizontal-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.txInfo}>
                <View style={styles.txTopRow}>
                    <Text style={styles.txAmount}>+{formatCurrency(displayAmount)}</Text>
                    <Badge
                        label={getStatusLabel(tx.status)}
                        color={getStatusColor(tx.status)}
                    />
                </View>
                <View style={styles.txBottomRow}>
                    <Text style={styles.txDate}>{formatDate(tx.created_at)}</Text>
                    {tx.sport && (
                        <Badge
                            label={tx.sport}
                            color={Colors.textSecondary}
                            bgColor={Colors.surface}
                            size="sm"
                        />
                    )}
                </View>
            </View>
        </View>
    );
}

/* ─── How-it-works step ─── */
function StepItem({ number, text }: { number: number; text: string }) {
    return (
        <View style={styles.stepRow}>
            <View style={styles.stepCircle}>
                <Text style={styles.stepNumber}>{number}</Text>
            </View>
            <Text style={styles.stepText}>{text}</Text>
        </View>
    );
}

export default function PaymentMethodsScreen({ navigation }: any) {
    const { user } = useAuth();
    const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isTrainer = user?.role === 'trainer';
    const baseUrl = Config.appUrl;

    /* ─── Fetch Stripe Connect status from web API ─── */
    const fetchConnectStatus = useCallback(async () => {
        if (!user || !isTrainer) return;
        setError(null);
        try {
            const res = await fetch(`${baseUrl}/api/stripe/connect-status?userId=${user.id}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch status');
            setConnectStatus(data);
        } catch (err: unknown) {
            console.error('Error fetching connect status:', err);
            setError(err instanceof Error ? err.message : 'Could not load payment status');
        }
    }, [user, isTrainer, baseUrl]);

    /* ─── Fetch transactions ─── */
    const fetchTransactions = useCallback(async () => {
        if (!user) return;
        try {
            const idColumn = isTrainer ? 'trainer_id' : 'athlete_id';
            const { data: bookings } = await supabase
                .from('bookings')
                .select('id')
                .eq(idColumn, user.id);

            if (bookings && bookings.length > 0) {
                const bookingIds = bookings.map((b: any) => b.id);
                const { data, error } = await supabase
                    .from('payment_transactions')
                    .select('*')
                    .in('booking_id', bookingIds)
                    .order('created_at', { ascending: false })
                    .limit(20);
                if (error) throw error;
                setTransactions((data || []) as Transaction[]);
            } else {
                setTransactions([]);
            }
        } catch (err) {
            console.error('Error fetching transactions:', err);
        }
    }, [user, isTrainer]);

    /* ─── Initial load ─── */
    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            await Promise.all([fetchConnectStatus(), fetchTransactions()]);
            setIsLoading(false);
        };
        load();
    }, [fetchConnectStatus, fetchTransactions]);

    /* ─── Re-fetch when screen comes back into focus (after Stripe onboarding) ─── */
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            fetchConnectStatus();
            fetchTransactions();
        });
        return unsubscribe;
    }, [navigation, fetchConnectStatus, fetchTransactions]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchConnectStatus(), fetchTransactions()]);
        setRefreshing(false);
    };

    /* ─── Connect / Complete Setup handler ─── */
    const handleConnect = async () => {
        if (!user) return;
        setConnecting(true);
        setError(null);
        try {
            const res = await fetch(`${baseUrl}/api/stripe/connect`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, email: user.email }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to start onboarding');
            if (data.url) {
                await Linking.openURL(data.url);
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Something went wrong';
            Alert.alert('Connection Error', msg);
            setError(msg);
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
        return <LoadingScreen message="Loading payments..." />;
    }

    /* ─── Derived states (mirrors web logic) ─── */
    const isFullyConnected =
        connectStatus?.hasAccount && connectStatus?.onboardingComplete && connectStatus?.payoutsEnabled;
    const isPartial = connectStatus?.hasAccount && !connectStatus?.onboardingComplete;
    const isNotConnected = !connectStatus?.hasAccount;

    return (
        <ScreenWrapper
            refreshing={refreshing}
            onRefresh={onRefresh}
        >
            <ScreenHeader
                title="Payments"
                onBack={() => navigation.goBack()}
            />

            {/* ── ERROR BANNER ── */}
            {error && (
                <Animated.View entering={FadeInDown.duration(200)}>
                    <Card style={styles.errorCard}>
                        <View style={styles.errorRow}>
                            <Ionicons name="alert-circle" size={18} color={Colors.error} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.errorText}>{error}</Text>
                                <Pressable onPress={() => user && fetchConnectStatus()}>
                                    <Text style={styles.errorRetry}>Try again</Text>
                                </Pressable>
                            </View>
                        </View>
                    </Card>
                </Animated.View>
            )}

            {/* ── TRAINER: PAYOUT ACCOUNT ── */}
            {isTrainer ? (
                <Animated.View entering={FadeInDown.duration(250)} style={styles.section}>
                    <SectionHeader title="Payout Account" />

                    {/* ── FULLY CONNECTED ── */}
                    {isFullyConnected && (
                        <>
                            {/* Status header */}
                            <Card style={styles.connectedCard}>
                                <View style={styles.statusHeaderRow}>
                                    <View style={[styles.statusIconWrap, styles.statusIconGreen]}>
                                        <Ionicons name="shield-checkmark" size={26} color={Colors.success} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.statusTitle}>Payouts Enabled</Text>
                                        <Text style={styles.statusSubtitle}>
                                            Your bank account is connected and ready to receive payouts.
                                        </Text>
                                    </View>
                                </View>
                            </Card>

                            {/* Status badges row */}
                            <View style={styles.badgesRow}>
                                <View style={[styles.badgeCard, styles.badgeCardGreen]}>
                                    <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                                    <View>
                                        <Text style={styles.badgeLabel}>PAYOUTS</Text>
                                        <Text style={styles.badgeValue}>Enabled</Text>
                                    </View>
                                </View>
                                <View style={[styles.badgeCard, styles.badgeCardGreen]}>
                                    <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                                    <View>
                                        <Text style={styles.badgeLabel}>CHARGES</Text>
                                        <Text style={styles.badgeValue}>Enabled</Text>
                                    </View>
                                </View>
                            </View>

                            {/* Bank info */}
                            <Card style={styles.bankInfoCard}>
                                <View style={styles.bankInfoRow}>
                                    <Ionicons name="card-outline" size={18} color={Colors.textSecondary} />
                                    <View>
                                        <Text style={styles.badgeLabel}>BANK</Text>
                                        <Text style={styles.badgeValue}>
                                            {connectStatus.bankName ? `${connectStatus.bankName} ` : ''}
                                            {connectStatus.bankLast4 ? `****${connectStatus.bankLast4}` : 'Connected'}
                                        </Text>
                                    </View>
                                </View>
                            </Card>

                            {/* Stripe Dashboard link */}
                            {connectStatus.dashboardUrl && (
                                <Pressable
                                    style={({ pressed }) => [styles.dashboardLink, pressed && { opacity: 0.8 }]}
                                    onPress={() => Linking.openURL(connectStatus.dashboardUrl!)}
                                >
                                    <Ionicons name="open-outline" size={16} color={Colors.textSecondary} />
                                    <Text style={styles.dashboardLinkText}>Manage on Stripe Dashboard</Text>
                                </Pressable>
                            )}
                        </>
                    )}

                    {/* ── PARTIAL SETUP ── */}
                    {isPartial && (
                        <>
                            <Card style={styles.partialCard}>
                                <View style={styles.statusHeaderRow}>
                                    <View style={[styles.statusIconWrap, styles.statusIconAmber]}>
                                        <Ionicons name="alert-circle" size={26} color={Colors.warning} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.statusTitle}>Setup Incomplete</Text>
                                        <Text style={styles.statusSubtitle}>
                                            You started the setup but haven't finished. Complete it to receive payouts.
                                        </Text>
                                    </View>
                                </View>
                            </Card>

                            <Card style={styles.partialInfoCard}>
                                <Text style={styles.partialInfoTitle}>Almost there!</Text>
                                <Text style={styles.partialInfoText}>
                                    Your Stripe account was created but onboarding is not complete.
                                    You need to finish adding your bank details and identity verification.
                                </Text>
                            </Card>

                            <Button
                                title={connecting ? 'Redirecting...' : 'Complete Setup'}
                                onPress={handleConnect}
                                variant="primary"
                                icon="arrow-forward-outline"
                                loading={connecting}
                                disabled={connecting}
                            />
                        </>
                    )}

                    {/* ── NOT CONNECTED ── */}
                    {isNotConnected && (
                        <>
                            <Card style={styles.notConnectedCard}>
                                <View style={styles.statusHeaderRow}>
                                    <View style={[styles.statusIconWrap, styles.statusIconDefault]}>
                                        <Ionicons name="business-outline" size={26} color={Colors.textSecondary} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.statusTitle}>Bank Account Not Connected</Text>
                                        <Text style={styles.statusSubtitle}>
                                            Connect your bank account through Stripe to start receiving payouts.
                                        </Text>
                                    </View>
                                </View>
                            </Card>

                            {/* How it works */}
                            <Card>
                                <Text style={styles.howItWorksTitle}>How it works</Text>
                                <View style={styles.stepsContainer}>
                                    <StepItem number={1} text="Click the button below to connect via Stripe (our payment processor)." />
                                    <StepItem number={2} text="Stripe will ask for your bank details and verify your identity." />
                                    <StepItem number={3} text="Once set up, payouts from completed training sessions go directly to your bank." />
                                </View>
                            </Card>

                            <Button
                                title={connecting ? 'Redirecting to Stripe...' : 'Connect Bank Account'}
                                onPress={handleConnect}
                                variant="primary"
                                icon="business-outline"
                                loading={connecting}
                                disabled={connecting}
                            />

                            <Text style={styles.poweredByText}>
                                Powered by Stripe. Your banking details are never stored on our servers.
                            </Text>
                        </>
                    )}

                    {/* Fee breakdown: trainer keeps 100% */}
                    <Card style={styles.feeBreakdownCard}>
                        <View style={styles.feeHeaderRow}>
                            <Ionicons name="cash-outline" size={20} color={Colors.success} />
                            <Text style={styles.feeHeaderTitle}>You Keep 100%</Text>
                        </View>
                        <Text style={styles.feeHeaderSubtitle}>
                            Athletes cover all platform and processing fees. You receive your full rate.
                        </Text>
                        <View style={styles.feeDivider} />
                        <View style={styles.feeRow}>
                            <Text style={styles.feeRowLabel}>Session rate</Text>
                            <Text style={styles.feeRowValue}>100% to you</Text>
                        </View>
                        <View style={styles.feeRow}>
                            <Text style={styles.feeRowLabel}>AirTrainr platform fee (3%)</Text>
                            <Text style={styles.feeRowValueMuted}>Athlete pays</Text>
                        </View>
                        <View style={styles.feeRow}>
                            <Text style={styles.feeRowLabel}>Stripe processing (2.9% + $0.30)</Text>
                            <Text style={styles.feeRowValueMuted}>Athlete pays</Text>
                        </View>
                        <View style={styles.feeRow}>
                            <Text style={styles.feeRowLabel}>Sales tax (HST for CA)</Text>
                            <Text style={styles.feeRowValueMuted}>Athlete pays</Text>
                        </View>
                    </Card>

                    {/* Payout info strip */}
                    <Card style={styles.payoutInfoStrip}>
                        <View style={styles.payoutInfoRow}>
                            <View style={styles.payoutInfoItem}>
                                <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
                                <Text style={styles.payoutInfoText}>Payouts every 7 days</Text>
                            </View>
                            <View style={styles.payoutInfoItem}>
                                <Ionicons name="shield-checkmark-outline" size={16} color={Colors.textSecondary} />
                                <Text style={styles.payoutInfoText}>Secured by Stripe</Text>
                            </View>
                        </View>
                    </Card>
                </Animated.View>
            ) : (
                /* ── ATHLETE: payment method placeholder ── */
                <Animated.View entering={FadeInDown.duration(250)} style={styles.section}>
                    <SectionHeader title="Payment Method" />
                    <Card>
                        <View style={styles.comingSoonRow}>
                            <Ionicons name="card-outline" size={28} color={Colors.primary} />
                            <Text style={styles.comingSoonText}>
                                Payment methods will be available soon. We're integrating Stripe for secure payments.
                            </Text>
                        </View>
                    </Card>

                    <Pressable
                        style={({ pressed }) => [styles.addMethodButton, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                        onPress={handleAddPaymentMethod}
                        accessibilityLabel="Add Payment Method"
                    >
                        <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                        <Text style={styles.addMethodText}>Add Payment Method</Text>
                    </Pressable>
                </Animated.View>
            )}

            {/* ── Recent Transactions ── */}
            <View style={styles.section}>
                <SectionHeader title="Recent Transactions" />

                {transactions.length === 0 ? (
                    <Card>
                        <EmptyState
                            icon="receipt-outline"
                            title="No transactions yet"
                            description={
                                isTrainer
                                    ? 'Completed sessions will appear here once athletes pay.'
                                    : 'Your session payments will appear here.'
                            }
                        />
                    </Card>
                ) : (
                    <Card noPadding>
                        {transactions.map((tx, index) => (
                            <View key={tx.id}>
                                <TransactionItem tx={tx} />
                                {index < transactions.length - 1 && (
                                    <View style={styles.txDivider} />
                                )}
                            </View>
                        ))}
                    </Card>
                )}
            </View>

            {/* Trainer: bottom CTA if not connected */}
            {isTrainer && isNotConnected && (
                <Card variant="elevated" style={styles.stripeCta}>
                    <View style={styles.stripeCtaIcon}>
                        <Ionicons name="card-outline" size={24} color={Colors.primary} />
                    </View>
                    <Text style={styles.stripeCtaTitle}>Get Paid Faster</Text>
                    <Text style={styles.stripeCtaText}>
                        Connect your Stripe account to automatically receive payouts after each completed session. No delays, no hassle.
                    </Text>
                    <Button
                        title="Connect Bank Account"
                        onPress={handleConnect}
                        variant="primary"
                        icon="business-outline"
                        loading={connecting}
                        disabled={connecting}
                        fullWidth={false}
                    />
                </Card>
            )}
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    section: {
        gap: Spacing.md,
        marginBottom: Spacing.xl,
    },

    // Error banner
    errorCard: {
        borderColor: Colors.error + '44',
        marginBottom: Spacing.md,
    },
    errorRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.sm,
    },
    errorText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.error,
    },
    errorRetry: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.error,
        marginTop: 4,
        textDecorationLine: 'underline',
    },

    // Status header (shared)
    statusHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    statusIconWrap: {
        width: 52,
        height: 52,
        borderRadius: BorderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusIconGreen: {
        backgroundColor: Colors.success + '22',
    },
    statusIconAmber: {
        backgroundColor: Colors.warning + '22',
    },
    statusIconDefault: {
        backgroundColor: Colors.surface,
    },
    statusTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    statusSubtitle: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: 2,
        lineHeight: 20,
    },

    // Fully connected
    connectedCard: {
        borderColor: Colors.success + '44',
    },
    badgesRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    badgeCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
    },
    badgeCardGreen: {
        backgroundColor: Colors.success + '0D',
        borderColor: Colors.success + '28',
    },
    badgeLabel: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.success,
        letterSpacing: 1,
    },
    badgeValue: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
    },
    bankInfoCard: {},
    bankInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    dashboardLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
        alignSelf: 'flex-start',
    },
    dashboardLinkText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.textSecondary,
    },

    // Partial setup
    partialCard: {
        borderColor: Colors.warning + '44',
    },
    partialInfoCard: {
        backgroundColor: Colors.warning + '0D',
        borderColor: Colors.warning + '28',
        borderWidth: 1,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
    },
    partialInfoTitle: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.warning,
        marginBottom: 4,
    },
    partialInfoText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 20,
    },

    // Not connected
    notConnectedCard: {},
    howItWorksTitle: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: Spacing.md,
    },
    stepsContainer: {
        gap: Spacing.md,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.md,
    },
    stepCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 1,
    },
    stepNumber: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.textSecondary,
    },
    stepText: {
        flex: 1,
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 20,
    },
    poweredByText: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary + '80',
    },

    // Fee breakdown (trainer keeps 100%)
    feeBreakdownCard: {
        marginBottom: Spacing.md,
    },
    feeHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.xs,
    },
    feeHeaderTitle: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    feeHeaderSubtitle: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        lineHeight: 18,
    },
    feeDivider: {
        height: 1,
        backgroundColor: Colors.border,
        marginVertical: Spacing.md,
    },
    feeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.xs,
    },
    feeRowLabel: {
        fontSize: FontSize.sm,
        color: Colors.text,
    },
    feeRowValue: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.success,
    },
    feeRowValueMuted: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
    },

    // Payout info strip
    payoutInfoStrip: {
        paddingVertical: Spacing.md,
    },
    payoutInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
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

    // Coming soon (athlete)
    comingSoonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    comingSoonText: {
        flex: 1,
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 20,
    },

    // Add method
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
    txItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        padding: Spacing.lg,
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
        gap: Spacing.xs,
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
    txBottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    txDate: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    txDivider: {
        height: 1,
        backgroundColor: Colors.border,
        marginHorizontal: Spacing.lg,
    },

    // Stripe CTA
    stripeCta: {
        alignItems: 'center',
        gap: Spacing.md,
        marginBottom: Spacing.xxl,
        borderColor: Colors.borderActive,
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
});

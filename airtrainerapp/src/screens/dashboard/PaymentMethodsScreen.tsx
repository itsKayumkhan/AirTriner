import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Alert,
    ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';
import { ScreenWrapper, ScreenHeader, Card, Badge, EmptyState, LoadingScreen, Button, SectionHeader } from '../../components/ui';

const API_URL = 'https://api.airtrainr.com/api/v1';

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

    const handleConnectStripe = async () => {
        setConnecting(true);
        try {
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
                    fetchTransactions();
                }
            } else {
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
        return <LoadingScreen message="Loading payments..." />;
    }

    const stripeConnected = !!(trainerProfile?.stripe_account_id);

    return (
        <ScreenWrapper
            refreshing={refreshing}
            onRefresh={onRefresh}
        >
            <ScreenHeader
                title="Payments"
                onBack={() => navigation.goBack()}
            />

            {/* TRAINER: Payout Account - Stripe connect status as hero card */}
            {isTrainer ? (
                <Animated.View entering={FadeInDown.duration(250)} style={styles.section}>
                    <SectionHeader title="Payout Account" />

                    {stripeConnected ? (
                        <Card style={styles.stripeConnectedCard}>
                            <View style={styles.stripeConnectedRow}>
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
                                <Badge
                                    label="Active"
                                    color={Colors.success}
                                    bgColor={Colors.successLight}
                                    dot
                                />
                            </View>
                        </Card>
                    ) : (
                        <Card style={styles.stripeWarningCard}>
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
                            <Button
                                title="Connect Stripe Account"
                                onPress={handleConnectStripe}
                                variant="primary"
                                icon="link-outline"
                                loading={connecting}
                                disabled={connecting}
                            />
                        </Card>
                    )}

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

            {/* Recent Transactions */}
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

            {/* Trainer: Connect Stripe CTA if not connected */}
            {isTrainer && !stripeConnected && (
                <Card variant="elevated" style={styles.stripeCta}>
                    <View style={styles.stripeCtaIcon}>
                        <Ionicons name="card-outline" size={24} color={Colors.primary} />
                    </View>
                    <Text style={styles.stripeCtaTitle}>Get Paid Faster</Text>
                    <Text style={styles.stripeCtaText}>
                        Connect your Stripe account to automatically receive payouts after each completed session. No delays, no hassle.
                    </Text>
                    <Button
                        title="Connect Stripe Account"
                        onPress={handleConnectStripe}
                        variant="primary"
                        icon="link-outline"
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

    // Stripe Connected
    stripeConnectedCard: {
        borderColor: Colors.success + '44',
    },
    stripeConnectedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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
        backgroundColor: Colors.successLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
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

    // Stripe Warning
    stripeWarningCard: {
        borderColor: Colors.warning + '44',
        gap: Spacing.lg,
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

    // Coming soon
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

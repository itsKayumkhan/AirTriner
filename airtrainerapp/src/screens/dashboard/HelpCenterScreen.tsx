import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';
import { ScreenWrapper, ScreenHeader, Card, Button, SectionHeader } from '../../components/ui';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQ_ITEMS = [
    {
        q: 'How do I book a session?',
        a: 'Find a trainer in Discover, view their profile, tap Book Session. The trainer confirms within 24 hours and you\'ll receive a notification once confirmed.',
    },
    {
        q: 'How do payments work?',
        a: 'Payments are processed securely via Stripe when the trainer confirms your booking. Funds are held in escrow and released to the trainer after the session is completed.',
    },
    {
        q: 'Can I cancel a booking?',
        a: 'You can cancel up to 24 hours before your session for a full refund. Late cancellations or no-shows may incur a fee at the trainer\'s discretion.',
    },
    {
        q: 'How do I become verified?',
        a: 'Go to Profile -> Verification and complete all required steps including ID submission. Our team reviews your application within 24-48 hours and notifies you of the result.',
    },
    {
        q: 'What is Founding 50?',
        a: 'The first 50 trainers to join AirTrainr receive a free 6-month Pro subscription and an exclusive Founding 50 badge displayed on their profile to build early credibility.',
    },
    {
        q: 'How to set availability?',
        a: 'Navigate to Profile -> Availability, then select your available days and time slots. Athletes can only request bookings during the windows you have marked as available.',
    },
    {
        q: 'How are ratings calculated?',
        a: 'Your rating is the average of all reviews submitted by athletes after completed sessions. Only verified completed sessions count toward your rating.',
    },
    {
        q: 'How to message a trainer?',
        a: 'You can message a trainer directly from their profile page, or access the conversation thread through any active booking in the Bookings tab.',
    },
];

export default function HelpCenterScreen({ navigation }: any) {
    const [expanded, setExpanded] = useState<number | null>(null);

    const toggle = (index: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(prev => (prev === index ? null : index));
    };

    return (
        <ScreenWrapper>
            <ScreenHeader title="Help Center" onBack={() => navigation.goBack()} />

            {/* Hero */}
            <Animated.View entering={FadeInDown.duration(250)}>
                <Card style={styles.heroCard}>
                    <View style={styles.heroIconWrapper}>
                        <Ionicons name="help-buoy-outline" size={36} color={Colors.primary} />
                    </View>
                    <Text style={styles.heroTitle}>How can we help?</Text>
                    <Text style={styles.heroSubtitle}>Tap a question below to see the answer</Text>
                </Card>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(250).delay(30)}>
                <SectionHeader title="Frequently Asked Questions" />
            </Animated.View>

            {/* FAQ accordion cards with smooth expand */}
            {FAQ_ITEMS.map((item, index) => {
                const isOpen = expanded === index;
                return (
                    <Animated.View
                        key={index}
                        entering={FadeInDown.duration(200).delay(30 + index * 30)}
                    >
                        <Pressable
                            onPress={() => toggle(index)}
                            accessibilityLabel={item.q}
                            accessibilityRole="button"
                            style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                        >
                            <Card
                                style={isOpen ? { ...styles.faqCard, borderColor: Colors.borderActive } : styles.faqCard}
                            >
                                <View style={styles.faqRow}>
                                    <View style={[styles.faqNumberBadge, isOpen && styles.faqNumberBadgeOpen]}>
                                        <Text style={[styles.faqNumber, isOpen && styles.faqNumberOpen]}>
                                            {index + 1}
                                        </Text>
                                    </View>
                                    <Text style={[styles.faqQuestion, isOpen && styles.faqQuestionOpen]}>
                                        {item.q}
                                    </Text>
                                    <View style={[styles.chevronWrapper, isOpen && styles.chevronWrapperOpen]}>
                                        <Ionicons
                                            name="chevron-down"
                                            size={16}
                                            color={isOpen ? Colors.primary : Colors.textTertiary}
                                        />
                                    </View>
                                </View>
                                {isOpen && (
                                    <View style={styles.faqAnswerWrapper}>
                                        <View style={styles.faqDivider} />
                                        <Text style={styles.faqAnswer}>{item.a}</Text>
                                    </View>
                                )}
                            </Card>
                        </Pressable>
                    </Animated.View>
                );
            })}

            {/* Still need help */}
            <Animated.View entering={FadeInDown.duration(250).delay(30 + FAQ_ITEMS.length * 80)}>
                <Card style={styles.ctaCard}>
                    <View style={styles.ctaIconWrapper}>
                        <Ionicons name="chatbubble-ellipses-outline" size={22} color={Colors.primary} />
                    </View>
                    <View style={styles.ctaTextBlock}>
                        <Text style={styles.ctaTitle}>Still need help?</Text>
                        <Text style={styles.ctaSubtitle}>Our support team is ready to assist you</Text>
                    </View>
                    <Button
                        title="Contact"
                        onPress={() => navigation.navigate('Support')}
                        size="sm"
                        fullWidth={false}
                    />
                </Card>
            </Animated.View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    heroCard: {
        alignItems: 'center' as const,
        paddingVertical: Spacing.xxxl,
        paddingHorizontal: Spacing.xxl,
        marginBottom: Spacing.xxl,
        gap: Spacing.sm,
    },
    heroIconWrapper: {
        width: 72,
        height: 72,
        borderRadius: BorderRadius.xl,
        backgroundColor: Colors.primaryGlow,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    heroTitle: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    heroSubtitle: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        textAlign: 'center',
    },
    faqCard: {
        marginBottom: Spacing.sm,
    },
    faqRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    faqNumberBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    faqNumberBadgeOpen: {
        backgroundColor: Colors.primaryGlow,
    },
    faqNumber: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.textTertiary,
    },
    faqNumberOpen: {
        color: Colors.primary,
    },
    faqQuestion: {
        flex: 1,
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
        marginRight: Spacing.md,
        lineHeight: 22,
    },
    faqQuestionOpen: {
        color: Colors.primary,
    },
    chevronWrapper: {
        width: 32,
        height: 32,
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chevronWrapperOpen: {
        backgroundColor: Colors.primaryGlow,
        transform: [{ rotate: '180deg' }],
    },
    faqAnswerWrapper: {
        marginTop: Spacing.md,
    },
    faqDivider: {
        height: 1,
        backgroundColor: Colors.border,
        marginBottom: Spacing.md,
    },
    faqAnswer: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 22,
        paddingLeft: 40,
    },
    ctaCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.xl,
        backgroundColor: Colors.primaryGlow,
        borderColor: Colors.borderActive,
        gap: Spacing.md,
    },
    ctaIconWrapper: {
        width: 44,
        height: 44,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primaryMuted,
        justifyContent: 'center',
        alignItems: 'center',
    },
    ctaTextBlock: {
        flex: 1,
    },
    ctaTitle: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    ctaSubtitle: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        marginTop: 2,
    },
});

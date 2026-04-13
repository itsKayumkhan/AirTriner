import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Layout} from '../../theme';

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
        a: 'Go to Profile → Verification and complete all required steps including ID submission. Our team reviews your application within 24–48 hours and notifies you of the result.',
    },
    {
        q: 'What is Founding 50?',
        a: 'The first 50 trainers to join AirTrainr receive a free 6-month Pro subscription and an exclusive Founding 50 badge displayed on their profile to build early credibility.',
    },
    {
        q: 'How to set availability?',
        a: 'Navigate to Profile → Availability, then select your available days and time slots. Athletes can only request bookings during the windows you have marked as available.',
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
        setExpanded(prev => (prev === index ? null : index));
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Help Center</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
                {/* Hero card */}
                <View style={styles.heroCard}>
                    <View style={styles.heroIconWrapper}>
                        <Ionicons name="help-buoy-outline" size={36} color={Colors.primary} />
                    </View>
                    <Text style={styles.heroTitle}>How can we help?</Text>
                    <Text style={styles.heroSubtitle}>Tap a question below to see the answer</Text>
                </View>

                <Text style={styles.sectionLabel}>Frequently Asked Questions</Text>

                {/* FAQ accordion */}
                {FAQ_ITEMS.map((item, index) => {
                    const isOpen = expanded === index;
                    return (
                        <TouchableOpacity
                            key={index}
                            style={[styles.faqCard, isOpen && styles.faqCardOpen]}
                            onPress={() => toggle(index)}
                            activeOpacity={0.75}
                        >
                            <View style={styles.faqRow}>
                                <Text style={styles.faqQuestion}>{item.q}</Text>
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
                        </TouchableOpacity>
                    );
                })}

                {/* Still need help */}
                <View style={styles.ctaCard}>
                    <View style={styles.ctaIconWrapper}>
                        <Ionicons name="chatbubble-ellipses-outline" size={22} color={Colors.primary} />
                    </View>
                    <View style={styles.ctaTextBlock}>
                        <Text style={styles.ctaTitle}>Still need help?</Text>
                        <Text style={styles.ctaSubtitle}>Our support team is ready to assist you</Text>
                    </View>
                    <TouchableOpacity style={styles.ctaButton} onPress={() => navigation.navigate('Support')}>
                        <Text style={styles.ctaButtonText}>Contact</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 48 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.xxl,
        paddingTop: Layout.headerTopPadding,
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
    contentContainer: {
        padding: Spacing.xxl,
    },
    heroCard: {
        alignItems: 'center',
        paddingVertical: Spacing.xxxl,
        paddingHorizontal: Spacing.xxl,
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: Spacing.xxxl,
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
    sectionLabel: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: Spacing.md,
    },
    faqCard: {
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.md,
        padding: Spacing.lg,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    faqCardOpen: {
        borderColor: Colors.borderActive,
    },
    faqRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    faqQuestion: {
        flex: 1,
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
        marginRight: Spacing.md,
        lineHeight: 22,
    },
    chevronWrapper: {
        width: 28,
        height: 28,
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
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        lineHeight: 22,
    },
    ctaCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        backgroundColor: Colors.primaryGlow,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.borderActive,
        marginTop: Spacing.xl,
        gap: Spacing.md,
    },
    ctaIconWrapper: {
        width: 44,
        height: 44,
        borderRadius: BorderRadius.md,
        backgroundColor: 'rgba(69, 208, 255, 0.2)',
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
    ctaButton: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.md,
    },
    ctaButtonText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: '#fff',
    },
});

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';

type Section = {
    heading: string;
    body: string;
};

const SECTIONS: Section[] = [
    {
        heading: 'Acceptance of Terms',
        body: 'By accessing or using the AirTrainr platform you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service. AirTrainr reserves the right to update these Terms at any time with notice provided in the app.',
    },
    {
        heading: 'Use of Platform',
        body: 'AirTrainr is a sports training marketplace that connects athletes with certified trainers. The platform may only be used for lawful purposes and in accordance with these Terms. Misuse of platform features may result in immediate account suspension.',
    },
    {
        heading: 'User Accounts',
        body: 'You must be at least 18 years of age to create a primary account. You are responsible for maintaining the confidentiality of your credentials and all activity that occurs under your account. Notify us immediately of any unauthorized access at support@airtrainr.com.',
    },
    {
        heading: 'Trainer Verification',
        body: 'Trainers must complete identity verification before accepting bookings, including submission of valid government-issued ID. Certifications and qualifications listed on a trainer profile must be genuine and verifiable. Our team reviews all verification submissions within 24–48 hours.',
    },
    {
        heading: 'Bookings & Payments',
        body: 'All payments are processed securely through Stripe. A platform fee is applied to each booking to cover payment processing and platform maintenance. Funds are held in escrow and released to the trainer after the session is completed and confirmed.',
    },
    {
        heading: 'Cancellation Policy',
        body: 'Athletes may cancel a booking up to 24 hours before the scheduled session for a full refund. Cancellations made within 24 hours or no-shows may incur a fee at the trainer\'s discretion. Trainers who cancel sessions repeatedly may have their accounts reviewed.',
    },
    {
        heading: 'Prohibited Conduct',
        body: 'Users may not harass, threaten, or engage in abusive conduct toward other users on the platform. Providing false information, manipulating ratings, or attempting to circumvent platform fees is strictly prohibited. Violations will result in permanent account termination.',
    },
    {
        heading: 'Limitation of Liability',
        body: 'AirTrainr is a marketplace platform and is not responsible for the quality of training services provided by independent trainers. AirTrainr is not liable for any injuries, losses, or damages sustained during or related to training sessions. Users acknowledge that physical training involves inherent risks.',
    },
    {
        heading: 'Contact Us',
        body: 'For questions or concerns about these Terms of Service, please contact our legal team at legal@airtrainr.com. You may also reach us through the Contact Support section within the app and we will respond within 2–4 business hours.',
    },
];

export default function TermsScreen({ navigation }: any) {
    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Terms of Service</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
                {/* Intro block */}
                <View style={styles.introCard}>
                    <View style={styles.introIconWrapper}>
                        <Ionicons name="document-text-outline" size={28} color={Colors.primary} />
                    </View>
                    <View style={styles.introTextBlock}>
                        <Text style={styles.introTitle}>Terms of Service</Text>
                        <Text style={styles.introSubtitle}>Last updated: March 2026</Text>
                    </View>
                </View>

                <Text style={styles.introNote}>
                    Please read these terms carefully before using the AirTrainr platform. By creating an account you agree to be bound by the following conditions.
                </Text>

                {/* Sections */}
                {SECTIONS.map((section, index) => (
                    <View key={index} style={styles.sectionCard}>
                        <View style={styles.sectionNumberBadge}>
                            <Text style={styles.sectionNumber}>{index + 1}</Text>
                        </View>
                        <View style={styles.sectionContent}>
                            <Text style={styles.sectionHeading}>{section.heading}</Text>
                            <Text style={styles.sectionBody}>{section.body}</Text>
                        </View>
                    </View>
                ))}

                {/* Footer */}
                <View style={styles.footerCard}>
                    <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary} />
                    <Text style={styles.footerText}>
                        Questions? Email{' '}
                        <Text style={styles.footerLink}>legal@airtrainr.com</Text>
                    </Text>
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
    contentContainer: {
        padding: Spacing.xxl,
    },
    introCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: Spacing.lg,
    },
    introIconWrapper: {
        width: 52,
        height: 52,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primaryGlow,
        justifyContent: 'center',
        alignItems: 'center',
    },
    introTextBlock: {
        flex: 1,
    },
    introTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    introSubtitle: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    introNote: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 20,
        marginBottom: Spacing.xxl,
    },
    sectionCard: {
        flexDirection: 'row',
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.md,
        padding: Spacing.lg,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: Spacing.md,
    },
    sectionNumberBadge: {
        width: 28,
        height: 28,
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.primaryGlow,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 1,
        flexShrink: 0,
    },
    sectionNumber: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },
    sectionContent: {
        flex: 1,
    },
    sectionHeading: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    sectionBody: {
        fontSize: FontSize.sm,
        color: 'rgba(255,255,255,0.7)',
        lineHeight: 22,
    },
    footerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        marginTop: Spacing.xl,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        backgroundColor: Colors.primaryGlow,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.borderActive,
    },
    footerText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    footerLink: {
        color: Colors.primary,
        fontWeight: FontWeight.semibold,
    },
});

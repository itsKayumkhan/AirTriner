import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';

type Section = {
    heading: string;
    icon: keyof typeof Ionicons.glyphMap;
    body: string;
};

const SECTIONS: Section[] = [
    {
        heading: 'Information We Collect',
        icon: 'person-circle-outline',
        body: 'We collect information you provide directly such as your name, email, date of birth, phone number, and sports preferences. For trainers we additionally collect certifications, hourly rates, and identity verification documents. We also automatically collect device information, IP address, and app usage data.',
    },
    {
        heading: 'How We Use It',
        icon: 'settings-outline',
        body: 'We use your information to provide and improve our services, match athletes with nearby trainers, and process payments through Stripe. We also use it to send booking and session notifications, verify trainer identities, and enforce our Terms of Service.',
    },
    {
        heading: 'Information Sharing',
        icon: 'share-social-outline',
        body: 'We share limited profile data with trainers or athletes you interact with to facilitate bookings. Payment data is shared with Stripe for processing, and identity data with verification partners for trainers. We never sell your personal information to third parties for marketing purposes.',
    },
    {
        heading: 'Data Security',
        icon: 'lock-closed-outline',
        body: 'We implement industry-standard security including encryption at rest and in transit, JWT-based authentication, and regular security audits. All payment data is processed by Stripe (PCI-DSS compliant) and is never stored on our servers.',
    },
    {
        heading: 'Your Rights',
        icon: 'hand-right-outline',
        body: 'You have the right to access, correct, or delete your personal data at any time. You may also export your data, restrict processing, or opt out of marketing communications. To exercise any of these rights, contact us at privacy@airtrainr.com.',
    },
    {
        heading: 'Cookies',
        icon: 'globe-outline',
        body: 'Our mobile app uses local storage for authentication tokens and user preferences, not browser cookies. We use analytics tools to understand usage patterns and improve the experience. You can control tracking permissions through your device settings at any time.',
    },
    {
        heading: "Children's Privacy",
        icon: 'shield-outline',
        body: 'AirTrainr is not intended for users under 18. Sub-accounts for minors are managed entirely by the parent or guardian who holds the primary account. We do not knowingly collect personal information from children under 13.',
    },
    {
        heading: 'Policy Changes',
        icon: 'refresh-outline',
        body: 'We may update this Privacy Policy from time to time to reflect changes in our practices or applicable law. Material changes will be communicated through an in-app notification or email before taking effect. Continued use of the Service after changes constitutes acceptance.',
    },
    {
        heading: 'Contact Us',
        icon: 'mail-outline',
        body: 'For privacy-related questions or concerns, contact our Data Protection Officer at privacy@airtrainr.com. You may also reach us through the Contact Support section within the app and we will respond within 2–4 business hours.',
    },
];

export default function PrivacyScreen({ navigation }: any) {
    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Privacy Policy</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
                {/* Intro block */}
                <View style={styles.introCard}>
                    <View style={styles.introIconWrapper}>
                        <Ionicons name="shield-checkmark" size={28} color={Colors.primary} />
                    </View>
                    <View style={styles.introTextBlock}>
                        <Text style={styles.introTitle}>Privacy Policy</Text>
                        <Text style={styles.introSubtitle}>Last updated: March 2026</Text>
                    </View>
                </View>

                <Text style={styles.introNote}>
                    Your privacy matters to us. This policy explains what data we collect, how we use it, and the rights you have over your personal information.
                </Text>

                {/* Sections */}
                {SECTIONS.map((section, index) => (
                    <View key={index} style={styles.sectionCard}>
                        <View style={styles.sectionIconWrapper}>
                            <Ionicons name={section.icon} size={18} color={Colors.primary} />
                        </View>
                        <View style={styles.sectionContent}>
                            <Text style={styles.sectionHeading}>{section.heading}</Text>
                            <Text style={styles.sectionBody}>{section.body}</Text>
                        </View>
                    </View>
                ))}

                {/* Footer */}
                <View style={styles.footerCard}>
                    <Ionicons name="lock-closed-outline" size={20} color={Colors.primary} />
                    <Text style={styles.footerText}>
                        Questions? Email{' '}
                        <Text style={styles.footerLink}>privacy@airtrainr.com</Text>
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
    sectionIconWrapper: {
        width: 36,
        height: 36,
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.primaryGlow,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 1,
        flexShrink: 0,
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

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Layout} from '../../theme';

type ContactItem = {
    label: string;
    value: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    iconBg: string;
    onPress: () => void;
};

const CONTACTS: ContactItem[] = [
    {
        label: 'Email',
        value: 'support@airtrainr.com',
        icon: 'mail',
        iconColor: Colors.primary,
        iconBg: Colors.primaryGlow,
        onPress: () => Linking.openURL('mailto:support@airtrainr.com'),
    },
    {
        label: 'WhatsApp',
        value: 'Chat with us',
        icon: 'logo-whatsapp',
        iconColor: '#25D366',
        iconBg: 'rgba(37, 211, 102, 0.12)',
        onPress: () => Linking.openURL('https://wa.me/1234567890'),
    },
    {
        label: 'Twitter / X',
        value: '@AirTrainr',
        icon: 'logo-twitter',
        iconColor: Colors.primary,
        iconBg: Colors.primaryGlow,
        onPress: () => Linking.openURL('https://twitter.com/airtrainr'),
    },
    {
        label: 'Instagram',
        value: '@AirTrainr',
        icon: 'logo-instagram',
        iconColor: '#E1306C',
        iconBg: 'rgba(225, 48, 108, 0.12)',
        onPress: () => Linking.openURL('https://instagram.com/airtrainr'),
    },
    {
        label: 'Facebook',
        value: 'AirTrainr',
        icon: 'logo-facebook',
        iconColor: '#1877F2',
        iconBg: 'rgba(24, 119, 242, 0.12)',
        onPress: () => Linking.openURL('https://facebook.com/airtrainr'),
    },
];

export default function SupportScreen({ navigation }: any) {
    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Contact Support</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
                {/* Hero */}
                <View style={styles.heroCard}>
                    <View style={styles.heroIconWrapper}>
                        <Ionicons name="help-circle" size={36} color={Colors.primary} />
                    </View>
                    <Text style={styles.heroTitle}>We're here to help</Text>
                    <Text style={styles.heroSubtitle}>Choose a channel below and we'll get back to you as soon as possible</Text>
                </View>

                <Text style={styles.sectionLabel}>Reach Us On</Text>

                {/* Contact cards */}
                {CONTACTS.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        style={styles.contactCard}
                        onPress={item.onPress}
                        activeOpacity={0.75}
                    >
                        <View style={[styles.contactIconCircle, { backgroundColor: item.iconBg }]}>
                            <Ionicons name={item.icon} size={22} color={item.iconColor} />
                        </View>
                        <View style={styles.contactTextBlock}>
                            <Text style={styles.contactLabel}>{item.label}</Text>
                            <Text style={styles.contactValue}>{item.value}</Text>
                        </View>
                        <View style={styles.contactChevron}>
                            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                        </View>
                    </TouchableOpacity>
                ))}

                {/* Response note */}
                <View style={styles.noteCard}>
                    <Ionicons name="time-outline" size={16} color={Colors.primary} />
                    <Text style={styles.noteText}>We respond within 2–4 business hours</Text>
                </View>

                {/* FAQ shortcut */}
                <View style={styles.faqBanner}>
                    <View style={styles.faqBannerText}>
                        <Text style={styles.faqBannerTitle}>Looking for quick answers?</Text>
                        <Text style={styles.faqBannerSubtitle}>Browse our Help Center for common questions</Text>
                    </View>
                    <TouchableOpacity style={styles.faqButton} onPress={() => navigation.navigate('HelpCenter')}>
                        <Text style={styles.faqButtonText}>FAQs</Text>
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
        lineHeight: 20,
    },
    sectionLabel: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: Spacing.md,
    },
    contactCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.md,
        padding: Spacing.lg,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: Spacing.md,
    },
    contactIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    contactTextBlock: {
        flex: 1,
    },
    contactLabel: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
    },
    contactValue: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    contactChevron: {
        width: 28,
        height: 28,
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    noteCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        marginTop: Spacing.lg,
        marginBottom: Spacing.xl,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        backgroundColor: Colors.primaryGlow,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.borderActive,
    },
    noteText: {
        fontSize: FontSize.sm,
        color: Colors.primary,
        fontWeight: FontWeight.medium,
    },
    faqBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: Spacing.md,
    },
    faqBannerText: {
        flex: 1,
    },
    faqBannerTitle: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    faqBannerSubtitle: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        marginTop: 2,
    },
    faqButton: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.md,
    },
    faqButtonText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: '#fff',
    },
});

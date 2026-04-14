import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';
import { ScreenWrapper, ScreenHeader, Card, Button, SectionHeader } from '../../components/ui';

type ContactItem = {
    label: string;
    value: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconColor: string;
    bgColor: string;
    onPress: () => void;
};

const CONTACTS: ContactItem[] = [
    {
        label: 'Email',
        value: 'support@airtrainr.com',
        icon: 'mail',
        iconColor: Colors.primary,
        bgColor: Colors.primaryGlow,
        onPress: () => Linking.openURL('mailto:support@airtrainr.com'),
    },
    {
        label: 'WhatsApp',
        value: 'Chat with us',
        icon: 'logo-whatsapp',
        iconColor: '#25D366',
        bgColor: 'rgba(37, 211, 102, 0.12)',
        onPress: () => Linking.openURL('https://wa.me/1234567890'),
    },
    {
        label: 'Twitter / X',
        value: '@AirTrainr',
        icon: 'logo-twitter',
        iconColor: Colors.primary,
        bgColor: Colors.primaryGlow,
        onPress: () => Linking.openURL('https://twitter.com/airtrainr'),
    },
    {
        label: 'Instagram',
        value: '@AirTrainr',
        icon: 'logo-instagram',
        iconColor: '#E1306C',
        bgColor: 'rgba(225, 48, 108, 0.12)',
        onPress: () => Linking.openURL('https://instagram.com/airtrainr'),
    },
    {
        label: 'Facebook',
        value: 'AirTrainr',
        icon: 'logo-facebook',
        iconColor: '#1877F2',
        bgColor: 'rgba(24, 119, 242, 0.12)',
        onPress: () => Linking.openURL('https://facebook.com/airtrainr'),
    },
];

export default function SupportScreen({ navigation }: any) {
    return (
        <ScreenWrapper>
            <ScreenHeader
                title="Contact Support"
                onBack={() => navigation.goBack()}
            />

            {/* Hero */}
            <Animated.View entering={FadeInDown.duration(250)}>
                <Card style={styles.heroCard}>
                    <View style={styles.heroIconWrapper}>
                        <Ionicons name="help-circle" size={36} color={Colors.primary} />
                    </View>
                    <Text style={styles.heroTitle}>We're here to help</Text>
                    <Text style={styles.heroSubtitle}>
                        Choose a channel below and we'll get back to you as soon as possible
                    </Text>
                </Card>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(250).delay(30)}>
                <SectionHeader title="Reach Us On" />
            </Animated.View>

            {/* Contact options as large tappable cards with icons */}
            <View style={styles.contactGrid}>
                {CONTACTS.map((item, index) => (
                    <Animated.View
                        key={index}
                        entering={FadeInDown.duration(200).delay(30 + index * 30)}
                    >
                        <Pressable
                            onPress={item.onPress}
                            accessibilityLabel={`Contact via ${item.label}: ${item.value}`}
                            style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                        >
                            <Card style={styles.contactCard}>
                                <View style={[styles.contactIconWrap, { backgroundColor: item.bgColor }]}>
                                    <Ionicons name={item.icon} size={24} color={item.iconColor} />
                                </View>
                                <View style={styles.contactTextWrap}>
                                    <Text style={styles.contactLabel}>{item.label}</Text>
                                    <Text style={styles.contactValue}>{item.value}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                            </Card>
                        </Pressable>
                    </Animated.View>
                ))}
            </View>

            {/* Response note */}
            <Animated.View entering={FadeInDown.duration(250).delay(30 + CONTACTS.length * 100)}>
                <Card variant="outlined" style={styles.noteCard}>
                    <View style={styles.noteRow}>
                        <Ionicons name="time-outline" size={16} color={Colors.primary} />
                        <Text style={styles.noteText}>We respond within 2-4 business hours</Text>
                    </View>
                </Card>
            </Animated.View>

            {/* FAQ shortcut */}
            <Animated.View entering={FadeInDown.duration(250).delay(300 + CONTACTS.length * 100)}>
                <Card style={styles.faqBanner}>
                    <View style={styles.faqBannerContent}>
                        <View style={styles.faqBannerText}>
                            <Text style={styles.faqBannerTitle}>Looking for quick answers?</Text>
                            <Text style={styles.faqBannerSubtitle}>Browse our Help Center for common questions</Text>
                        </View>
                        <Button
                            title="FAQs"
                            onPress={() => navigation.navigate('HelpCenter')}
                            variant="primary"
                            size="sm"
                            fullWidth={false}
                        />
                    </View>
                </Card>
            </Animated.View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    heroCard: {
        alignItems: 'center',
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
        lineHeight: 20,
    },

    // Large tappable contact cards
    contactGrid: {
        gap: Spacing.md,
        marginBottom: Spacing.lg,
    },
    contactCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.lg,
        minHeight: 68,
        ...Shadows.small,
    },
    contactIconWrap: {
        width: 48,
        height: 48,
        borderRadius: BorderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    contactTextWrap: {
        flex: 1,
    },
    contactLabel: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    contactValue: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginTop: 2,
    },

    noteCard: {
        marginBottom: Spacing.xl,
        borderColor: Colors.borderActive,
        backgroundColor: Colors.primaryMuted,
    },
    noteRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
    },
    noteText: {
        fontSize: FontSize.sm,
        color: Colors.primary,
        fontWeight: FontWeight.medium,
    },
    faqBanner: {
        marginBottom: Spacing.xxl,
    },
    faqBannerContent: {
        flexDirection: 'row',
        alignItems: 'center',
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
});

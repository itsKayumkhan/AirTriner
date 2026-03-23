import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';

export default function PrivacyScreen({ navigation }: any) {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Privacy Policy</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
                <Text style={styles.updated}>Last Updated: February 2026</Text>

                <Text style={styles.sectionTitle}>1. Information We Collect</Text>
                <Text style={styles.paragraph}>
                    We collect information you provide directly: name, email, date of birth, phone number, location, sports preferences, and profile information. For trainers, we also collect certifications, hourly rates, and identity verification documents. We automatically collect device information, IP address, app usage data, and location data when enabled.
                </Text>

                <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
                <Text style={styles.paragraph}>
                    We use your information to: provide and improve our services; match athletes with nearby trainers using geospatial data; process payments through Stripe; send notifications about bookings and messages; verify trainer identities; enforce our Terms of Service; and communicate important updates.
                </Text>

                <Text style={styles.sectionTitle}>3. Information Sharing</Text>
                <Text style={styles.paragraph}>
                    We share your information with: trainers/athletes you interact with (limited profile data); Stripe for payment processing; identity verification services (for trainers); law enforcement when required by law. We never sell your personal information to third parties for marketing purposes.
                </Text>

                <Text style={styles.sectionTitle}>4. Data Security</Text>
                <Text style={styles.paragraph}>
                    We implement industry-standard security measures including encryption at rest and in transit, secure authentication with JWT tokens, rate limiting, and regular security audits. All payment data is processed by Stripe (PCI-DSS compliant) and is never stored on our servers.
                </Text>

                <Text style={styles.sectionTitle}>5. Location Data</Text>
                <Text style={styles.paragraph}>
                    Our platform uses location data to match athletes with nearby trainers. We collect approximate location (city/state) from your profile and precise location only when you explicitly enable location services. You can disable location services at any time through your device settings.
                </Text>

                <Text style={styles.sectionTitle}>6. Data Retention</Text>
                <Text style={styles.paragraph}>
                    We retain your data for as long as your account is active. Deleted account data is purged within 30 days, except where required by law (e.g., payment records retained for 7 years). You can request data export or deletion at any time.
                </Text>

                <Text style={styles.sectionTitle}>7. Children's Privacy</Text>
                <Text style={styles.paragraph}>
                    AirTrainr is not intended for users under 18. Sub-accounts for minors are managed entirely by the parent/guardian who holds the primary account. We do not knowingly collect personal information from children under 13.
                </Text>

                <Text style={styles.sectionTitle}>8. Your Rights</Text>
                <Text style={styles.paragraph}>
                    You have the right to: access your personal data; correct inaccurate information; delete your account; export your data; opt out of marketing communications; restrict processing of your data. To exercise these rights, contact us at privacy@airtrainr.com.
                </Text>

                <Text style={styles.sectionTitle}>9. Cookies & Tracking</Text>
                <Text style={styles.paragraph}>
                    Our mobile app uses local storage for authentication tokens and user preferences. We use analytics tools to understand app usage patterns and improve user experience. You can control tracking through your device settings.
                </Text>

                <Text style={styles.sectionTitle}>10. Changes to This Policy</Text>
                <Text style={styles.paragraph}>
                    We may update this Privacy Policy from time to time. We will notify you of material changes through the app or email. Continued use of the Service after changes constitutes acceptance of the updated policy.
                </Text>

                <Text style={styles.sectionTitle}>11. Contact Us</Text>
                <Text style={styles.paragraph}>
                    For privacy-related questions or concerns, contact our Data Protection Officer at privacy@airtrainr.com or through the Contact Support section in the app.
                </Text>
                <View style={{ height: 60 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xxl, paddingTop: 60, paddingBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
    backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
    contentContainer: { padding: Spacing.xxl },
    updated: { fontSize: FontSize.sm, color: Colors.textTertiary, marginBottom: Spacing.xl },
    sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, marginTop: Spacing.xl, marginBottom: Spacing.sm },
    paragraph: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 24 },
});

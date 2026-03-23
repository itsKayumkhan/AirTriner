import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';

export default function TermsScreen({ navigation }: any) {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Terms of Service</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
                <Text style={styles.updated}>Last Updated: February 2026</Text>

                <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
                <Text style={styles.paragraph}>
                    By accessing or using the AirTrainr platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Service. AirTrainr is a sports training marketplace that connects athletes with trainers across the United States and Canada.
                </Text>

                <Text style={styles.sectionTitle}>2. Eligibility</Text>
                <Text style={styles.paragraph}>
                    You must be at least 18 years of age to create an account and use the Service. Users under 18 may only use the platform through a parent or guardian's sub-account. Users must be located in the United States or Canada. AirTrainr reserves the right to verify age and geographic eligibility at any time.
                </Text>

                <Text style={styles.sectionTitle}>3. Account Registration</Text>
                <Text style={styles.paragraph}>
                    You agree to provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials. Each primary account may create up to 6 sub-accounts. You must notify AirTrainr immediately of any unauthorized access to your account.
                </Text>

                <Text style={styles.sectionTitle}>4. Booking & Payments</Text>
                <Text style={styles.paragraph}>
                    All payments are processed through Stripe. AirTrainr charges a 3% platform fee on each booking transaction. Funds are held in escrow until the training session is completed. Trainers receive payouts within 24-48 hours after session completion, depending on their session history. Cancellations made more than 24 hours before a session are eligible for a full refund.
                </Text>

                <Text style={styles.sectionTitle}>5. Trainer Obligations</Text>
                <Text style={styles.paragraph}>
                    Trainers must maintain accurate availability schedules. All certifications and qualifications must be genuine and verifiable. Trainers agree to undergo identity verification. Trainers are independent contractors, not employees of AirTrainr. A trial period of 7 days is provided, after which a monthly subscription fee of $14.99 applies.
                </Text>

                <Text style={styles.sectionTitle}>6. Athlete Obligations</Text>
                <Text style={styles.paragraph}>
                    Athletes must show up to booked sessions on time. No-shows may result in partial or full charges. Athletes agree to provide honest reviews and ratings. Inappropriate behavior toward trainers will result in account suspension.
                </Text>

                <Text style={styles.sectionTitle}>7. Dispute Resolution</Text>
                <Text style={styles.paragraph}>
                    Disputes between athletes and trainers should first be resolved through direct communication. If unresolved, either party may submit a dispute through the platform within 48 hours of the session. AirTrainr will review disputes and make a binding decision within 5 business days.
                </Text>

                <Text style={styles.sectionTitle}>8. Limitation of Liability</Text>
                <Text style={styles.paragraph}>
                    AirTrainr is a marketplace platform and is not responsible for the quality of training services provided by trainers. AirTrainr is not liable for any injuries sustained during training sessions. Users acknowledge that physical training involves inherent risks.
                </Text>

                <Text style={styles.sectionTitle}>9. Termination</Text>
                <Text style={styles.paragraph}>
                    AirTrainr reserves the right to suspend or terminate accounts that violate these Terms. Users may delete their accounts at any time through the Profile settings. Termination does not affect obligations arising before the termination date.
                </Text>

                <Text style={styles.sectionTitle}>10. Contact</Text>
                <Text style={styles.paragraph}>
                    For questions about these Terms, contact us at legal@airtrainr.com or through the Contact Support section in the app.
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

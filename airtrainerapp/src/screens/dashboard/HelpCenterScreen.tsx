import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';

const FAQ_ITEMS = [
    { q: 'How do I book a session?', a: 'Browse trainers in the Discover tab, select one, and tap "Book Session". Choose your preferred time and confirm the booking.' },
    { q: 'How do payments work?', a: 'Payments are processed securely through Stripe. Funds are held in escrow and released to the trainer after the session is completed.' },
    { q: 'What is the cancellation policy?', a: 'You can cancel up to 24 hours before a session for a full refund. Late cancellations may incur a fee.' },
    { q: 'How do sub-accounts work?', a: 'You can create up to 6 sub-accounts for family members. Each sub-account can book sessions independently.' },
    { q: 'How do I become a verified trainer?', a: 'Go to Profile > Verification and submit your ID documents. Our team will review and verify your identity within 24-48 hours.' },
    { q: 'What is the platform fee?', a: 'AirTrainr charges a 3% platform fee on each booking to cover payment processing and platform maintenance.' },
    { q: 'How do I message my trainer?', a: 'After booking a session, go to Messages to chat directly with your trainer about session details and logistics.' },
    { q: 'Can I rate my trainer?', a: 'Yes! After each completed session, you\'ll be prompted to rate and review your trainer to help other athletes.' },
];

export default function HelpCenterScreen({ navigation }: any) {
    const [expanded, setExpanded] = React.useState<number | null>(null);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Help Center</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.searchCard}>
                    <Ionicons name="help-buoy-outline" size={40} color={Colors.primary} />
                    <Text style={styles.searchTitle}>How can we help?</Text>
                    <Text style={styles.searchSubtitle}>Find answers to common questions below</Text>
                </View>

                <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

                {FAQ_ITEMS.map((item, i) => (
                    <TouchableOpacity key={i} style={styles.faqItem} onPress={() => setExpanded(expanded === i ? null : i)} activeOpacity={0.7}>
                        <View style={styles.faqHeader}>
                            <Text style={styles.faqQuestion}>{item.q}</Text>
                            <Ionicons name={expanded === i ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textTertiary} />
                        </View>
                        {expanded === i && <Text style={styles.faqAnswer}>{item.a}</Text>}
                    </TouchableOpacity>
                ))}

                <View style={styles.contactCard}>
                    <Ionicons name="chatbubble-ellipses-outline" size={24} color={Colors.primary} />
                    <View style={styles.contactInfo}>
                        <Text style={styles.contactTitle}>Still need help?</Text>
                        <Text style={styles.contactSubtitle}>Contact our support team</Text>
                    </View>
                    <TouchableOpacity style={styles.contactBtn} onPress={() => navigation.navigate('Support')}>
                        <Text style={styles.contactBtnText}>Contact</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ height: 40 }} />
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
    searchCard: { alignItems: 'center', padding: Spacing.xxl, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.xxl, gap: Spacing.sm },
    searchTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: Colors.text },
    searchSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.md },
    faqItem: { backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
    faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    faqQuestion: { flex: 1, fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text, marginRight: Spacing.md },
    faqAnswer: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22, marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
    contactCard: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, backgroundColor: Colors.primaryGlow, borderRadius: BorderRadius.lg, marginTop: Spacing.xxl, gap: Spacing.md },
    contactInfo: { flex: 1 },
    contactTitle: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
    contactSubtitle: { fontSize: FontSize.xs, color: Colors.textSecondary },
    contactBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.primary, borderRadius: BorderRadius.md },
    contactBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, color: '#fff' },
});

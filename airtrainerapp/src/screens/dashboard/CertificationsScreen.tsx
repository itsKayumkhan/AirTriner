import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';

export default function CertificationsScreen({ navigation }: any) {
    const { user } = useAuth();
    const certs = user?.trainerProfile?.certifications as any[] || [];

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Certifications</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.infoCard}>
                    <Ionicons name="ribbon-outline" size={24} color={Colors.primary} />
                    <Text style={styles.infoText}>
                        Upload your certifications to build trust with athletes. Verified trainers get more bookings!
                    </Text>
                </View>

                {certs.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="document-text-outline" size={48} color={Colors.textTertiary} />
                        <Text style={styles.emptyTitle}>No Certifications</Text>
                        <Text style={styles.emptyText}>Add your coaching certifications, first aid training, or sports qualifications.</Text>
                    </View>
                ) : (
                    certs.map((cert: any, i: number) => (
                        <View key={i} style={styles.certCard}>
                            <View style={styles.certIcon}>
                                <Ionicons name="ribbon" size={22} color={Colors.primary} />
                            </View>
                            <View style={styles.certInfo}>
                                <Text style={styles.certName}>{cert.name || cert}</Text>
                                {cert.issuer && <Text style={styles.certIssuer}>{cert.issuer}</Text>}
                                {cert.year && <Text style={styles.certYear}>{cert.year}</Text>}
                            </View>
                            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                        </View>
                    ))
                )}

                <View style={styles.suggestionsSection}>
                    <Text style={styles.sectionTitle}>Suggested Certifications</Text>
                    {['CPR / First Aid', 'NASM Personal Trainer', 'ACE Fitness', 'USA Hockey Level 1-4', 'USPTA Tennis', 'NSCA-CSCS'].map((cert) => (
                        <View key={cert} style={styles.suggestionCard}>
                            <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                            <Text style={styles.suggestionText}>{cert}</Text>
                        </View>
                    ))}
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
    infoCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, backgroundColor: Colors.primaryGlow, borderRadius: BorderRadius.md, marginBottom: Spacing.xl },
    infoText: { flex: 1, fontSize: FontSize.sm, color: Colors.primary, lineHeight: 20 },
    emptyState: { alignItems: 'center', paddingVertical: 40, gap: Spacing.md },
    emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
    emptyText: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center' },
    certCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
    certIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.primaryGlow, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    certInfo: { flex: 1 },
    certName: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
    certIssuer: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 1 },
    certYear: { fontSize: FontSize.xs, color: Colors.textTertiary, marginTop: 1 },
    suggestionsSection: { marginTop: Spacing.xxl },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.md },
    suggestionCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
    suggestionText: { fontSize: FontSize.md, color: Colors.textSecondary },
});

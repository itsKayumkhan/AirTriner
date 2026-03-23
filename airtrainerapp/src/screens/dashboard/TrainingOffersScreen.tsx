import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
    ActivityIndicator, RefreshControl, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { createNotification } from '../../lib/notifications';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';

type Offer = {
    id: string;
    trainer_id: string;
    athlete_id: string;
    status: string;
    message: string | null;
    price: number;
    session_length_min: number;
    proposed_dates: any;
    sport: string | null;
    created_at: string;
    athlete?: { first_name: string; last_name: string; email: string };
};

export default function TrainingOffersScreen({ navigation }: any) {
    const { user } = useAuth();
    const [offers, setOffers] = useState<Offer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showNewOffer, setShowNewOffer] = useState(false);
    const [athletes, setAthletes] = useState<any[]>([]);

    // New offer form
    const [selectedAthlete, setSelectedAthlete] = useState<string>('');
    const [offerMessage, setOfferMessage] = useState('');
    const [offerPrice, setOfferPrice] = useState(String(user?.trainerProfile?.hourly_rate || '50'));
    const [offerSport, setOfferSport] = useState(user?.trainerProfile?.sports?.[0] || '');
    const [offerDuration, setOfferDuration] = useState('60');
    const [isSending, setIsSending] = useState(false);

    const fetchOffers = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('training_offers')
                .select('*, athlete:users!training_offers_athlete_id_fkey(first_name, last_name, email)')
                .eq('trainer_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOffers((data || []) as Offer[]);
        } catch (error) {
            console.error('Error fetching offers:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    const fetchAthletes = useCallback(async () => {
        if (!user) return;
        // Get athletes who have previously booked with this trainer
        const { data: bookings } = await supabase
            .from('bookings')
            .select('athlete_id, athlete:users!bookings_athlete_id_fkey(id, first_name, last_name, email)')
            .eq('trainer_id', user.id);

        // Deduplicate
        const uniqueAthletes = new Map();
        (bookings || []).forEach((b: any) => {
            if (b.athlete && !uniqueAthletes.has(b.athlete.id)) {
                uniqueAthletes.set(b.athlete.id, b.athlete);
            }
        });
        setAthletes(Array.from(uniqueAthletes.values()));
    }, [user]);

    useEffect(() => { fetchOffers(); fetchAthletes(); }, [fetchOffers, fetchAthletes]);
    const onRefresh = async () => { setRefreshing(true); await fetchOffers(); setRefreshing(false); };

    const handleSendOffer = async () => {
        if (!user || !selectedAthlete) {
            Alert.alert('Missing Info', 'Please select an athlete.');
            return;
        }
        setIsSending(true);
        try {
            const { error } = await supabase.from('training_offers').insert({
                trainer_id: user.id,
                athlete_id: selectedAthlete,
                status: 'pending',
                message: offerMessage.trim() || null,
                price: parseFloat(offerPrice) || 50,
                session_length_min: parseInt(offerDuration) || 60,
                sport: offerSport || null,
            });
            if (error) throw error;

            // Notify athlete
            await createNotification({
                userId: selectedAthlete,
                type: 'NEW_REQUEST_NEARBY',
                title: 'New Training Offer! 📩',
                body: `${user.firstName} ${user.lastName} sent you a training offer for $${offerPrice}/${offerDuration}min.`,
                data: { trainerId: user.id },
            });

            setShowNewOffer(false);
            setSelectedAthlete('');
            setOfferMessage('');
            fetchOffers();
            Alert.alert('Offer Sent!', 'The athlete will be notified.');
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setIsSending(false);
        }
    };

    const getStatusConfig = (status: string) => {
        switch (status) {
            case 'pending': return { color: Colors.warning, bg: Colors.warningLight, label: 'Pending' };
            case 'accepted': return { color: Colors.success, bg: Colors.successLight, label: 'Accepted' };
            case 'declined': return { color: Colors.error, bg: Colors.errorLight, label: 'Declined' };
            case 'expired': return { color: Colors.textTertiary, bg: Colors.surface, label: 'Expired' };
            default: return { color: Colors.textTertiary, bg: Colors.surface, label: status };
        }
    };

    if (isLoading) {
        return <View style={[styles.container, styles.center]}><ActivityIndicator size="large" color={Colors.primary} /></View>;
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Training Offers</Text>
                <TouchableOpacity style={styles.addButton} onPress={() => setShowNewOffer(true)}>
                    <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            >
                <View style={styles.infoCard}>
                    <Ionicons name="paper-plane-outline" size={20} color={Colors.primary} />
                    <Text style={styles.infoText}>
                        Send direct training offers to athletes you've worked with. They'll get notified and can accept instantly!
                    </Text>
                </View>

                {offers.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="document-text-outline" size={48} color={Colors.textTertiary} />
                        <Text style={styles.emptyTitle}>No offers sent yet</Text>
                        <Text style={styles.emptyText}>Tap + to send your first training offer</Text>
                    </View>
                ) : (
                    offers.map((offer) => {
                        const sc = getStatusConfig(offer.status);
                        return (
                            <View key={offer.id} style={styles.offerCard}>
                                <View style={styles.offerHeader}>
                                    <View style={styles.offerAvatar}>
                                        <Text style={styles.offerAvatarText}>
                                            {(offer.athlete?.first_name?.[0] || '') + (offer.athlete?.last_name?.[0] || '')}
                                        </Text>
                                    </View>
                                    <View style={styles.offerInfo}>
                                        <Text style={styles.offerName}>{offer.athlete?.first_name} {offer.athlete?.last_name}</Text>
                                        <Text style={styles.offerSport}>{offer.sport || 'General'} · {offer.session_length_min}min</Text>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                                        <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
                                    </View>
                                </View>
                                {offer.message && <Text style={styles.offerMessage}>"{offer.message}"</Text>}
                                <View style={styles.offerFooter}>
                                    <Text style={styles.offerPrice}>${Number(offer.price).toFixed(0)}</Text>
                                    <Text style={styles.offerDate}>{new Date(offer.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                                </View>
                            </View>
                        );
                    })
                )}
                <View style={{ height: 40 }} />
            </ScrollView>

            {/* New Offer Modal */}
            <Modal visible={showNewOffer} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>New Training Offer</Text>
                            <TouchableOpacity onPress={() => setShowNewOffer(false)}>
                                <Ionicons name="close" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.label}>Select Athlete</Text>
                            {athletes.length === 0 ? (
                                <Text style={styles.noAthletesText}>No previous athletes found. Athletes appear here after they book with you.</Text>
                            ) : (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.lg }}>
                                    {athletes.map((a: any) => (
                                        <TouchableOpacity
                                            key={a.id}
                                            style={[styles.athleteChip, selectedAthlete === a.id && styles.athleteChipActive]}
                                            onPress={() => setSelectedAthlete(a.id)}
                                        >
                                            <Text style={[styles.athleteChipText, selectedAthlete === a.id && styles.athleteChipTextActive]}>
                                                {a.first_name} {a.last_name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}

                            <Text style={styles.label}>Sport</Text>
                            <TextInput style={styles.modalInput} value={offerSport} onChangeText={setOfferSport} placeholder="e.g. Hockey" placeholderTextColor={Colors.textTertiary} />

                            <View style={styles.modalRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Price ($)</Text>
                                    <TextInput style={styles.modalInput} value={offerPrice} onChangeText={setOfferPrice} keyboardType="numeric" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Duration (min)</Text>
                                    <TextInput style={styles.modalInput} value={offerDuration} onChangeText={setOfferDuration} keyboardType="numeric" />
                                </View>
                            </View>

                            <Text style={styles.label}>Message (optional)</Text>
                            <TextInput
                                style={[styles.modalInput, { minHeight: 80 }]}
                                value={offerMessage}
                                onChangeText={setOfferMessage}
                                placeholder="Let the athlete know what you're offering..."
                                placeholderTextColor={Colors.textTertiary}
                                multiline
                                textAlignVertical="top"
                            />

                            <TouchableOpacity style={[styles.sendButton, isSending && { opacity: 0.5 }]} onPress={handleSendOffer} disabled={isSending}>
                                {isSending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendButtonText}>Send Offer</Text>}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xxl, paddingTop: 60, paddingBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
    backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
    addButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
    contentContainer: { padding: Spacing.xxl },
    infoCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, backgroundColor: Colors.primaryGlow, borderRadius: BorderRadius.md, marginBottom: Spacing.xxl },
    infoText: { flex: 1, fontSize: FontSize.sm, color: Colors.primary, lineHeight: 20 },
    emptyState: { alignItems: 'center', paddingVertical: 60, gap: Spacing.md },
    emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
    emptyText: { fontSize: FontSize.md, color: Colors.textSecondary },
    offerCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
    offerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
    offerAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.primaryGlow, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    offerAvatarText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.primary },
    offerInfo: { flex: 1 },
    offerName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
    offerSport: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 1 },
    statusBadge: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: BorderRadius.pill },
    statusText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
    offerMessage: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic', marginBottom: Spacing.md, lineHeight: 20 },
    offerFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
    offerPrice: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.success },
    offerDate: { fontSize: FontSize.xs, color: Colors.textTertiary },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContainer: { backgroundColor: Colors.background, borderTopLeftRadius: BorderRadius.xxl, borderTopRightRadius: BorderRadius.xxl, padding: Spacing.xxl, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xxl },
    modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
    label: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xs },
    modalInput: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, color: Colors.text, fontSize: FontSize.md, marginBottom: Spacing.lg },
    modalRow: { flexDirection: 'row', gap: Spacing.md },
    noAthletesText: { fontSize: FontSize.sm, color: Colors.textTertiary, marginBottom: Spacing.lg },
    athleteChip: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.pill, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.sm },
    athleteChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    athleteChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
    athleteChipTextActive: { color: '#fff' },
    sendButton: { backgroundColor: Colors.primary, padding: Spacing.lg, borderRadius: BorderRadius.md, alignItems: 'center', marginTop: Spacing.md, marginBottom: Spacing.xl },
    sendButtonText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },
});

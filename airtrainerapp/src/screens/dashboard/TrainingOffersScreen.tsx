import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TouchableHighlight,
    TextInput,
    Alert,
    ActivityIndicator,
    RefreshControl,
    Modal,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows, Layout} from '../../theme';

// ─── Types ───────────────────────────────────────────────────────────────────

type TrainingOffer = {
    id: string;
    trainer_id: string;
    title: string;
    description: string | null;
    price: number;
    sport: string | null;
    duration_minutes: number;
    is_active: boolean;
    max_athletes: number | null;
    athlete_count: number;
    created_at: string;
};

type FormState = {
    title: string;
    description: string;
    price: string;
    sport: string;
    duration_minutes: string;
    max_athletes: string;
};

type Athlete = {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
    email: string;
};

type SentOffer = {
    id: string;
    trainer_id: string;
    athlete_id: string;
    message: string | null;
    price: number;
    session_length_min: number | null;
    sport: string | null;
    status: string;
    proposed_dates: any;
    created_at: string;
    athlete: { first_name: string; last_name: string } | null;
};

type TabKey = 'packages' | 'send';

const EMPTY_FORM: FormState = {
    title: '',
    description: '',
    price: '',
    sport: '',
    duration_minutes: '60',
    max_athletes: '',
};

const SESSION_LENGTHS = [30, 45, 60, 90];

// ─── Component ───────────────────────────────────────────────────────────────

export default function TrainingOffersScreen({ navigation }: any) {
    const { user } = useAuth();
    const trainerProfile = user?.trainerProfile;

    const [activeTab, setActiveTab] = useState<TabKey>('packages');

    // ── My Packages state ─────────────────────────────────────────────────────
    const [offers, setOffers] = useState<TrainingOffer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [formErrors, setFormErrors] = useState<Partial<FormState>>({});

    // ── Send Offer state ──────────────────────────────────────────────────────
    const [athleteQuery, setAthleteQuery] = useState('');
    const [athleteResults, setAthleteResults] = useState<Athlete[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
    const [offerMessage, setOfferMessage] = useState('');
    const [offerPrice, setOfferPrice] = useState('');
    const [sessionLength, setSessionLength] = useState(60);
    const [selectedSport, setSelectedSport] = useState('');
    const [proposedDate, setProposedDate] = useState('');
    const [proposedTime, setProposedTime] = useState('');
    const [isSendingOffer, setIsSendingOffer] = useState(false);

    // ── Sent Offers state ─────────────────────────────────────────────────────
    const [sentOffers, setSentOffers] = useState<SentOffer[]>([]);
    const [isSentLoading, setIsSentLoading] = useState(false);

    // ── Subscription check ──────────────────────────────────────────────────
    const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);

    const fetchSubscriptionStatus = useCallback(async () => {
        if (!user?.id) return;
        try {
            const { data } = await supabase
                .from('trainer_profiles')
                .select('subscription_status')
                .eq('user_id', user.id)
                .single();
            setSubscriptionStatus(data?.subscription_status ?? null);
        } catch (err) {
            console.error('Error fetching subscription status:', err);
        }
    }, [user?.id]);

    const isSubscriptionActive = subscriptionStatus === 'active' || subscriptionStatus === 'trial';

    // ── Data fetching ─────────────────────────────────────────────────────────

    const fetchOffers = useCallback(async () => {
        if (!trainerProfile?.id) return;
        try {
            const { data, error } = await supabase
                .from('training_offers')
                .select('*')
                .eq('trainer_id', trainerProfile.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            const offerList = (data || []) as TrainingOffer[];

            // Auto-deactivate any offers that have reached their cap
            const capsReached = offerList.filter(
                (o) => o.is_active && o.max_athletes != null && (o.athlete_count ?? 0) >= o.max_athletes
            );
            if (capsReached.length > 0) {
                await supabase
                    .from('training_offers')
                    .update({ is_active: false })
                    .in('id', capsReached.map((o) => o.id));
                capsReached.forEach((o) => { o.is_active = false; });
            }

            setOffers(offerList);
        } catch (err: any) {
            console.error('TrainingOffersScreen fetchOffers:', err);
            Alert.alert('Error', 'Could not load training offers.');
        } finally {
            setIsLoading(false);
        }
    }, [trainerProfile?.id]);

    const fetchSentOffers = useCallback(async () => {
        if (!trainerProfile?.id) return;
        setIsSentLoading(true);
        try {
            const { data, error } = await supabase
                .from('training_offers')
                .select('*, athlete:users!training_offers_athlete_id_fkey(first_name, last_name)')
                .eq('trainer_id', trainerProfile.id)
                .not('athlete_id', 'is', null)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSentOffers((data || []) as SentOffer[]);
        } catch (err: any) {
            console.error('TrainingOffersScreen fetchSentOffers:', err);
        } finally {
            setIsSentLoading(false);
        }
    }, [trainerProfile?.id]);

    useEffect(() => {
        fetchOffers();
        fetchSubscriptionStatus();
    }, [fetchOffers, fetchSubscriptionStatus]);

    useEffect(() => {
        if (activeTab === 'send') {
            fetchSentOffers();
        }
    }, [activeTab, fetchSentOffers]);

    const onRefresh = async () => {
        setRefreshing(true);
        if (activeTab === 'packages') {
            await fetchOffers();
        } else {
            await fetchSentOffers();
        }
        setRefreshing(false);
    };

    // ── Athlete search ────────────────────────────────────────────────────────

    const searchAthletes = useCallback(async (query: string) => {
        setAthleteQuery(query);
        if (query.trim().length < 2) {
            setAthleteResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, first_name, last_name, avatar_url, email')
                .eq('role', 'athlete')
                .ilike('first_name', `%${query}%`)
                .limit(10);

            if (error) throw error;
            setAthleteResults((data || []) as Athlete[]);
        } catch (err: any) {
            console.error('Athlete search error:', err);
        } finally {
            setIsSearching(false);
        }
    }, []);

    // ── Form validation ───────────────────────────────────────────────────────

    const validate = (): boolean => {
        const errors: Partial<FormState> = {};
        if (!form.title.trim()) errors.title = 'Title is required';
        const priceVal = parseFloat(form.price);
        if (!form.price || isNaN(priceVal) || priceVal <= 0) errors.price = 'Enter a valid price';
        const durVal = parseInt(form.duration_minutes, 10);
        if (!form.duration_minutes || isNaN(durVal) || durVal <= 0) errors.duration_minutes = 'Enter a valid duration';
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // ── Create offer ──────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!validate()) return;
        if (!trainerProfile?.id) {
            Alert.alert('Error', 'Trainer profile not found.');
            return;
        }
        setIsSaving(true);
        try {
            const maxAthletes = form.max_athletes.trim() ? parseInt(form.max_athletes, 10) : null;
            const { error } = await supabase.from('training_offers').insert({
                trainer_id: trainerProfile.id,
                title: form.title.trim(),
                description: form.description.trim() || null,
                price: parseFloat(form.price),
                sport: form.sport.trim() || null,
                duration_minutes: parseInt(form.duration_minutes, 10),
                max_athletes: maxAthletes,
                athlete_count: 0,
                is_active: true,
            });
            if (error) throw error;
            setShowModal(false);
            setForm(EMPTY_FORM);
            setFormErrors({});
            await fetchOffers();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Could not save offer.');
        } finally {
            setIsSaving(false);
        }
    };

    // ── Send targeted offer ───────────────────────────────────────────────────

    const handleSendOffer = async () => {
        if (!selectedAthlete) {
            Alert.alert('Error', 'Please select an athlete.');
            return;
        }
        if (!offerMessage.trim()) {
            Alert.alert('Error', 'Please enter a message.');
            return;
        }
        const priceVal = parseFloat(offerPrice);
        if (!offerPrice || isNaN(priceVal) || priceVal <= 0) {
            Alert.alert('Error', 'Please enter a valid price.');
            return;
        }
        if (!trainerProfile?.id) {
            Alert.alert('Error', 'Trainer profile not found.');
            return;
        }
        setIsSendingOffer(true);
        try {
            const proposedDates = proposedDate && proposedTime
                ? { scheduledAt: `${proposedDate}T${proposedTime}:00` }
                : null;

            const { error } = await supabase.from('training_offers').insert({
                trainer_id: trainerProfile.id,
                athlete_id: selectedAthlete.id,
                message: offerMessage.trim(),
                price: priceVal,
                session_length_min: sessionLength,
                sport: selectedSport || null,
                proposed_dates: proposedDates,
                status: 'pending',
            });
            if (error) throw error;

            // Notify athlete
            await supabase.from('notifications').insert({
                user_id: selectedAthlete.id,
                type: 'TRAINING_OFFER',
                title: 'New Training Offer',
                body: `You received a training offer${selectedSport ? ` for ${selectedSport}` : ''}`,
                data: { offerId: 'will-be-set-by-trigger' },
                read: false,
            });

            Alert.alert('Offer Sent', `Your offer has been sent to ${selectedAthlete.first_name}`);

            // Reset form
            setSelectedAthlete(null);
            setAthleteQuery('');
            setAthleteResults([]);
            setOfferMessage('');
            setOfferPrice('');
            setSessionLength(60);
            setSelectedSport('');
            setProposedDate('');
            setProposedTime('');

            // Refresh sent offers
            await fetchSentOffers();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Could not send offer.');
        } finally {
            setIsSendingOffer(false);
        }
    };

    // ── Delete offer ──────────────────────────────────────────────────────────

    const handleLongPress = (offer: TrainingOffer) => {
        Alert.alert(
            'Delete Offer',
            `Delete "${offer.title}"? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('training_offers')
                                .delete()
                                .eq('id', offer.id);
                            if (error) throw error;
                            setOffers((prev) => prev.filter((o) => o.id !== offer.id));
                        } catch (err: any) {
                            Alert.alert('Error', err.message || 'Could not delete offer.');
                        }
                    },
                },
            ]
        );
    };

    const openModal = () => {
        setForm({ ...EMPTY_FORM, sport: trainerProfile?.sports?.[0] || '', price: String(trainerProfile?.hourly_rate || '') });
        setFormErrors({});
        setShowModal(true);
    };

    // ── Render ────────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    // Locked state when subscription is not active
    if (subscriptionStatus !== null && !isSubscriptionActive) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                        <Ionicons name="arrow-back" size={22} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Training Offers</Text>
                    <View style={{ width: 44 }} />
                </View>
                <View style={styles.lockedContainer}>
                    <View style={styles.lockedIconWrap}>
                        <Ionicons name="lock-closed" size={32} color={Colors.warning} />
                    </View>
                    <Text style={styles.lockedTitle}>Subscription Required</Text>
                    <Text style={styles.lockedText}>
                        Your subscription has expired or been cancelled.
                    </Text>
                    <Text style={styles.lockedSubtext}>
                        Renew your subscription to send training offers and grow your client base.
                    </Text>
                    <TouchableOpacity
                        style={styles.lockedButton}
                        onPress={() => navigation.navigate('Subscription')}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="trophy-outline" size={18} color="#000" />
                        <Text style={styles.lockedButtonText}>Upgrade Subscription</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={22} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Training Offers</Text>
                <View style={{ width: 44 }} />
            </View>

            {/* Tabs */}
            <View style={styles.tabRow}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'packages' && styles.tabActive]}
                    onPress={() => setActiveTab('packages')}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name="pricetag-outline"
                        size={16}
                        color={activeTab === 'packages' ? '#fff' : Colors.textSecondary}
                    />
                    <Text style={[styles.tabText, activeTab === 'packages' && styles.tabTextActive]}>
                        My Packages
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'send' && styles.tabActive]}
                    onPress={() => setActiveTab('send')}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name="send-outline"
                        size={16}
                        color={activeTab === 'send' ? '#fff' : Colors.textSecondary}
                    />
                    <Text style={[styles.tabText, activeTab === 'send' && styles.tabTextActive]}>
                        Send Offer
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Tab Content */}
            {activeTab === 'packages' ? (
                <>
                    {/* My Packages List */}
                    <ScrollView
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
                        }
                    >
                        {/* Hint banner */}
                        <View style={styles.hintRow}>
                            <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
                            <Text style={styles.hintText}>Long-press any card to delete it.</Text>
                        </View>

                        {offers.length === 0 ? (
                            <EmptyState />
                        ) : (
                            offers.map((offer) => (
                                <OfferCard key={offer.id} offer={offer} onLongPress={() => handleLongPress(offer)} />
                            ))
                        )}

                        {/* FAB spacer */}
                        <View style={{ height: 100 }} />
                    </ScrollView>

                    {/* Floating Action Button */}
                    <TouchableOpacity style={styles.fab} onPress={openModal} activeOpacity={0.85}>
                        <LinearGradient
                            colors={[Colors.primary, Colors.accent]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.fabGradient}
                        >
                            <Ionicons name="add" size={30} color="#fff" />
                        </LinearGradient>
                    </TouchableOpacity>
                </>
            ) : (
                /* Send Offer Tab */
                <ScrollView
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
                    }
                >
                    {/* Athlete Search */}
                    <Text style={styles.sectionTitle}>Find Athlete</Text>
                    <View style={styles.searchInputWrap}>
                        <Ionicons name="search-outline" size={18} color={Colors.textTertiary} style={{ marginRight: Spacing.sm }} />
                        <TextInput
                            style={styles.searchInput}
                            value={athleteQuery}
                            onChangeText={searchAthletes}
                            placeholder="Search athletes by name..."
                            placeholderTextColor={Colors.textTertiary}
                            autoCapitalize="words"
                        />
                        {isSearching && <ActivityIndicator size="small" color={Colors.primary} />}
                    </View>

                    {/* Search Results */}
                    {athleteResults.length > 0 && (
                        <View style={styles.searchResults}>
                            {athleteResults.map((athlete) => (
                                <AthleteCard
                                    key={athlete.id}
                                    athlete={athlete}
                                    isSelected={selectedAthlete?.id === athlete.id}
                                    onSelect={() => {
                                        setSelectedAthlete(athlete);
                                        setAthleteResults([]);
                                        setAthleteQuery(`${athlete.first_name} ${athlete.last_name}`);
                                    }}
                                />
                            ))}
                        </View>
                    )}

                    {/* Selected Athlete Badge */}
                    {selectedAthlete && (
                        <View style={styles.selectedBadge}>
                            <View style={styles.avatarSmall}>
                                <Text style={styles.avatarSmallText}>
                                    {selectedAthlete.first_name[0]}{selectedAthlete.last_name[0]}
                                </Text>
                            </View>
                            <Text style={styles.selectedBadgeText}>
                                {selectedAthlete.first_name} {selectedAthlete.last_name}
                            </Text>
                            <TouchableOpacity
                                onPress={() => {
                                    setSelectedAthlete(null);
                                    setAthleteQuery('');
                                }}
                                style={styles.selectedBadgeClose}
                            >
                                <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Offer Form - shown after selecting athlete */}
                    {selectedAthlete && (
                        <View style={styles.offerForm}>
                            <Text style={styles.sectionTitle}>Offer Details</Text>

                            {/* Message */}
                            <FieldLabel label="Message" required />
                            <TextInput
                                style={[styles.input, styles.inputMultiline]}
                                value={offerMessage}
                                onChangeText={setOfferMessage}
                                placeholder="Describe your training offer..."
                                placeholderTextColor={Colors.textTertiary}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                            />

                            {/* Price */}
                            <FieldLabel label="Price (USD)" required />
                            <View style={styles.inputPrefix}>
                                <Text style={styles.prefixSymbol}>$</Text>
                                <TextInput
                                    style={styles.inputInner}
                                    value={offerPrice}
                                    onChangeText={setOfferPrice}
                                    keyboardType="decimal-pad"
                                    placeholder="50"
                                    placeholderTextColor={Colors.textTertiary}
                                />
                            </View>

                            {/* Session Length */}
                            <FieldLabel label="Session Length" />
                            <View style={styles.chipRow}>
                                {SESSION_LENGTHS.map((len) => (
                                    <TouchableOpacity
                                        key={len}
                                        style={[styles.chip, sessionLength === len && styles.chipActive]}
                                        onPress={() => setSessionLength(len)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.chipText, sessionLength === len && styles.chipTextActive]}>
                                            {len} min
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Sport */}
                            <FieldLabel label="Sport" />
                            <TextInput
                                style={styles.input}
                                value={selectedSport}
                                onChangeText={setSelectedSport}
                                placeholder="e.g. Hockey, Basketball, Soccer"
                                placeholderTextColor={Colors.textTertiary}
                                autoCapitalize="words"
                            />

                            {/* Proposed Date and Time */}
                            <View style={styles.row}>
                                <View style={{ flex: 1 }}>
                                    <FieldLabel label="Proposed Date" />
                                    <TextInput
                                        style={styles.input}
                                        value={proposedDate}
                                        onChangeText={setProposedDate}
                                        placeholder="YYYY-MM-DD"
                                        placeholderTextColor={Colors.textTertiary}
                                    />
                                </View>
                                <View style={{ width: Spacing.md }} />
                                <View style={{ flex: 1 }}>
                                    <FieldLabel label="Proposed Time" />
                                    <TextInput
                                        style={styles.input}
                                        value={proposedTime}
                                        onChangeText={setProposedTime}
                                        placeholder="HH:MM"
                                        placeholderTextColor={Colors.textTertiary}
                                    />
                                </View>
                            </View>

                            {/* Send Button */}
                            <TouchableOpacity
                                style={[styles.saveBtn, isSendingOffer && { opacity: 0.6 }]}
                                onPress={handleSendOffer}
                                disabled={isSendingOffer}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={[Colors.primary, Colors.accent]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.saveBtnGradient}
                                >
                                    {isSendingOffer ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="send" size={18} color="#fff" />
                                            <Text style={styles.saveBtnText}>Send Offer</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Sent Offers Section */}
                    <View style={styles.sentOffersSection}>
                        <Text style={styles.sectionTitle}>Sent Offers</Text>
                        {isSentLoading ? (
                            <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: Spacing.xl }} />
                        ) : sentOffers.length === 0 ? (
                            <View style={styles.sentEmptyWrap}>
                                <Ionicons name="paper-plane-outline" size={28} color={Colors.textTertiary} />
                                <Text style={styles.sentEmptyText}>No offers sent yet</Text>
                            </View>
                        ) : (
                            sentOffers.map((offer) => (
                                <SentOfferCard key={offer.id} offer={offer} />
                            ))
                        )}
                    </View>

                    <View style={{ height: 40 }} />
                </ScrollView>
            )}

            {/* Create Modal (for My Packages tab) */}
            <CreateOfferModal
                visible={showModal}
                form={form}
                errors={formErrors}
                isSaving={isSaving}
                onChange={(field, value) => setForm((prev) => ({ ...prev, [field]: value }))}
                onClose={() => setShowModal(false)}
                onSave={handleSave}
            />
        </View>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState() {
    return (
        <View style={styles.emptyWrap}>
            <View style={styles.emptyIconWrap}>
                <Ionicons name="pricetag-outline" size={40} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No offers yet</Text>
            <Text style={styles.emptySubtitle}>
                Create your first training offer.{'\n'}Tap the + button to get started.
            </Text>
        </View>
    );
}

function AthleteCard({
    athlete,
    isSelected,
    onSelect,
}: {
    athlete: Athlete;
    isSelected: boolean;
    onSelect: () => void;
}) {
    const initials = `${athlete.first_name?.[0] || ''}${athlete.last_name?.[0] || ''}`.toUpperCase();
    return (
        <TouchableOpacity
            style={[styles.athleteCard, isSelected && styles.athleteCardSelected]}
            onPress={onSelect}
            activeOpacity={0.7}
        >
            <View style={styles.athleteAvatar}>
                <Text style={styles.athleteAvatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.athleteName}>
                    {athlete.first_name} {athlete.last_name}
                </Text>
                <Text style={styles.athleteEmail} numberOfLines={1}>
                    {athlete.email}
                </Text>
            </View>
            {isSelected && (
                <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
            )}
        </TouchableOpacity>
    );
}

function SentOfferCard({ offer }: { offer: SentOffer }) {
    const athleteName = offer.athlete
        ? `${offer.athlete.first_name} ${offer.athlete.last_name}`
        : 'Unknown Athlete';

    const statusConfig = getStatusConfig(offer.status);
    const sportColor = getSportColor(offer.sport);
    const dateStr = new Date(offer.created_at).toLocaleDateString();

    return (
        <View style={styles.sentCard}>
            <View style={styles.sentCardTop}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.sentAthleteName}>{athleteName}</Text>
                    {!!offer.sport && (
                        <View style={styles.sentSportRow}>
                            <View style={[styles.sportDot, { backgroundColor: sportColor }]} />
                            <Text style={styles.sentSportText}>{offer.sport}</Text>
                        </View>
                    )}
                </View>
                <View style={styles.pricePill}>
                    <Text style={styles.priceText}>${Number(offer.price).toFixed(0)}</Text>
                </View>
            </View>
            <View style={styles.sentCardBottom}>
                <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
                    <Text style={[styles.statusText, { color: statusConfig.color }]}>
                        {statusConfig.label}
                    </Text>
                </View>
                <Text style={styles.sentDateText}>{dateStr}</Text>
            </View>
        </View>
    );
}

function OfferCard({ offer, onLongPress }: { offer: TrainingOffer; onLongPress: () => void }) {
    const sportColor = getSportColor(offer.sport);
    return (
        <TouchableHighlight
            onLongPress={onLongPress}
            underlayColor={Colors.cardHover}
            style={styles.card}
            delayLongPress={400}
        >
            <View>
                {/* Top row */}
                <View style={styles.cardTop}>
                    <View style={[styles.sportDot, { backgroundColor: sportColor }]} />
                    <Text style={styles.cardTitle} numberOfLines={1}>{offer.title}</Text>
                    <View style={styles.pricePill}>
                        <Text style={styles.priceText}>${Number(offer.price).toFixed(0)}</Text>
                    </View>
                </View>

                {/* Description */}
                {!!offer.description && (
                    <Text style={styles.cardDesc} numberOfLines={2}>{offer.description}</Text>
                )}

                {/* Meta row */}
                <View style={styles.cardMeta}>
                    {!!offer.sport && (
                        <View style={styles.metaChip}>
                            <Ionicons name="football-outline" size={12} color={Colors.textSecondary} />
                            <Text style={styles.metaChipText}>{offer.sport}</Text>
                        </View>
                    )}
                    <View style={styles.metaChip}>
                        <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
                        <Text style={styles.metaChipText}>{offer.duration_minutes} min</Text>
                    </View>
                    {offer.max_athletes != null && (
                        <View style={styles.metaChip}>
                            <Ionicons name="people-outline" size={12} color={Colors.textSecondary} />
                            <Text style={styles.metaChipText}>
                                {offer.athlete_count ?? 0}/{offer.max_athletes}
                            </Text>
                        </View>
                    )}
                    <View style={[styles.metaChip, { marginLeft: 'auto' }]}>
                        <View style={[styles.activeDot, { backgroundColor: offer.is_active ? Colors.success : Colors.textTertiary }]} />
                        <Text style={[styles.metaChipText, { color: offer.is_active ? Colors.success : Colors.textTertiary }]}>
                            {offer.is_active ? 'Active' : offer.max_athletes != null && (offer.athlete_count ?? 0) >= offer.max_athletes ? 'Full' : 'Inactive'}
                        </Text>
                    </View>
                </View>
            </View>
        </TouchableHighlight>
    );
}

function CreateOfferModal({
    visible,
    form,
    errors,
    isSaving,
    onChange,
    onClose,
    onSave,
}: {
    visible: boolean;
    form: FormState;
    errors: Partial<FormState>;
    isSaving: boolean;
    onChange: (field: keyof FormState, value: string) => void;
    onClose: () => void;
    onSave: () => void;
}) {
    return (
        <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
            <View style={styles.modalOverlay}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.modalKAV}
                >
                    <View style={styles.modalSheet}>
                        {/* Handle */}
                        <View style={styles.modalHandle} />

                        {/* Modal header */}
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>New Training Offer</Text>
                            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
                                <Ionicons name="close" size={22} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            {/* Title */}
                            <FieldLabel label="Title" required error={errors.title} />
                            <TextInput
                                style={[styles.input, errors.title ? styles.inputError : null]}
                                value={form.title}
                                onChangeText={(v) => onChange('title', v)}
                                placeholder="e.g. 1-on-1 Power Skating Session"
                                placeholderTextColor={Colors.textTertiary}
                                returnKeyType="next"
                            />

                            {/* Description */}
                            <FieldLabel label="Description" />
                            <TextInput
                                style={[styles.input, styles.inputMultiline]}
                                value={form.description}
                                onChangeText={(v) => onChange('description', v)}
                                placeholder="Describe what athletes will get from this session..."
                                placeholderTextColor={Colors.textTertiary}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                            />

                            {/* Price + Duration row */}
                            <View style={styles.row}>
                                <View style={{ flex: 1 }}>
                                    <FieldLabel label="Price (USD)" required error={errors.price} />
                                    <View style={styles.inputPrefix}>
                                        <Text style={styles.prefixSymbol}>$</Text>
                                        <TextInput
                                            style={[styles.inputInner, errors.price ? styles.inputError : null]}
                                            value={form.price}
                                            onChangeText={(v) => onChange('price', v)}
                                            keyboardType="decimal-pad"
                                            placeholder="50"
                                            placeholderTextColor={Colors.textTertiary}
                                        />
                                    </View>
                                </View>
                                <View style={{ width: Spacing.md }} />
                                <View style={{ flex: 1 }}>
                                    <FieldLabel label="Duration (min)" required error={errors.duration_minutes} />
                                    <TextInput
                                        style={[styles.input, errors.duration_minutes ? styles.inputError : null]}
                                        value={form.duration_minutes}
                                        onChangeText={(v) => onChange('duration_minutes', v)}
                                        keyboardType="number-pad"
                                        placeholder="60"
                                        placeholderTextColor={Colors.textTertiary}
                                    />
                                </View>
                            </View>

                            {/* Sport */}
                            <FieldLabel label="Sport" />
                            <TextInput
                                style={styles.input}
                                value={form.sport}
                                onChangeText={(v) => onChange('sport', v)}
                                placeholder="e.g. Hockey, Basketball, Soccer"
                                placeholderTextColor={Colors.textTertiary}
                                autoCapitalize="words"
                            />

                            {/* Max Athletes Cap */}
                            <FieldLabel label="Max Athletes (optional)" />
                            <TextInput
                                style={styles.input}
                                value={form.max_athletes}
                                onChangeText={(v) => onChange('max_athletes', v)}
                                keyboardType="number-pad"
                                placeholder="Leave blank for unlimited"
                                placeholderTextColor={Colors.textTertiary}
                            />

                            {/* Save button */}
                            <TouchableOpacity
                                style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
                                onPress={onSave}
                                disabled={isSaving}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={[Colors.primary, Colors.accent]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.saveBtnGradient}
                                >
                                    {isSaving ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark-circle" size={20} color="#fff" />
                                            <Text style={styles.saveBtnText}>Save Offer</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            <View style={{ height: 32 }} />
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

function FieldLabel({ label, required, error }: { label: string; required?: boolean; error?: string }) {
    return (
        <View style={{ marginBottom: 4 }}>
            <Text style={styles.fieldLabel}>
                {label}
                {required && <Text style={{ color: Colors.error }}> *</Text>}
            </Text>
            {!!error && <Text style={styles.fieldError}>{error}</Text>}
        </View>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSportColor(sport: string | null): string {
    if (!sport) return Colors.primary;
    const s = sport.toLowerCase();
    if (s.includes('hockey')) return Colors.sportHockey;
    if (s.includes('baseball')) return Colors.sportBaseball;
    if (s.includes('basketball')) return Colors.sportBasketball;
    if (s.includes('soccer') || s.includes('football')) return Colors.sportSoccer;
    if (s.includes('tennis')) return Colors.sportTennis;
    if (s.includes('golf')) return Colors.sportGolf;
    if (s.includes('swim')) return Colors.sportSwimming;
    if (s.includes('box')) return Colors.sportBoxing;
    if (s.includes('lacrosse')) return Colors.sportLacrosse;
    return Colors.primary;
}

function getStatusConfig(status: string): { label: string; color: string; bg: string } {
    switch (status?.toLowerCase()) {
        case 'accepted':
            return { label: 'Accepted', color: Colors.success, bg: Colors.successLight };
        case 'declined':
        case 'rejected':
            return { label: 'Declined', color: Colors.error, bg: Colors.errorLight };
        case 'pending':
        default:
            return { label: 'Pending', color: Colors.warning, bg: Colors.warningLight };
    }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },

    // Locked state
    lockedContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xxl,
    },
    lockedIconWrap: {
        width: 64,
        height: 64,
        borderRadius: BorderRadius.lg,
        backgroundColor: Colors.warningLight,
        borderWidth: 1,
        borderColor: 'rgba(255,171,0,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    lockedTitle: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    lockedText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginBottom: Spacing.xs,
    },
    lockedSubtext: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
        textAlign: 'center',
        marginBottom: Spacing.xxl,
        paddingHorizontal: Spacing.xxl,
    },
    lockedButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.warning,
        paddingHorizontal: Spacing.xxl,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
    },
    lockedButtonText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: '#000',
    },

    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.xxl,
        paddingTop: Layout.headerTopPadding,
        paddingBottom: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        backgroundColor: Colors.background,
    },
    headerBtn: {
        width: 44,
        height: 44,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },

    // Tabs
    tabRow: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.xxl,
        paddingVertical: Spacing.md,
        gap: Spacing.sm,
        backgroundColor: Colors.background,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.glass,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
    },
    tabActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    tabText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
    },
    tabTextActive: {
        color: '#fff',
    },

    // List
    list: {
        padding: Spacing.xxl,
        paddingBottom: Spacing.huge,
    },
    hintRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.xl,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        backgroundColor: Colors.primaryGlow,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.borderActive,
    },
    hintText: {
        fontSize: FontSize.sm,
        color: Colors.primary,
    },

    // Section title
    sectionTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: Spacing.lg,
        marginTop: Spacing.sm,
    },

    // Athlete search
    searchInputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.md,
    },
    searchInput: {
        flex: 1,
        paddingVertical: Spacing.md,
        color: Colors.text,
        fontSize: FontSize.md,
    },
    searchResults: {
        marginBottom: Spacing.md,
        gap: Spacing.sm,
    },

    // Athlete card
    athleteCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    athleteCardSelected: {
        borderColor: Colors.primaryGlow,
        borderWidth: 2,
        backgroundColor: Colors.cardHover,
    },
    athleteAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primaryGlow,
        borderWidth: 1,
        borderColor: Colors.borderActive,
        justifyContent: 'center',
        alignItems: 'center',
    },
    athleteAvatarText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },
    athleteName: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
    },
    athleteEmail: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        marginTop: 2,
    },

    // Selected athlete badge
    selectedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.primaryGlow,
        borderRadius: BorderRadius.pill,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.borderActive,
        marginBottom: Spacing.xl,
        alignSelf: 'flex-start',
    },
    avatarSmall: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarSmallText: {
        fontSize: 10,
        fontWeight: FontWeight.bold,
        color: '#fff',
    },
    selectedBadgeText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.primary,
    },
    selectedBadgeClose: {
        marginLeft: Spacing.xs,
    },

    // Offer form
    offerForm: {
        marginBottom: Spacing.xl,
    },

    // Chip row
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginBottom: Spacing.lg,
    },
    chip: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.pill,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    chipActive: {
        backgroundColor: Colors.primaryGlow,
        borderColor: Colors.borderActive,
    },
    chipText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.textSecondary,
    },
    chipTextActive: {
        color: Colors.primary,
        fontWeight: FontWeight.bold,
    },

    // Sent offers
    sentOffersSection: {
        marginTop: Spacing.xl,
        paddingTop: Spacing.xl,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    sentEmptyWrap: {
        alignItems: 'center',
        paddingVertical: Spacing.xxxl,
        gap: Spacing.sm,
    },
    sentEmptyText: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
    },
    sentCard: {
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadows.small,
    },
    sentCardTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    sentAthleteName: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: 4,
    },
    sentSportRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    sentSportText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    sentCardBottom: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.md,
        paddingVertical: 4,
        borderRadius: BorderRadius.pill,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
    },
    sentDateText: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
    },

    // Empty
    emptyWrap: {
        alignItems: 'center',
        paddingVertical: 70,
        gap: Spacing.lg,
    },
    emptyIconWrap: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.primaryGlow,
        borderWidth: 1,
        borderColor: Colors.borderActive,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    emptySubtitle: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },

    // Offer card
    card: {
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadows.small,
    },
    cardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    sportDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    cardTitle: {
        flex: 1,
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    pricePill: {
        backgroundColor: Colors.primaryGlow,
        borderWidth: 1,
        borderColor: Colors.borderActive,
        borderRadius: BorderRadius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: 3,
    },
    priceText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },
    cardDesc: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 20,
        marginBottom: Spacing.md,
    },
    cardMeta: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    metaChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.pill,
    },
    metaChipText: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },

    // FAB
    fab: {
        position: 'absolute',
        bottom: 32,
        right: 24,
        borderRadius: 32,
        ...Shadows.glow,
    },
    fabGradient: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: Colors.overlay,
        justifyContent: 'flex-end',
    },
    modalKAV: {
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: Colors.background,
        borderTopLeftRadius: BorderRadius.xxl,
        borderTopRightRadius: BorderRadius.xxl,
        paddingHorizontal: Spacing.xxl,
        paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xxl,
        maxHeight: '90%',
        borderTopWidth: 1,
        borderColor: Colors.border,
    },
    modalHandle: {
        width: 40,
        height: 4,
        backgroundColor: Colors.borderLight,
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: Spacing.md,
        marginBottom: Spacing.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.xl,
    },
    modalTitle: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    modalClose: {
        width: 36,
        height: 36,
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Form
    fieldLabel: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.textSecondary,
        marginBottom: 4,
    },
    fieldError: {
        fontSize: FontSize.xs,
        color: Colors.error,
        marginTop: 2,
    },
    input: {
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        color: Colors.text,
        fontSize: FontSize.md,
        marginBottom: Spacing.lg,
    },
    inputError: {
        borderColor: Colors.error,
    },
    inputMultiline: {
        minHeight: 90,
        paddingTop: Spacing.md,
        textAlignVertical: 'top',
    },
    inputPrefix: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        paddingLeft: Spacing.lg,
        marginBottom: Spacing.lg,
        overflow: 'hidden',
    },
    prefixSymbol: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        fontWeight: FontWeight.semibold,
        marginRight: 4,
    },
    inputInner: {
        flex: 1,
        paddingVertical: Spacing.md,
        paddingRight: Spacing.lg,
        color: Colors.text,
        fontSize: FontSize.md,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },

    // Save button
    saveBtn: {
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
        marginTop: Spacing.sm,
        ...Shadows.glow,
    },
    saveBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.lg,
    },
    saveBtnText: {
        color: '#fff',
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
    },
});

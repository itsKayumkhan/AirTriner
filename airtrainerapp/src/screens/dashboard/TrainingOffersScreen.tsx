import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
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
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';
import ScreenWrapper from '../../components/ui/ScreenWrapper';
import ScreenHeader from '../../components/ui/ScreenHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import LoadingScreen from '../../components/ui/LoadingScreen';
import SectionHeader from '../../components/ui/SectionHeader';
import TabFilter from '../../components/ui/TabFilter';
import Input from '../../components/ui/Input';
import Divider from '../../components/ui/Divider';

// ---- Types ----

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

type Camp = {
    name: string;
    hoursPerDay: number;
    days: number;
    totalPrice: number;
    location: string;
    startTime: string;
    endTime: string;
    dates: string[];
    maxSpots: number;
    spotsRemaining: number;
    description?: string;
    schedule?: { date: string; startTime: string }[];
};

type SessionDate = {
    date: string;
    time: string;
};

type TabKey = 'packages' | 'send';

const SESSION_TYPES = [
    { key: 'private', label: 'Private (1-on-1)' },
    { key: 'semi_private', label: 'Semi-Private' },
    { key: 'group', label: 'Group' },
    { key: 'camp', label: 'Camp' },
];

const EMPTY_FORM: FormState = {
    title: '',
    description: '',
    price: '',
    sport: '',
    duration_minutes: '60',
    max_athletes: '',
};

const SESSION_LENGTHS = [30, 45, 60, 90];

// ---- Component ----

export default function TrainingOffersScreen({ navigation }: any) {
    const { user } = useAuth();
    const trainerProfile = user?.trainerProfile;

    const [activeTab, setActiveTab] = useState<TabKey>('packages');

    // My Packages state
    const [offers, setOffers] = useState<TrainingOffer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [formErrors, setFormErrors] = useState<Partial<FormState>>({});

    // Send Offer state
    const [athleteQuery, setAthleteQuery] = useState('');
    const [athleteResults, setAthleteResults] = useState<Athlete[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
    const [offerMessage, setOfferMessage] = useState('');
    const [offerPrice, setOfferPrice] = useState('');
    const [sessionLength, setSessionLength] = useState(60);
    const [selectedSport, setSelectedSport] = useState('');
    const [sessionDates, setSessionDates] = useState<SessionDate[]>([{ date: '', time: '' }]);
    const [sessionType, setSessionType] = useState('private');
    const [isSendingOffer, setIsSendingOffer] = useState(false);

    // Camp state
    const [camps, setCamps] = useState<Camp[]>([]);
    const [selectedCamp, setSelectedCamp] = useState<number | null>(null);

    // Sent Offers state
    const [sentOffers, setSentOffers] = useState<SentOffer[]>([]);
    const [isSentLoading, setIsSentLoading] = useState(false);

    // Subscription check
    const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);

    const fetchSubscriptionStatus = useCallback(async () => {
        if (!user?.id) return;
        try {
            const { data } = await supabase
                .from('trainer_profiles')
                .select('subscription_status, camp_offerings')
                .eq('user_id', user.id)
                .single();
            setSubscriptionStatus(data?.subscription_status ?? null);
            if (data?.camp_offerings && Array.isArray(data.camp_offerings)) {
                setCamps(data.camp_offerings as Camp[]);
            }
        } catch (err) {
            console.error('Error fetching subscription status:', err);
        }
    }, [user?.id]);

    const isSubscriptionActive = subscriptionStatus === 'active' || subscriptionStatus === 'trial';

    // Data fetching

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

    // Athlete search

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

    // Form validation

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

    // Create offer

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

    // Send targeted offer

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

        const validDates = sessionDates.filter(d => d.date && d.time);
        if (validDates.length === 0) {
            Alert.alert('Error', 'Please add at least one date and time for the session.');
            return;
        }

        setIsSendingOffer(true);
        try {
            const trainerTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

            const proposedDates = {
                sessions: validDates.map(d => ({ date: d.date, time: d.time })),
                session_type: sessionType,
                timezone: trainerTimezone,
                scheduledAt: validDates[0].date,
                ...(selectedCamp !== null && camps[selectedCamp] ? { camp: camps[selectedCamp] } : {}),
            };

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

            await supabase.from('notifications').insert({
                user_id: selectedAthlete.id,
                type: 'TRAINING_OFFER',
                title: 'New Training Offer',
                body: `You received a training offer${selectedSport ? ` for ${selectedSport}` : ''}`,
                data: { offerId: 'will-be-set-by-trigger' },
                read: false,
            });

            Alert.alert('Offer Sent', `Your offer has been sent to ${selectedAthlete.first_name}`);

            setSelectedAthlete(null);
            setAthleteQuery('');
            setAthleteResults([]);
            setOfferMessage('');
            setOfferPrice('');
            setSessionLength(60);
            setSelectedSport('');
            setSessionDates([{ date: '', time: '' }]);
            setSessionType('private');
            setSelectedCamp(null);

            await fetchSentOffers();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Could not send offer.');
        } finally {
            setIsSendingOffer(false);
        }
    };

    // Delete offer

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

    // ---- Render ----

    if (isLoading) {
        return <LoadingScreen message="Loading training offers..." />;
    }

    // Locked state when subscription is not active
    if (subscriptionStatus !== null && !isSubscriptionActive) {
        return (
            <ScreenWrapper scrollable={false}>
                <ScreenHeader
                    title="Training Offers"
                    onBack={() => navigation.goBack()}
                />
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
                    <Button
                        title="Upgrade Subscription"
                        onPress={() => navigation.navigate('Subscription')}
                        icon="trophy-outline"
                        fullWidth={false}
                        style={styles.lockedButton}
                    />
                </View>
            </ScreenWrapper>
        );
    }

    const TABS = [
        { key: 'packages', label: 'My Packages' },
        { key: 'send', label: 'Send Offer' },
    ];

    return (
        <View style={styles.container}>
            {/* Header area */}
            <View style={styles.headerArea}>
                <ScreenHeader
                    title="Training Offers"
                    onBack={() => navigation.goBack()}
                />
                <TabFilter
                    tabs={TABS}
                    activeTab={activeTab}
                    onTabChange={(key) => setActiveTab(key as TabKey)}
                />
            </View>

            {/* Tab Content */}
            {activeTab === 'packages' ? (
                <>
                    <ScrollView
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
                        }
                    >
                        {/* Hint banner */}
                        <Card style={styles.hintCard}>
                            <View style={styles.hintRow}>
                                <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
                                <Text style={styles.hintText}>Long-press any card to delete it.</Text>
                            </View>
                        </Card>

                        {offers.length === 0 ? (
                            <EmptyState
                                icon="pricetag-outline"
                                title="No offers yet"
                                description={'Create your first training offer.\nTap the + button to get started.'}
                            />
                        ) : (
                            offers.map((offer) => (
                                <OfferCard key={offer.id} offer={offer} onLongPress={() => handleLongPress(offer)} />
                            ))
                        )}

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
                            <Ionicons name="add" size={30} color={Colors.text} />
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
                    <SectionHeader title="Find Athlete" />
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
                            <Avatar
                                name={`${selectedAthlete.first_name} ${selectedAthlete.last_name}`}
                                size={24}
                            />
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

                    {/* Offer Form */}
                    {selectedAthlete && (
                        <View style={styles.offerForm}>
                            <SectionHeader title="Offer Details" />

                            <Input
                                label="Message *"
                                value={offerMessage}
                                onChangeText={setOfferMessage}
                                placeholder="Describe your training offer..."
                                multiline
                                numberOfLines={4}
                            />

                            <Input
                                label="Sport"
                                icon="football-outline"
                                value={selectedSport}
                                onChangeText={setSelectedSport}
                                placeholder="e.g. Hockey, Basketball, Soccer"
                                autoCapitalize="words"
                            />

                            {/* Camp Selection */}
                            {camps.length > 0 && (
                                <View style={{ marginBottom: Spacing.lg }}>
                                    <Text style={styles.fieldLabel}>
                                        <Ionicons name="repeat-outline" size={12} color={Colors.textSecondary} />
                                        {'  '}Send a Camp Offer
                                    </Text>
                                    {camps.map((camp, idx) => {
                                        const isSelected = selectedCamp === idx;
                                        const isFull = (camp.spotsRemaining ?? 0) <= 0;
                                        const spotsRatio = (camp.maxSpots ?? 0) > 0 ? (camp.spotsRemaining ?? 0) / camp.maxSpots : 1;
                                        const spotsColor = isFull ? '#EF4444' : spotsRatio < 0.3 ? '#F59E0B' : '#22C55E';

                                        // Auto-calculate end time from startTime + hoursPerDay
                                        const formatTime12h = (timeStr: string) => {
                                            if (!timeStr) return '';
                                            const [h, m] = timeStr.split(':').map(Number);
                                            const ampm = h >= 12 ? 'PM' : 'AM';
                                            const hour12 = h % 12 || 12;
                                            return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
                                        };
                                        const calcEndTime = () => {
                                            if (camp.endTime) return formatTime12h(camp.endTime);
                                            if (!camp.startTime || !camp.hoursPerDay) return '';
                                            const [h, m] = camp.startTime.split(':').map(Number);
                                            const endH = h + camp.hoursPerDay;
                                            return formatTime12h(`${endH}:${String(m).padStart(2, '0')}`);
                                        };

                                        // Format date range
                                        const formatDateRange = () => {
                                            if (!camp.dates || camp.dates.length === 0) return '';
                                            const fmt = (d: string) => {
                                                const dt = new Date(d);
                                                return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                            };
                                            if (camp.dates.length === 1) return fmt(camp.dates[0]);
                                            return `${fmt(camp.dates[0])} → ${fmt(camp.dates[camp.dates.length - 1])}`;
                                        };

                                        return (
                                            <TouchableOpacity
                                                key={idx}
                                                activeOpacity={isFull ? 1 : 0.7}
                                                disabled={isFull}
                                                onPress={() => {
                                                    if (isFull) return;
                                                    if (isSelected) {
                                                        setSelectedCamp(null);
                                                        setSessionType('private');
                                                        setOfferPrice('');
                                                        setSessionDates([{ date: '', time: '' }]);
                                                    } else {
                                                        setSelectedCamp(idx);
                                                        setSessionType('camp');
                                                        setOfferPrice(camp.totalPrice.toString());
                                                        if (!offerMessage.trim()) {
                                                            setOfferMessage(`Join my ${camp.name} camp! ${camp.hoursPerDay} hrs/day for ${camp.days} days.`);
                                                        }
                                                        // Auto-fill dates from camp schedule
                                                        const campSchedule = camp.schedule;
                                                        let autoSessionDates: SessionDate[] = [];
                                                        if (campSchedule?.length) {
                                                            autoSessionDates = campSchedule.map(s => ({ date: s.date, time: s.startTime }));
                                                        } else if (camp.dates?.length) {
                                                            autoSessionDates = camp.dates.map(d => ({ date: d, time: camp.startTime || "" }));
                                                        }
                                                        if (autoSessionDates.length === 0) autoSessionDates = [{ date: "", time: "" }];
                                                        setSessionDates(autoSessionDates);
                                                    }
                                                }}
                                                style={[
                                                    styles.campCard,
                                                    isSelected && styles.campCardActive,
                                                    isFull && { opacity: 0.5 },
                                                ]}
                                            >
                                                <View style={{ flex: 1 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                        <Text style={[styles.campName, isSelected && { color: Colors.text }]}>{camp.name}</Text>
                                                        {isFull && (
                                                            <View style={{ backgroundColor: '#EF4444', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                                                                <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>Camp Full</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    {camp.description ? (
                                                        <Text
                                                            style={[styles.campMeta, { marginTop: 4, fontStyle: 'italic' }]}
                                                            numberOfLines={2}
                                                            ellipsizeMode="tail"
                                                        >
                                                            {camp.description}
                                                        </Text>
                                                    ) : null}
                                                    <Text style={[styles.campMeta, camp.description ? { marginTop: 4 } : null]}>
                                                        {camp.hoursPerDay} hrs/day x {camp.days} days
                                                    </Text>
                                                    {camp.location ? (
                                                        <Text style={[styles.campMeta, { marginTop: 2 }]}>
                                                            <Ionicons name="location-outline" size={10} color={Colors.textTertiary} />
                                                            {'  '}{camp.location}
                                                        </Text>
                                                    ) : null}
                                                    {camp.startTime ? (
                                                        <Text style={[styles.campMeta, { marginTop: 2 }]}>
                                                            <Ionicons name="time-outline" size={10} color={Colors.textTertiary} />
                                                            {'  '}{formatTime12h(camp.startTime)} - {calcEndTime()}
                                                        </Text>
                                                    ) : null}
                                                    {camp.dates && camp.dates.length > 0 ? (
                                                        <Text style={[styles.campMeta, { marginTop: 2 }]}>
                                                            <Ionicons name="calendar-outline" size={10} color={Colors.textTertiary} />
                                                            {'  '}{formatDateRange()}
                                                        </Text>
                                                    ) : null}
                                                    {/* Spots indicator */}
                                                    {(camp.maxSpots ?? 0) > 0 && (
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
                                                            <View style={{ flex: 1, height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' }}>
                                                                <View style={{ width: `${Math.max(spotsRatio * 100, 0)}%`, height: '100%', backgroundColor: spotsColor, borderRadius: 2 }} />
                                                            </View>
                                                            <Text style={{ fontSize: 10, color: spotsColor, fontWeight: '600' }}>
                                                                {isFull ? 'Full' : `${camp.spotsRemaining}/${camp.maxSpots} spots`}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={[styles.campPrice, isSelected && { color: Colors.primary }]}>
                                                    ${camp.totalPrice.toLocaleString()}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                    {selectedCamp !== null && (
                                        <Text style={styles.campHint}>
                                            Camp selected -- rate and message auto-filled. You can still edit below.
                                        </Text>
                                    )}
                                </View>
                            )}

                            {/* Session Type */}
                            <Text style={styles.fieldLabel}>Session Type</Text>
                            <View style={styles.chipRow}>
                                {SESSION_TYPES.map((st) => (
                                    <TouchableOpacity
                                        key={st.key}
                                        style={[styles.chip, sessionType === st.key && styles.chipActive]}
                                        onPress={() => setSessionType(st.key)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.chipText, sessionType === st.key && styles.chipTextActive]}>
                                            {st.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Input
                                label="Price (USD) *"
                                icon="cash-outline"
                                value={offerPrice}
                                onChangeText={setOfferPrice}
                                keyboardType="decimal-pad"
                                placeholder="50"
                            />

                            {/* Session Length */}
                            <Text style={styles.fieldLabel}>Session Length</Text>
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

                            {/* Session Dates & Times (multiple) */}
                            <Text style={styles.fieldLabel}>Session Date & Time</Text>
                            {selectedCamp !== null ? (
                                /* Read-only session dates auto-filled from camp */
                                <View>
                                    {sessionDates.map((session, idx) => (
                                        <View key={idx} style={[styles.row, { marginBottom: Spacing.sm, alignItems: 'center' }]}>
                                            <View style={[styles.readOnlyDateBox, { flex: 1 }]}>
                                                <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
                                                <Text style={styles.readOnlyDateText}>{session.date || '—'}</Text>
                                            </View>
                                            <View style={{ width: Spacing.sm }} />
                                            <View style={[styles.readOnlyDateBox, { flex: 1 }]}>
                                                <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
                                                <Text style={styles.readOnlyDateText}>{session.time || '—'}</Text>
                                            </View>
                                        </View>
                                    ))}
                                    <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.sm }}>
                                        Dates auto-filled from camp schedule
                                    </Text>
                                </View>
                            ) : (
                                /* Editable session dates for private offers */
                                <>
                                    {sessionDates.map((session, idx) => (
                                        <View key={idx} style={[styles.row, { marginBottom: Spacing.sm, alignItems: 'center' }]}>
                                            <View style={{ flex: 1 }}>
                                                <Input
                                                    icon="calendar-outline"
                                                    value={session.date}
                                                    onChangeText={(val: string) => {
                                                        const updated = [...sessionDates];
                                                        updated[idx] = { ...updated[idx], date: val };
                                                        setSessionDates(updated);
                                                    }}
                                                    placeholder="YYYY-MM-DD"
                                                />
                                            </View>
                                            <View style={{ width: Spacing.sm }} />
                                            <View style={{ flex: 1 }}>
                                                <Input
                                                    icon="time-outline"
                                                    value={session.time}
                                                    onChangeText={(val: string) => {
                                                        const updated = [...sessionDates];
                                                        updated[idx] = { ...updated[idx], time: val };
                                                        setSessionDates(updated);
                                                    }}
                                                    placeholder="HH:MM"
                                                />
                                            </View>
                                            {sessionDates.length > 1 && (
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setSessionDates(prev => prev.filter((_, i) => i !== idx));
                                                    }}
                                                    style={styles.removeDateBtn}
                                                    activeOpacity={0.7}
                                                >
                                                    <Ionicons name="trash-outline" size={16} color={Colors.error} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    ))}
                                    <TouchableOpacity
                                        onPress={() => setSessionDates(prev => [...prev, { date: '', time: '' }])}
                                        style={styles.addDateBtn}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="add-circle-outline" size={16} color={Colors.primary} />
                                        <Text style={styles.addDateText}>Add Another Date & Time</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                            <Text style={styles.timezoneHint}>
                                Times are in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                            </Text>

                            <Button
                                title="Send Offer"
                                onPress={handleSendOffer}
                                icon="send"
                                loading={isSendingOffer}
                                disabled={isSendingOffer}
                                size="lg"
                            />
                        </View>
                    )}

                    {/* Sent Offers Section */}
                    <Divider />
                    <SectionHeader title="Sent Offers" />
                    {isSentLoading ? (
                        <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: Spacing.xl }} />
                    ) : sentOffers.length === 0 ? (
                        <EmptyState
                            icon="paper-plane-outline"
                            title="No offers sent yet"
                            description="Send your first offer to an athlete above."
                        />
                    ) : (
                        sentOffers.map((offer) => (
                            <SentOfferCard key={offer.id} offer={offer} />
                        ))
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>
            )}

            {/* Create Modal */}
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

// ---- Sub-components ----

function AthleteCard({
    athlete,
    isSelected,
    onSelect,
}: {
    athlete: Athlete;
    isSelected: boolean;
    onSelect: () => void;
}) {
    const name = `${athlete.first_name} ${athlete.last_name}`;
    return (
        <Card
            onPress={onSelect}
            style={isSelected ? styles.athleteCardSelected : undefined}
        >
            <View style={styles.athleteCardContent}>
                <Avatar name={name} uri={athlete.avatar_url} size={40} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.athleteName}>{name}</Text>
                    <Text style={styles.athleteEmail} numberOfLines={1}>{athlete.email}</Text>
                </View>
                {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
                )}
            </View>
        </Card>
    );
}

function SentOfferCard({ offer }: { offer: SentOffer }) {
    const athleteName = offer.athlete
        ? `${offer.athlete.first_name} ${offer.athlete.last_name}`
        : 'Unknown Athlete';

    const statusConfig = getStatusConfig(offer.status);
    const sportColor = getSportColor(offer.sport);
    const createdDate = new Date(offer.created_at);
    const dateStr = createdDate.toLocaleDateString();
    const timeStr = createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
    const offerSessionType = offer.proposed_dates?.session_type;

    return (
        <Card style={styles.sentCard}>
            <View style={styles.sentCardTop}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.sentAthleteName}>{athleteName}</Text>
                    {!!offer.sport && (
                        <View style={styles.sentSportRow}>
                            <View style={[styles.sportDot, { backgroundColor: sportColor }]} />
                            <Text style={styles.sentSportText}>{offer.sport}</Text>
                        </View>
                    )}
                    {!!offerSessionType && (
                        <Text style={styles.sentSessionType}>
                            {offerSessionType.replace('_', ' ')} session
                        </Text>
                    )}
                </View>
                <Badge
                    label={`$${Number(offer.price).toFixed(0)}`}
                    color={Colors.primary}
                    bgColor={Colors.primaryGlow}
                    size="md"
                />
            </View>
            <View style={styles.sentCardBottom}>
                <Badge
                    label={statusConfig.label}
                    color={statusConfig.color}
                    bgColor={statusConfig.bg}
                    dot
                    size="sm"
                />
                <Text style={styles.sentDateText}>{dateStr} at {timeStr}</Text>
            </View>
        </Card>
    );
}

function OfferCard({ offer, onLongPress }: { offer: TrainingOffer; onLongPress: () => void }) {
    const sportColor = getSportColor(offer.sport);
    return (
        <TouchableHighlight
            onLongPress={onLongPress}
            underlayColor={Colors.cardHover}
            style={styles.offerTouchable}
            delayLongPress={400}
        >
            <Card noPadding style={styles.offerCardInner}>
                <View style={styles.offerCardPadding}>
                    {/* Top row */}
                    <View style={styles.cardTop}>
                        <View style={[styles.sportDot, { backgroundColor: sportColor }]} />
                        <Text style={styles.cardTitle} numberOfLines={1}>{offer.title}</Text>
                        <Badge
                            label={`$${Number(offer.price).toFixed(0)}`}
                            color={Colors.primary}
                            bgColor={Colors.primaryGlow}
                            size="md"
                        />
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
            </Card>
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
                        <View style={styles.modalHandle} />

                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>New Training Offer</Text>
                            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
                                <Ionicons name="close" size={22} color={Colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <Input
                                label="Title *"
                                value={form.title}
                                onChangeText={(v: string) => onChange('title', v)}
                                placeholder="e.g. 1-on-1 Power Skating Session"
                                error={errors.title}
                            />

                            <Input
                                label="Description"
                                value={form.description}
                                onChangeText={(v: string) => onChange('description', v)}
                                placeholder="Describe what athletes will get..."
                                multiline
                                numberOfLines={4}
                            />

                            <View style={styles.row}>
                                <View style={{ flex: 1 }}>
                                    <Input
                                        label="Price (USD) *"
                                        icon="cash-outline"
                                        value={form.price}
                                        onChangeText={(v: string) => onChange('price', v)}
                                        keyboardType="decimal-pad"
                                        placeholder="50"
                                        error={errors.price}
                                    />
                                </View>
                                <View style={{ width: Spacing.md }} />
                                <View style={{ flex: 1 }}>
                                    <Input
                                        label="Duration (min) *"
                                        icon="time-outline"
                                        value={form.duration_minutes}
                                        onChangeText={(v: string) => onChange('duration_minutes', v)}
                                        keyboardType="number-pad"
                                        placeholder="60"
                                        error={errors.duration_minutes}
                                    />
                                </View>
                            </View>

                            <Input
                                label="Sport"
                                icon="football-outline"
                                value={form.sport}
                                onChangeText={(v: string) => onChange('sport', v)}
                                placeholder="e.g. Hockey, Basketball, Soccer"
                                autoCapitalize="words"
                            />

                            <Input
                                label="Max Athletes (optional)"
                                icon="people-outline"
                                value={form.max_athletes}
                                onChangeText={(v: string) => onChange('max_athletes', v)}
                                keyboardType="number-pad"
                                placeholder="Leave blank for unlimited"
                            />

                            <Button
                                title="Save Offer"
                                onPress={onSave}
                                icon="checkmark-circle"
                                loading={isSaving}
                                disabled={isSaving}
                                size="lg"
                            />

                            <View style={{ height: 32 }} />
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

// ---- Helpers ----

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
        case 'expired':
            return { label: 'Expired', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.1)' };
        case 'pending':
        default:
            return { label: 'Pending', color: Colors.warning, bg: Colors.warningLight };
    }
}

// ---- Styles ----

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    headerArea: {
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.huge,
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
        borderColor: Colors.warningMuted,
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
        paddingHorizontal: Spacing.xxl,
    },

    // List
    list: {
        padding: Spacing.xl,
        paddingBottom: Spacing.huge,
    },

    // Hint
    hintCard: {
        backgroundColor: Colors.primaryGlow,
        borderColor: Colors.borderActive,
        marginBottom: Spacing.xl,
    },
    hintRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    hintText: {
        fontSize: FontSize.sm,
        color: Colors.primary,
    },

    // Field label (for chip section)
    fieldLabel: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.textSecondary,
        marginBottom: Spacing.sm,
    },

    // Athlete search
    searchInputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
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
    athleteCardSelected: {
        borderColor: Colors.borderActive,
        borderWidth: 2,
        backgroundColor: Colors.cardHover,
    },
    athleteCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
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
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    chipActive: {
        backgroundColor: Colors.primaryMuted,
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

    // Camp cards
    campCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.sm,
    },
    campCardActive: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primaryGlow,
    },
    campName: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.textSecondary,
    },
    campMeta: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        marginTop: 2,
    },
    campPrice: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.textTertiary,
    },
    campHint: {
        fontSize: FontSize.xs,
        color: Colors.primary,
        marginTop: Spacing.xs,
        opacity: 0.7,
        fontWeight: FontWeight.bold,
    },

    // Add/remove date buttons
    addDateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        paddingVertical: Spacing.md,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: Colors.border,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.sm,
    },
    addDateText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },
    removeDateBtn: {
        width: 36,
        height: 36,
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.errorLight,
        borderWidth: 1,
        borderColor: Colors.error + '30',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: Spacing.xs,
    },
    readOnlyDateBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.glass,
        borderRadius: BorderRadius.sm,
        borderWidth: 1,
        borderColor: Colors.borderLight,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        gap: Spacing.xs,
    },
    readOnlyDateText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    timezoneHint: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        marginBottom: Spacing.lg,
        opacity: 0.6,
    },

    // Sent offers
    sentSessionType: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        textTransform: 'capitalize',
        marginTop: 2,
    },
    sentCard: {
        marginBottom: Spacing.md,
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
    sentDateText: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
    },

    // Sport dot
    sportDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },

    // Offer card
    offerTouchable: {
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.md,
        ...Shadows.small,
    },
    offerCardInner: {
        marginBottom: 0,
    },
    offerCardPadding: {
        padding: Spacing.lg,
    },
    cardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    cardTitle: {
        flex: 1,
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.text,
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
        backgroundColor: Colors.glass,
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
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Form
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
});

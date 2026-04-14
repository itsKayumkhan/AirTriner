import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
    FlatList, Modal, Dimensions, TextInput, Pressable,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, TrainerProfileRow, UserRow, AthleteProfileRow } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows, Layout } from '../../theme';
import {
    ScreenWrapper, Avatar, Badge, Button,
    EmptyState, LoadingScreen,
} from '../../components/ui';
import Founding50Badge from '../../components/Founding50Badge';
import TrainerMapView, { TrainerPin } from '../../components/TrainerMapView';
import LocationAutocomplete, { LocationValue } from '../../components/LocationAutocomplete';

// ─── Sport categories loaded from DB, with fallback ───
const FALLBACK_SPORT_OPTIONS: { slug: string; name: string }[] = [
    { slug: 'hockey', name: 'Hockey' },
    { slug: 'baseball', name: 'Baseball' },
    { slug: 'basketball', name: 'Basketball' },
    { slug: 'soccer', name: 'Soccer' },
    { slug: 'football', name: 'Football' },
    { slug: 'tennis', name: 'Tennis' },
    { slug: 'golf', name: 'Golf' },
    { slug: 'swimming', name: 'Swimming' },
    { slug: 'boxing', name: 'Boxing' },
    { slug: 'lacrosse', name: 'Lacrosse' },
    { slug: 'wrestling', name: 'Wrestling' },
    { slug: 'martial_arts', name: 'Martial Arts' },
    { slug: 'gymnastics', name: 'Gymnastics' },
    { slug: 'track_and_field', name: 'Track & Field' },
    { slug: 'volleyball', name: 'Volleyball' },
];

// Sport emoji map for filter pills
const SPORT_EMOJI: Record<string, string> = {
    hockey: '\u{1F3D2}',
    baseball: '\u{26BE}',
    basketball: '\u{1F3C0}',
    soccer: '\u{26BD}',
    football: '\u{1F3C8}',
    tennis: '\u{1F3BE}',
    golf: '\u{26F3}',
    swimming: '\u{1F3CA}',
    boxing: '\u{1F94A}',
    lacrosse: '\u{1F94D}',
    wrestling: '\u{1F93C}',
    martial_arts: '\u{1F94B}',
    gymnastics: '\u{1F938}',
    track_and_field: '\u{1F3C3}',
    volleyball: '\u{1F3D0}',
};

const RATING_OPTIONS = [
    { label: 'Any', value: 0 },
    { label: '3.5+', value: 3.5 },
    { label: '4.0+', value: 4.0 },
    { label: '4.5+', value: 4.5 },
];

const SKILL_LEVELS = [
    { label: 'Beginner', value: 'beginner' },
    { label: 'Intermediate', value: 'intermediate' },
    { label: 'Advanced', value: 'advanced' },
    { label: 'Pro', value: 'pro' },
];

const DURATION_OPTIONS = [
    { label: 'Any', value: null as number | null },
    { label: '30m', value: 30 },
    { label: '45m', value: 45 },
    { label: '1h', value: 60 },
    { label: '1.5h', value: 90 },
];

const TIME_OPTIONS = [
    { label: 'Any Time', value: 'any' },
    { label: 'Morning', value: 'morning' },
    { label: 'Afternoon', value: 'afternoon' },
    { label: 'Evening', value: 'evening' },
];

const PRICE_OPTIONS = [
    { label: 'Any Price', value: 300 },
    { label: 'Under $50/hr', value: 50 },
    { label: 'Under $100/hr', value: 100 },
    { label: 'Under $150/hr', value: 150 },
    { label: 'Under $200/hr', value: 200 },
];

const SORT_OPTIONS = [
    { label: 'Relevance', value: 'match' },
    { label: 'Rating', value: 'rating' },
    { label: 'Price', value: 'price_low' },
    { label: 'Distance', value: 'distance' },
];

// ─── Types ───
interface TrainerWithUser extends TrainerProfileRow {
    users: UserRow;
    avg_rating: number;
    review_count: number;
    matchScore: number;
    dispute_count: number;
    is_performance_verified: boolean;
    is_new: boolean;
    is_top_rated: boolean;
    session_lengths?: number[];
    target_skill_levels?: string[];
    preferred_training_times?: string[];
}

// ─── Haversine distance (miles) ───
const calculateDistance = (
    lat1: number | null, lon1: number | null,
    lat2: number | null, lon2: number | null
): number => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 9999;
    const R = 3958.8;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const normalizeSport = (s: string) =>
    s.toLowerCase().replace(/\s+&\s+/g, '_and_').replace(/\s+/g, '_').replace(/[^a-z_]/g, '');

const { width: SCREEN_WIDTH } = Dimensions.get('window');


export default function DiscoverScreen({ navigation }: any) {
    const { user } = useAuth();
    const [trainers, setTrainers] = useState<TrainerWithUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Sport categories from DB
    const [sportOptions, setSportOptions] = useState(FALLBACK_SPORT_OPTIONS);
    const [sportLabels, setSportLabels] = useState<Record<string, string>>({});

    // ─── Filters ───
    const [searchQuery, setSearchQuery] = useState('');
    const [sportFilter, setSportFilter] = useState('all');
    const [locationFilter, setLocationFilter] = useState('');
    const [skillFilter, setSkillFilter] = useState('any');
    const [timeFilter, setTimeFilter] = useState('any');
    const [maxRate, setMaxRate] = useState(300);
    const [minRating, setMinRating] = useState(0);
    const [durationFilter, setDurationFilter] = useState<number | null>(null);
    const [sortBy, setSortBy] = useState('match');

    // View mode: list or map
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

    // Filter modal
    const [filterModalVisible, setFilterModalVisible] = useState(false);

    // ─── Load sport categories from DB ───
    useEffect(() => {
        const fetchSports = async () => {
            const { data, error } = await supabase
                .from('sports')
                .select('id, name, slug')
                .eq('is_active', true)
                .order('name');
            if (!error && data && data.length > 0) {
                const opts = (data as { id: string; name: string; slug: string }[]).map((s) => ({
                    slug: s.slug,
                    name: s.name,
                }));
                setSportOptions(opts);
                const labels: Record<string, string> = {};
                opts.forEach((s) => { labels[s.slug] = s.name; });
                setSportLabels(labels);
            } else {
                const labels: Record<string, string> = {};
                FALLBACK_SPORT_OPTIONS.forEach((s) => { labels[s.slug] = s.name; });
                setSportLabels(labels);
            }
        };
        fetchSports();
    }, []);

    // ─── Load trainers (matching web logic) ───
    const fetchTrainers = useCallback(async () => {
        try {
            // 1. Platform settings
            const { data: settings } = await supabase
                .from('platform_settings')
                .select('require_trainer_verification')
                .single();
            const requireVerification = settings?.require_trainer_verification ?? true;

            // 2. Trainer profiles
            let query = supabase
                .from('trainer_profiles')
                .select('*, is_founding_50')
                .in('subscription_status', ['trial', 'active']);

            if (requireVerification) {
                query = query.eq('verification_status', 'verified');
            }

            const { data: profiles, error } = await query;
            if (error) throw error;
            if (!profiles || profiles.length === 0) {
                setTrainers([]);
                setIsLoading(false);
                return;
            }

            // 3. Users for those profiles
            const userIds = profiles.map((p: any) => p.user_id);
            const { data: users } = await supabase
                .from('users')
                .select('id, first_name, last_name, avatar_url, role')
                .in('id', userIds);

            const usersMap = new Map(
                (users || []).map((u: any) => [u.id, u])
            );

            // 4. Disputes for verification logic
            let disputeCounts = new Map<string, number>();
            try {
                const { data: disputesData } = await supabase
                    .from('disputes')
                    .select('booking:bookings!inner(trainer_id)')
                    .in('booking.trainer_id', userIds);
                (disputesData || []).forEach((d: any) => {
                    const tid = d.booking?.trainer_id;
                    if (tid) disputeCounts.set(tid, (disputeCounts.get(tid) || 0) + 1);
                });
            } catch (_) {
                // disputes table may not exist yet
            }

            // 5. Athlete profile for match scoring
            const athleteProfile = user?.athleteProfile as AthleteProfileRow | undefined;

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const enriched: TrainerWithUser[] = (profiles as any[])
                .filter((p) => {
                    const u = usersMap.get(p.user_id);
                    return u && u.role === 'trainer';
                })
                .map((p) => {
                    const u = usersMap.get(p.user_id)!;
                    const disputeCount = disputeCounts.get(p.user_id) || 0;

                    // Performance verified
                    const isPerformanceVerified =
                        p.total_sessions >= 3 &&
                        disputeCount === 0 &&
                        Number(p.completion_rate) >= 95 &&
                        Number(p.reliability_score) >= 95;

                    // New badge (< 30 days)
                    const isNew = p.created_at
                        ? new Date(p.created_at) > thirtyDaysAgo
                        : false;

                    // ─── Match score calculation ───
                    let matchScore = 50;
                    if (athleteProfile) {
                        const sportOverlap = (athleteProfile.sports || []).filter(
                            (s: string) => (p.sports || []).includes(s)
                        );
                        if (sportOverlap.length > 0) matchScore += 20;

                        const distance = calculateDistance(
                            athleteProfile.latitude, athleteProfile.longitude,
                            p.latitude, p.longitude
                        );
                        if (
                            athleteProfile.city &&
                            p.city &&
                            athleteProfile.city.toLowerCase() === p.city.toLowerCase()
                        ) {
                            matchScore += 15;
                        } else if (distance <= (p.travel_radius_miles || 20)) {
                            matchScore += 10;
                        } else if (distance <= 50) {
                            matchScore += 5;
                        }

                        if (
                            athleteProfile.skill_level &&
                            p.target_skill_levels?.includes(athleteProfile.skill_level)
                        ) {
                            matchScore += 10;
                        }

                        const athleteTimes = (athleteProfile as any).preferredTrainingTimes ||
                            (athleteProfile as any).preferred_training_times;
                        const trainerTimes = p.preferred_training_times || p.preferredTrainingTimes;
                        if (athleteTimes && trainerTimes) {
                            const timeOverlap = athleteTimes.some((t: string) =>
                                trainerTimes.includes(t)
                            );
                            if (timeOverlap) matchScore += 10;
                        }
                    }

                    const rating = p.average_rating || 0;
                    if (rating >= 4.8) matchScore += 10;
                    else if (rating >= 4.5) matchScore += 5;

                    return {
                        ...p,
                        users: u as UserRow,
                        avg_rating: rating,
                        review_count: p.total_reviews || 0,
                        matchScore: Math.min(100, matchScore),
                        dispute_count: disputeCount,
                        is_performance_verified: isPerformanceVerified,
                        is_new: isNew,
                        is_top_rated: Number(p.average_rating) >= 4.8 && Number(p.total_reviews) >= 5,
                    } as TrainerWithUser;
                });

            setTrainers(enriched);
        } catch (err) {
            console.error('Failed to load trainers:', err);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchTrainers();
    }, [fetchTrainers]);

    // ─── Filtered + sorted trainers ───
    const filteredTrainers = useMemo(() => {
        const athleteProfile = user?.athleteProfile as AthleteProfileRow | undefined;

        const result = trainers.filter((t) => {
            // Unified search: name, sport, or location
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const fullName = `${t.users?.first_name || ''} ${t.users?.last_name || ''}`.toLowerCase();
                const loc = `${t.city || ''} ${t.state || ''}`.toLowerCase();
                const sports = (t.sports || []).map((s) =>
                    (sportLabels[normalizeSport(s)] || s.replace(/_/g, ' ')).toLowerCase()
                ).join(' ');
                if (!fullName.includes(q) && !loc.includes(q) && !sports.includes(q)) return false;
            }

            // Sport
            if (sportFilter !== 'all') {
                const trainerSports = (t.sports || []).map(normalizeSport);
                if (!trainerSports.includes(normalizeSport(sportFilter))) return false;
            }

            // Location
            if (locationFilter) {
                const loc = `${t.city || ''} ${t.state || ''}`.toLowerCase();
                if (!loc.includes(locationFilter.toLowerCase())) return false;
            }

            // Price
            if (maxRate < 300 && Number(t.hourly_rate) > maxRate) return false;

            // Rating
            if (minRating > 0 && t.avg_rating < minRating) return false;

            // Skill level
            if (skillFilter !== 'any') {
                const levels = t.target_skill_levels as string[] | undefined;
                if (!levels || !levels.includes(skillFilter)) return false;
            }

            // Time of day
            if (timeFilter !== 'any') {
                const times = t.preferred_training_times || (t as any).preferredTrainingTimes;
                if (!times || !times.includes(timeFilter)) return false;
            }

            // Duration
            if (durationFilter !== null) {
                if (!t.session_lengths?.includes(durationFilter)) return false;
            }

            return true;
        });

        switch (sortBy) {
            case 'match':
                result.sort((a, b) => b.matchScore - a.matchScore);
                break;
            case 'price_low':
                result.sort((a, b) => Number(a.hourly_rate) - Number(b.hourly_rate));
                break;
            case 'price_high':
                result.sort((a, b) => Number(b.hourly_rate) - Number(a.hourly_rate));
                break;
            case 'rating':
                result.sort((a, b) => b.avg_rating - a.avg_rating);
                break;
            case 'distance':
                if (athleteProfile) {
                    result.sort((a, b) => {
                        const distA = calculateDistance(
                            athleteProfile.latitude, athleteProfile.longitude,
                            a.latitude, a.longitude
                        );
                        const distB = calculateDistance(
                            athleteProfile.latitude, athleteProfile.longitude,
                            b.latitude, b.longitude
                        );
                        return distA - distB;
                    });
                }
                break;
        }

        return result;
    }, [trainers, searchQuery, sportFilter, locationFilter, maxRate, minRating, skillFilter, timeFilter, durationFilter, sortBy, sportLabels, user]);

    // ─── Map pins from filtered trainers ───
    const trainerPins: TrainerPin[] = useMemo(() => {
        return filteredTrainers
            .filter((t) => t.latitude && t.longitude)
            .map((t) => ({
                id: t.id,
                userId: t.user_id,
                name: `${t.users?.first_name || ''} ${t.users?.last_name || ''}`.trim(),
                sport: (t.sports || [])[0]?.replace(/_/g, ' ') || '',
                rating: t.avg_rating,
                reviewCount: t.review_count,
                hourlyRate: Number(t.hourly_rate || 0),
                lat: Number(t.latitude),
                lng: Number(t.longitude),
                avatarUrl: t.users?.avatar_url,
                isFounder: !!t.is_founding_50,
                isTopRated: t.is_top_rated,
                isNew: t.is_new,
            }));
    }, [filteredTrainers]);

    // ─── Location autocomplete handler ───
    const handleLocationSelect = (loc: LocationValue) => {
        setLocationFilter(loc.city ? `${loc.city}${loc.state ? `, ${loc.state}` : ''}` : '');
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchTrainers();
        setRefreshing(false);
    };

    // ─── Active filter count ───
    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (sportFilter !== 'all') count++;
        if (locationFilter) count++;
        if (skillFilter !== 'any') count++;
        if (timeFilter !== 'any') count++;
        if (minRating > 0) count++;
        if (maxRate < 300) count++;
        if (durationFilter !== null) count++;
        return count;
    }, [sportFilter, locationFilter, skillFilter, timeFilter, minRating, maxRate, durationFilter]);

    const clearAllFilters = () => {
        setSportFilter('all');
        setLocationFilter('');
        setSkillFilter('any');
        setTimeFilter('any');
        setMinRating(0);
        setMaxRate(300);
        setDurationFilter(null);
        setSearchQuery('');
        setSortBy('match');
    };

    // ─── Compute distance for a trainer ───
    const getTrainerDistance = useCallback((t: TrainerWithUser): number | null => {
        const athleteProfile = user?.athleteProfile as AthleteProfileRow | undefined;
        if (!athleteProfile) return null;
        const d = calculateDistance(
            athleteProfile.latitude, athleteProfile.longitude,
            t.latitude, t.longitude
        );
        return d < 9999 ? d : null;
    }, [user]);

    // ─── Render a single trainer card ───
    const renderTrainerCard = ({ item, index }: { item: TrainerWithUser; index: number }) => {
        const avatarUrl = item.users?.avatar_url;
        const trainerFullName = `${item.users?.first_name || ''} ${item.users?.last_name || ''}`.trim();
        const distance = getTrainerDistance(item);
        const yearsExp = item.years_experience || null;
        const bio = item.bio || item.headline || '';

        return (
            <Pressable
                style={({ pressed }) => [
                    styles.trainerCard,
                    pressed && styles.trainerCardPressed,
                ]}
                onPress={() =>
                    navigation.navigate('TrainerDetail', {
                        trainerId: item.user_id,
                        trainer: item,
                    })
                }
            >
                {/* TOP: Avatar + Info */}
                <View style={styles.cardTop}>
                    <Avatar
                        uri={avatarUrl}
                        name={trainerFullName}
                        size={64}
                        borderColor={Colors.primaryGlow}
                    />
                    <View style={styles.cardTopInfo}>
                        <View style={styles.nameRow}>
                            <Text style={styles.trainerName} numberOfLines={1}>
                                {trainerFullName}
                            </Text>
                            {item.is_founding_50 && <Founding50Badge size="small" />}
                        </View>

                        {(item.city || item.state) && (
                            <View style={styles.locationRow}>
                                <Ionicons name="location-sharp" size={13} color={Colors.textTertiary} />
                                <Text style={styles.locationText} numberOfLines={1}>
                                    {item.city}{item.state ? `, ${item.state}` : ''}
                                </Text>
                            </View>
                        )}

                        <View style={styles.ratingRow}>
                            <Ionicons name="star" size={14} color={Colors.warning} />
                            <Text style={styles.ratingValue}>
                                {item.avg_rating.toFixed(1)}
                            </Text>
                            <Text style={styles.reviewCount}>
                                ({item.review_count} review{item.review_count !== 1 ? 's' : ''})
                            </Text>
                        </View>

                        {/* Badge pills */}
                        <View style={styles.badgePills}>
                            {item.is_performance_verified && (
                                <View style={[styles.badgePill, styles.badgePillVerified]}>
                                    <Ionicons name="checkmark-circle" size={12} color={Colors.primary} />
                                    <Text style={[styles.badgePillText, { color: Colors.primary }]}>Verified</Text>
                                </View>
                            )}
                            {item.is_top_rated && (
                                <View style={[styles.badgePill, styles.badgePillTopRated]}>
                                    <Text style={[styles.badgePillText, { color: '#FF9500' }]}>Top Rated</Text>
                                </View>
                            )}
                            {item.is_new && (
                                <View style={[styles.badgePill, styles.badgePillNew]}>
                                    <Text style={[styles.badgePillText, { color: Colors.success }]}>New</Text>
                                </View>
                            )}
                            {(item.sports || []).slice(0, 2).map((sport) => (
                                <View key={sport} style={styles.badgePill}>
                                    <Text style={styles.badgePillText}>
                                        {sportLabels[normalizeSport(sport)] || sport.replace(/_/g, ' ')}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>

                {/* MIDDLE: Bio + Price + Experience */}
                <View style={styles.cardMiddle}>
                    {bio ? (
                        <Text style={styles.bioText} numberOfLines={2}>
                            {bio}
                        </Text>
                    ) : null}
                    <View style={styles.priceExpRow}>
                        <Text style={styles.priceDisplay}>
                            <Text style={styles.priceAmount}>
                                ${Number(item.hourly_rate || 0).toFixed(0)}
                            </Text>
                            <Text style={styles.priceUnit}>/hr</Text>
                        </Text>
                        {yearsExp != null && (
                            <View style={styles.expBadge}>
                                <Ionicons name="ribbon-outline" size={13} color={Colors.textSecondary} />
                                <Text style={styles.expText}>{yearsExp} year{yearsExp !== 1 ? 's' : ''}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* BOTTOM: Stats row + View Profile button */}
                <View style={styles.cardBottom}>
                    <View style={styles.statsRow}>
                        {distance != null && (
                            <View style={styles.statItem}>
                                <Ionicons name="navigate-outline" size={13} color={Colors.textTertiary} />
                                <Text style={styles.statText}>{distance.toFixed(1)} mi away</Text>
                            </View>
                        )}
                        {item.total_sessions > 0 && (
                            <View style={styles.statItem}>
                                <Ionicons name="fitness-outline" size={13} color={Colors.textTertiary} />
                                <Text style={styles.statText}>{item.total_sessions} sessions</Text>
                            </View>
                        )}
                        {item.is_founding_50 && (
                            <View style={styles.statItem}>
                                <Ionicons name="trophy-outline" size={13} color={Colors.warning} />
                                <Text style={[styles.statText, { color: Colors.warning }]}>Founding 50</Text>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity
                        style={styles.viewProfileButton}
                        activeOpacity={0.8}
                        onPress={() =>
                            navigation.navigate('TrainerDetail', {
                                trainerId: item.user_id,
                                trainer: item,
                            })
                        }
                    >
                        <Text style={styles.viewProfileText}>View Profile</Text>
                        <Ionicons name="arrow-forward" size={16} color={Colors.textInverse} />
                    </TouchableOpacity>
                </View>
            </Pressable>
        );
    };

    // ─── Loading state ───
    if (isLoading) {
        return <LoadingScreen message="Finding trainers..." />;
    }

    return (
        <ScreenWrapper scrollable={false} noPadding>
            {/* 1. HEADER */}
            <View style={styles.headerArea}>
                <View style={styles.headerRow}>
                    <View>
                        <Text style={styles.headerTitle}>Discover</Text>
                        <Text style={styles.headerSubtitle}>
                            {filteredTrainers.length} trainer{filteredTrainers.length !== 1 ? 's' : ''} near you
                        </Text>
                    </View>
                    {activeFilterCount > 0 && (
                        <TouchableOpacity
                            onPress={clearAllFilters}
                            style={styles.clearButton}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="refresh-outline" size={18} color={Colors.primary} />
                            <Text style={styles.clearButtonText}>Clear</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* 2. SEARCH BAR */}
            <View style={styles.searchBarWrap}>
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={20} color={Colors.textTertiary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by sport, name, or location..."
                        placeholderTextColor={Colors.textMuted}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        returnKeyType="search"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity
                    style={[
                        styles.filterToggleButton,
                        activeFilterCount > 0 && styles.filterToggleButtonActive,
                    ]}
                    onPress={() => setFilterModalVisible(true)}
                    activeOpacity={0.7}
                    accessibilityLabel="Open filters"
                >
                    <Ionicons
                        name="options-outline"
                        size={20}
                        color={activeFilterCount > 0 ? Colors.primary : Colors.text}
                    />
                    {activeFilterCount > 0 && (
                        <View style={styles.filterCountBadge}>
                            <Text style={styles.filterCountText}>{activeFilterCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* 3. SPORT FILTER (horizontal scroll) */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.sportScroll}
                contentContainerStyle={styles.sportScrollContent}
            >
                <TouchableOpacity
                    style={[styles.sportPill, sportFilter === 'all' && styles.sportPillActive]}
                    onPress={() => setSportFilter('all')}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.sportPillText, sportFilter === 'all' && styles.sportPillTextActive]}>
                        All
                    </Text>
                </TouchableOpacity>
                {sportOptions.map((s) => (
                    <TouchableOpacity
                        key={s.slug}
                        style={[styles.sportPill, sportFilter === s.slug && styles.sportPillActive]}
                        onPress={() => setSportFilter(sportFilter === s.slug ? 'all' : s.slug)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.sportPillEmoji}>{SPORT_EMOJI[s.slug] || '\u{1F3C6}'}</Text>
                        <Text style={[styles.sportPillText, sportFilter === s.slug && styles.sportPillTextActive]}>
                            {s.name}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* 4. SORT OPTIONS */}
            <View style={styles.sortRow}>
                <Text style={styles.sortLabel}>Sort by:</Text>
                {SORT_OPTIONS.map((opt) => (
                    <TouchableOpacity
                        key={opt.value}
                        style={[styles.sortPill, sortBy === opt.value && styles.sortPillActive]}
                        onPress={() => setSortBy(opt.value)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.sortPillText, sortBy === opt.value && styles.sortPillTextActive]}>
                            {opt.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* 5. TRAINER LIST or MAP */}
            {viewMode === 'list' ? (
                <FlatList
                    data={filteredTrainers}
                    renderItem={renderTrainerCard}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
                    }
                    ListEmptyComponent={
                        /* 6. EMPTY STATE */
                        <View style={styles.emptyWrap}>
                            <View style={styles.emptyIconCircle}>
                                <Ionicons name="search-outline" size={48} color={Colors.textMuted} />
                            </View>
                            <Text style={styles.emptyTitle}>No trainers found</Text>
                            <Text style={styles.emptyDescription}>
                                Try adjusting your search or filters to discover more trainers in your area.
                            </Text>
                            {activeFilterCount > 0 && (
                                <TouchableOpacity style={styles.emptyCta} onPress={clearAllFilters} activeOpacity={0.8}>
                                    <Ionicons name="refresh-outline" size={18} color={Colors.textInverse} />
                                    <Text style={styles.emptyCtaText}>Clear All Filters</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    }
                />
            ) : (
                <View style={styles.mapContainer}>
                    <TrainerMapView
                        trainers={trainerPins}
                        onTrainerPress={(userId) =>
                            navigation.navigate('TrainerDetail', {
                                trainerId: userId,
                                trainer: filteredTrainers.find((t) => t.user_id === userId),
                            })
                        }
                    />
                </View>
            )}

            {/* List / Map floating toggle */}
            <View style={styles.viewToggleFloating}>
                <TouchableOpacity
                    style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
                    onPress={() => setViewMode('list')}
                >
                    <Ionicons name="list" size={18} color={viewMode === 'list' ? Colors.textInverse : Colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.viewToggleBtn, viewMode === 'map' && styles.viewToggleBtnActive]}
                    onPress={() => setViewMode('map')}
                >
                    <Ionicons name="map" size={18} color={viewMode === 'map' ? Colors.textInverse : Colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Filter Modal */}
            <Modal
                visible={filterModalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setFilterModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        {/* Modal Header */}
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Filters</Text>
                            <TouchableOpacity
                                onPress={() => setFilterModalVisible(false)}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                accessibilityLabel="Close filters"
                            >
                                <Ionicons name="close" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
                            {/* Location */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>Location</Text>
                                <LocationAutocomplete
                                    value={locationFilter ? { city: locationFilter, state: '', country: '', lat: null, lng: null } : null}
                                    onChange={handleLocationSelect}
                                    placeholder="Search by city or use GPS..."
                                />
                            </View>

                            {/* Price Range */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>Max Price ($/hr)</Text>
                                <View style={styles.optionRow}>
                                    {PRICE_OPTIONS.map((opt) => (
                                        <TouchableOpacity
                                            key={opt.value}
                                            style={[
                                                styles.optionButton,
                                                maxRate === opt.value && styles.optionButtonActive,
                                            ]}
                                            onPress={() => setMaxRate(opt.value)}
                                            accessibilityLabel={opt.label}
                                        >
                                            <Text
                                                style={[
                                                    styles.optionButtonText,
                                                    maxRate === opt.value && styles.optionButtonTextActive,
                                                ]}
                                            >
                                                {opt.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Skill Level */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>Skill Level</Text>
                                <View style={styles.optionRow}>
                                    <TouchableOpacity
                                        style={[
                                            styles.optionButton,
                                            skillFilter === 'any' && styles.optionButtonActive,
                                        ]}
                                        onPress={() => setSkillFilter('any')}
                                    >
                                        <Text
                                            style={[
                                                styles.optionButtonText,
                                                skillFilter === 'any' && styles.optionButtonTextActive,
                                            ]}
                                        >
                                            Any
                                        </Text>
                                    </TouchableOpacity>
                                    {SKILL_LEVELS.map((level) => (
                                        <TouchableOpacity
                                            key={level.value}
                                            style={[
                                                styles.optionButton,
                                                skillFilter === level.value && styles.optionButtonActive,
                                            ]}
                                            onPress={() => setSkillFilter(level.value)}
                                        >
                                            <Text
                                                style={[
                                                    styles.optionButtonText,
                                                    skillFilter === level.value && styles.optionButtonTextActive,
                                                ]}
                                            >
                                                {level.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Time of Day */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>Time of Day</Text>
                                <View style={styles.optionRow}>
                                    {TIME_OPTIONS.map((opt) => (
                                        <TouchableOpacity
                                            key={opt.value}
                                            style={[
                                                styles.optionButton,
                                                timeFilter === opt.value && styles.optionButtonActive,
                                            ]}
                                            onPress={() => setTimeFilter(opt.value)}
                                        >
                                            <Text
                                                style={[
                                                    styles.optionButtonText,
                                                    timeFilter === opt.value && styles.optionButtonTextActive,
                                                ]}
                                            >
                                                {opt.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Rating */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>Minimum Rating</Text>
                                <View style={styles.optionRow}>
                                    {RATING_OPTIONS.map((opt) => (
                                        <TouchableOpacity
                                            key={opt.value}
                                            style={[
                                                styles.optionButton,
                                                minRating === opt.value && styles.optionButtonActive,
                                            ]}
                                            onPress={() => setMinRating(opt.value)}
                                        >
                                            <Text
                                                style={[
                                                    styles.optionButtonText,
                                                    minRating === opt.value && styles.optionButtonTextActive,
                                                ]}
                                            >
                                                {opt.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Session Duration */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>Session Duration</Text>
                                <View style={styles.optionRow}>
                                    {DURATION_OPTIONS.map((opt) => (
                                        <TouchableOpacity
                                            key={opt.label}
                                            style={[
                                                styles.optionButton,
                                                durationFilter === opt.value && styles.optionButtonActive,
                                            ]}
                                            onPress={() => setDurationFilter(opt.value)}
                                        >
                                            <Text
                                                style={[
                                                    styles.optionButtonText,
                                                    durationFilter === opt.value && styles.optionButtonTextActive,
                                                ]}
                                            >
                                                {opt.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </ScrollView>

                        {/* Modal Footer */}
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.modalResetBtn} onPress={clearAllFilters} activeOpacity={0.7}>
                                <Text style={styles.modalResetText}>Reset All</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalDoneBtn}
                                onPress={() => setFilterModalVisible(false)}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.modalDoneText}>
                                    Show {filteredTrainers.length} Result{filteredTrainers.length !== 1 ? 's' : ''}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScreenWrapper>
    );
}

// ═══════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════
const styles = StyleSheet.create({
    // ── Header ──
    headerArea: {
        paddingHorizontal: Layout.screenPadding,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
        marginTop: 4,
    },
    clearButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.pill,
        backgroundColor: Colors.primaryMuted,
    },
    clearButtonText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
        color: Colors.primary,
    },

    // ── Search Bar ──
    searchBarWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Layout.screenPadding,
        marginBottom: Spacing.md,
        gap: Spacing.sm,
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.lg,
        height: 48,
        gap: Spacing.sm,
    },
    searchInput: {
        flex: 1,
        fontSize: FontSize.sm,
        color: Colors.text,
        height: '100%',
    },
    filterToggleButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterToggleButtonActive: {
        borderColor: Colors.borderActive,
        backgroundColor: Colors.primaryMuted,
    },
    filterCountBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Spacing.xs,
    },
    filterCountText: {
        fontSize: FontSize.xxs,
        fontWeight: FontWeight.bold,
        color: Colors.background,
    },

    // ── Sport Filter Scroll ──
    sportScroll: {
        marginBottom: Spacing.md,
    },
    sportScrollContent: {
        paddingHorizontal: Layout.screenPadding,
        gap: Spacing.sm,
        alignItems: 'center',
    },
    sportPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.pill,
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    sportPillActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    sportPillEmoji: {
        fontSize: 14,
    },
    sportPillText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.textMuted,
    },
    sportPillTextActive: {
        color: Colors.textInverse,
        fontWeight: FontWeight.semibold,
    },

    // ── Sort Options ──
    sortRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Layout.screenPadding,
        marginBottom: Spacing.md,
        gap: Spacing.sm,
    },
    sortLabel: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
        color: Colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    sortPill: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
        borderRadius: BorderRadius.pill,
        backgroundColor: 'transparent',
    },
    sortPillActive: {
        backgroundColor: Colors.glassLight,
    },
    sortPillText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.medium,
        color: Colors.textMuted,
    },
    sortPillTextActive: {
        color: Colors.text,
        fontWeight: FontWeight.bold,
    },

    // ── View Toggle (floating) ──
    viewToggleFloating: {
        position: 'absolute',
        bottom: 80,
        right: Layout.screenPadding,
        flexDirection: 'row',
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.pill,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: 3,
        ...Shadows.medium,
    },
    viewToggleBtn: {
        width: 42,
        height: 36,
        borderRadius: BorderRadius.pill,
        justifyContent: 'center',
        alignItems: 'center',
    },
    viewToggleBtnActive: {
        backgroundColor: Colors.primary,
    },

    // ── Map ──
    mapContainer: {
        flex: 1,
        marginHorizontal: Layout.screenPadding,
        marginBottom: Spacing.md,
    },

    // ── Trainer List ──
    listContent: {
        paddingHorizontal: Layout.screenPadding,
        paddingBottom: 140,
        paddingTop: Spacing.xs,
    },

    // ── Trainer Card ──
    trainerCard: {
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: Spacing.lg,
        marginBottom: 16,
        ...Shadows.small,
    },
    trainerCardPressed: {
        transform: [{ scale: 0.98 }],
        opacity: 0.95,
    },

    // Card Top
    cardTop: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginBottom: Spacing.md,
    },
    cardTopInfo: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    trainerName: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        flexShrink: 1,
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    locationText: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        flexShrink: 1,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginTop: 4,
    },
    ratingValue: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    reviewCount: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
    },

    // Badge pills
    badgePills: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 8,
    },
    badgePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: BorderRadius.pill,
        backgroundColor: Colors.glass,
    },
    badgePillVerified: {
        backgroundColor: Colors.primaryMuted,
    },
    badgePillTopRated: {
        backgroundColor: 'rgba(255,149,0,0.1)',
    },
    badgePillNew: {
        backgroundColor: Colors.successLight,
    },
    badgePillText: {
        fontSize: FontSize.xxs,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
    },

    // Card Middle
    cardMiddle: {
        marginBottom: Spacing.md,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    bioText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 20,
        marginBottom: Spacing.sm,
    },
    priceExpRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    priceDisplay: {
        // Container for price text
    },
    priceAmount: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.heavy,
        color: Colors.primary,
    },
    priceUnit: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.primary,
        opacity: 0.6,
    },
    expBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.pill,
        backgroundColor: Colors.glass,
    },
    expText: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        fontWeight: FontWeight.medium,
    },

    // Card Bottom
    cardBottom: {
        gap: Spacing.md,
    },
    statsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.lg,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
    },
    viewProfileButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.pill,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        alignSelf: 'flex-start',
    },
    viewProfileText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.textInverse,
    },

    // ── Empty State ──
    emptyWrap: {
        alignItems: 'center',
        paddingTop: Spacing.huge,
        paddingHorizontal: Spacing.xxxl,
    },
    emptyIconCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: Colors.glass,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.xxl,
    },
    emptyTitle: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: Spacing.sm,
    },
    emptyDescription: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: Spacing.xxl,
    },
    emptyCta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.xxl,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.pill,
        backgroundColor: Colors.primary,
    },
    emptyCtaText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.textInverse,
    },

    // ── Modal ──
    modalOverlay: {
        flex: 1,
        backgroundColor: Colors.overlay,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: Colors.background,
        borderTopLeftRadius: BorderRadius.xxl,
        borderTopRightRadius: BorderRadius.xxl,
        maxHeight: '85%',
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: Colors.glassBorder,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Layout.screenPadding,
        paddingTop: Spacing.xxl,
        paddingBottom: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    modalTitle: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    modalScroll: {
        paddingHorizontal: Layout.screenPadding,
    },

    // Filter sections
    filterSection: {
        paddingVertical: Spacing.xl,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    filterSectionTitle: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
        marginBottom: Spacing.md,
    },

    // Option buttons
    optionRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    optionButton: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.pill,
        backgroundColor: Colors.glass,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
    },
    optionButtonActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    optionButtonText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.textSecondary,
    },
    optionButtonTextActive: {
        color: Colors.background,
        fontWeight: FontWeight.semibold,
    },

    // Modal footer
    modalFooter: {
        flexDirection: 'row',
        paddingHorizontal: Layout.screenPadding,
        paddingVertical: Spacing.xl,
        gap: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    modalResetBtn: {
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalResetText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
    },
    modalDoneBtn: {
        flex: 1,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalDoneText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.textInverse,
    },
});

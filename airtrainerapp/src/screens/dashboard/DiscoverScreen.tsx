import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
    TextInput, FlatList, ActivityIndicator, Modal, Image, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, TrainerProfileRow, UserRow, AthleteProfileRow } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows, Layout} from '../../theme';
import Founding50Badge from '../../components/Founding50Badge';

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
    { label: 'Recommended', value: 'match' },
    { label: 'Price: Low to High', value: 'price_low' },
    { label: 'Price: High to Low', value: 'price_high' },
    { label: 'Highest Rated', value: 'rating' },
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

    // ─── Filters (matching web) ───
    const [nameFilter, setNameFilter] = useState('');
    const [sportFilter, setSportFilter] = useState('all');
    const [locationFilter, setLocationFilter] = useState('');
    const [skillFilter, setSkillFilter] = useState('any');
    const [timeFilter, setTimeFilter] = useState('any');
    const [maxRate, setMaxRate] = useState(300);
    const [minRating, setMinRating] = useState(0);
    const [durationFilter, setDurationFilter] = useState<number | null>(null);
    const [sortBy, setSortBy] = useState('match');

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
                // Build labels from fallback
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

                    // Performance verified (Feature 7.2)
                    const isPerformanceVerified =
                        p.total_sessions >= 3 &&
                        disputeCount === 0 &&
                        Number(p.completion_rate) >= 95 &&
                        Number(p.reliability_score) >= 95;

                    // New badge (< 30 days)
                    const isNew = p.created_at
                        ? new Date(p.created_at) > thirtyDaysAgo
                        : false;

                    // ─── Match score calculation (matching web) ───
                    let matchScore = 50;
                    if (athleteProfile) {
                        // Sport overlap
                        const sportOverlap = (athleteProfile.sports || []).filter(
                            (s: string) => (p.sports || []).includes(s)
                        );
                        if (sportOverlap.length > 0) matchScore += 20;

                        // Location / distance
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

                        // Skill level
                        if (
                            athleteProfile.skill_level &&
                            p.target_skill_levels?.includes(athleteProfile.skill_level)
                        ) {
                            matchScore += 10;
                        }

                        // Training times
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

    // ─── Filtered + sorted trainers (matching web) ───
    const filteredTrainers = useMemo(() => {
        const result = trainers.filter((t) => {
            // Name search
            if (nameFilter) {
                const fullName = `${t.users?.first_name || ''} ${t.users?.last_name || ''}`.toLowerCase();
                if (!fullName.includes(nameFilter.toLowerCase())) return false;
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
        }

        return result;
    }, [trainers, nameFilter, sportFilter, locationFilter, maxRate, minRating, skillFilter, timeFilter, durationFilter, sortBy]);

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
        setNameFilter('');
        setSortBy('match');
    };

    // ─── Render a single trainer card (matching web layout) ───
    const renderTrainerCard = ({ item }: { item: TrainerWithUser }) => {
        const avatarUrl = item.users?.avatar_url;
        const initials =
            (item.users?.first_name?.[0] || '') + (item.users?.last_name?.[0] || '');

        return (
            <TouchableOpacity
                style={styles.trainerCard}
                activeOpacity={0.8}
                onPress={() =>
                    navigation.navigate('TrainerDetail', {
                        trainerId: item.user_id,
                        trainer: item,
                    })
                }
            >
                {/* ── Avatar + Info Row ── */}
                <View style={styles.cardHeader}>
                    {/* Avatar */}
                    {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                            <Text style={styles.avatarText}>{initials}</Text>
                        </View>
                    )}

                    <View style={styles.cardInfo}>
                        {/* Name row with badges */}
                        <View style={styles.nameRow}>
                            <Text style={styles.trainerName} numberOfLines={1}>
                                {item.users?.first_name} {item.users?.last_name}
                            </Text>
                            {item.is_founding_50 && <Founding50Badge size="small" />}
                        </View>

                        {/* Location */}
                        {(item.city || item.state) && (
                            <View style={styles.locationRow}>
                                <Ionicons name="location-outline" size={12} color={Colors.textTertiary} />
                                <Text style={styles.locationText} numberOfLines={1}>
                                    {item.city}{item.state ? `, ${item.state}` : ''}
                                </Text>
                            </View>
                        )}

                        {/* Rating */}
                        <View style={styles.ratingRow}>
                            <Ionicons name="star" size={13} color="#FFD700" />
                            <Text style={styles.ratingValue}>{item.avg_rating.toFixed(1)}</Text>
                            <Text style={styles.reviewCount}>({item.review_count})</Text>
                        </View>
                    </View>

                    {/* Price */}
                    <View style={styles.priceBox}>
                        <Text style={styles.priceAmount}>
                            ${Number(item.hourly_rate || 0).toFixed(0)}
                        </Text>
                        <Text style={styles.priceUnit}>/hr</Text>
                    </View>
                </View>

                {/* ── Badges Row ── */}
                <View style={styles.badgesRow}>
                    {item.is_new && (
                        <View style={[styles.badge, styles.badgeNew]}>
                            <Text style={[styles.badgeText, styles.badgeNewText]}>NEW</Text>
                        </View>
                    )}
                    {item.is_performance_verified && (
                        <View style={[styles.badge, styles.badgeVerified]}>
                            <Ionicons name="checkmark-circle" size={11} color={Colors.primary} />
                            <Text style={[styles.badgeText, styles.badgeVerifiedText]}>VERIFIED</Text>
                        </View>
                    )}
                    {item.is_founding_50 && (
                        <View style={[styles.badge, styles.badgeFounding]}>
                            <Text style={[styles.badgeText, styles.badgeFoundingText]}>Founding 50</Text>
                        </View>
                    )}
                    {item.is_top_rated && (
                        <View style={[styles.badge, styles.badgeTopRated]}>
                            <Ionicons name="star" size={9} color="#FF9500" />
                            <Text style={[styles.badgeText, styles.badgeTopRatedText]}>TOP RATED</Text>
                        </View>
                    )}
                </View>

                {/* ── Sport Tags ── */}
                <View style={styles.sportTags}>
                    {(item.sports || []).slice(0, 3).map((sport) => (
                        <View key={sport} style={styles.sportTag}>
                            <Text style={styles.sportTagText}>
                                {sportLabels[normalizeSport(sport)] || sport.replace(/_/g, ' ')}
                            </Text>
                        </View>
                    ))}
                    {(item.sports || []).length > 3 && (
                        <View style={[styles.sportTag, styles.sportTagMore]}>
                            <Text style={styles.sportTagText}>
                                +{(item.sports || []).length - 3}
                            </Text>
                        </View>
                    )}
                </View>

                {/* ── Session Lengths ── */}
                {item.session_lengths && item.session_lengths.length > 0 && (
                    <View style={styles.sessionLengths}>
                        {[...item.session_lengths].sort((a, b) => a - b).map((d) => (
                            <View key={d} style={styles.sessionTag}>
                                <Text style={styles.sessionTagText}>
                                    {d < 60 ? `${d}m` : d === 60 ? '1h' : d === 90 ? '1.5h' : `${d / 60}h`}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* ── View Profile Button ── */}
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
                    <LinearGradient
                        colors={[Colors.primary, Colors.primaryDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.viewProfileGradient}
                    >
                        <Text style={styles.viewProfileText}>View Profile</Text>
                        <Ionicons name="arrow-forward" size={14} color="#0A0D14" />
                    </LinearGradient>
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    // ─── Pill button helper ───
    const renderPill = (
        label: string,
        isActive: boolean,
        onPress: () => void
    ) => (
        <TouchableOpacity
            key={label}
            style={[styles.pillButton, isActive && styles.pillButtonActive]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{label}</Text>
        </TouchableOpacity>
    );

    // ─── Loading state ───
    if (isLoading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* ── Header ── */}
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Find a Coach</Text>
                    <Text style={styles.headerSubtitle}>
                        {filteredTrainers.length} coach
                        {filteredTrainers.length !== 1 ? 'es' : ''} available
                        {locationFilter ? ` \u00B7 ${locationFilter}` : ''}
                    </Text>
                </View>
                {activeFilterCount > 0 && (
                    <TouchableOpacity style={styles.resetAllButton} onPress={clearAllFilters}>
                        <View style={styles.resetBadge}>
                            <Text style={styles.resetBadgeText}>{activeFilterCount}</Text>
                        </View>
                        <Text style={styles.resetAllText}>Reset</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* ── Search Bar ── */}
            <View style={styles.searchRow}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={18} color={Colors.textTertiary} style={{ marginRight: Spacing.md }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search coaches by name..."
                        placeholderTextColor={Colors.textMuted}
                        value={nameFilter}
                        onChangeText={setNameFilter}
                    />
                    {nameFilter.length > 0 && (
                        <TouchableOpacity onPress={() => setNameFilter('')}>
                            <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity
                    style={[
                        styles.filterToggleButton,
                        (filterModalVisible || activeFilterCount > 0) && styles.filterToggleButtonActive,
                    ]}
                    onPress={() => setFilterModalVisible(true)}
                    activeOpacity={0.7}
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

            {/* ── Sport Filter (horizontal scroll) ── */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.sportScrollContainer}
                contentContainerStyle={styles.sportScrollContent}
            >
                {renderPill('All Sports', sportFilter === 'all', () => setSportFilter('all'))}
                {sportOptions.map((s) =>
                    renderPill(s.name, sportFilter === s.slug, () => setSportFilter(s.slug))
                )}
            </ScrollView>

            {/* ── Location filter inline ── */}
            <View style={styles.locationFilterRow}>
                <Ionicons name="location-outline" size={14} color={Colors.textTertiary} />
                <TextInput
                    style={styles.locationInput}
                    placeholder="Filter by location..."
                    placeholderTextColor={Colors.textMuted}
                    value={locationFilter}
                    onChangeText={setLocationFilter}
                />
                {locationFilter.length > 0 && (
                    <TouchableOpacity onPress={() => setLocationFilter('')}>
                        <Ionicons name="close-circle" size={16} color={Colors.textTertiary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* ── Quick filter pills: Rating + Duration + Sort ── */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.quickFilterScroll}
                contentContainerStyle={styles.quickFilterContent}
            >
                {/* Rating pills */}
                <View style={styles.pillGroup}>
                    <Text style={styles.pillGroupLabel}>Rating:</Text>
                    {RATING_OPTIONS.map((r) =>
                        renderPill(
                            r.value === 0 ? 'Any' : `${r.value}+`,
                            minRating === r.value,
                            () => setMinRating(r.value)
                        )
                    )}
                </View>

                <View style={styles.pillDivider} />

                {/* Duration pills */}
                <View style={styles.pillGroup}>
                    <Text style={styles.pillGroupLabel}>Dur:</Text>
                    {DURATION_OPTIONS.map((d) =>
                        renderPill(
                            d.label,
                            durationFilter === d.value,
                            () => setDurationFilter(d.value)
                        )
                    )}
                </View>

                <View style={styles.pillDivider} />

                {/* Sort */}
                <View style={styles.pillGroup}>
                    <Text style={styles.pillGroupLabel}>Sort:</Text>
                    {SORT_OPTIONS.map((s) =>
                        renderPill(s.label, sortBy === s.value, () => setSortBy(s.value))
                    )}
                </View>
            </ScrollView>

            {/* ── Trainer List ── */}
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
                    <View style={styles.emptyState}>
                        <Ionicons name="search-outline" size={48} color={Colors.textTertiary} />
                        <Text style={styles.emptyTitle}>No trainers found</Text>
                        <Text style={styles.emptyText}>Try adjusting your filters</Text>
                    </View>
                }
            />

            {/* ══════════════════════════════════════════════════════
                  Filter Modal (Skill Level, Time, Price in modal)
               ══════════════════════════════════════════════════════ */}
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
                            >
                                <Ionicons name="close" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
                            {/* ── Price Range ── */}
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

                            {/* ── Skill Level ── */}
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

                            {/* ── Time of Day ── */}
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

                            {/* ── Rating ── */}
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

                            {/* ── Session Duration ── */}
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

                            {/* ── Sort By ── */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>Sort By</Text>
                                <View style={styles.sortList}>
                                    {SORT_OPTIONS.map((opt) => (
                                        <TouchableOpacity
                                            key={opt.value}
                                            style={styles.sortItem}
                                            onPress={() => setSortBy(opt.value)}
                                        >
                                            <View
                                                style={[
                                                    styles.radioOuter,
                                                    sortBy === opt.value && styles.radioOuterActive,
                                                ]}
                                            >
                                                {sortBy === opt.value && <View style={styles.radioInner} />}
                                            </View>
                                            <Text
                                                style={[
                                                    styles.sortItemText,
                                                    sortBy === opt.value && styles.sortItemTextActive,
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
                            <TouchableOpacity style={styles.resetButton} onPress={clearAllFilters}>
                                <Text style={styles.resetButtonText}>Reset All</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.applyButton}
                                onPress={() => setFilterModalVisible(false)}
                                activeOpacity={0.8}
                            >
                                <LinearGradient
                                    colors={[Colors.gradientStart, Colors.gradientEnd]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.applyGradient}
                                >
                                    <Text style={styles.applyButtonText}>Done</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ═══════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    center: { justifyContent: 'center', alignItems: 'center' },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.xxl,
        paddingTop: Layout.headerTopPadding,
        paddingBottom: Spacing.md,
    },
    headerTitle: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.heavy,
        color: Colors.text,
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
        marginTop: 2,
    },
    resetAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    resetBadge: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(69,208,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    resetBadgeText: {
        fontSize: 9,
        fontWeight: FontWeight.heavy,
        color: Colors.primary,
    },
    resetAllText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.textTertiary,
    },

    // Search
    searchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: Spacing.xxl,
        marginBottom: Spacing.sm,
        gap: Spacing.sm,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.lg,
        height: 50,
    },
    searchInput: {
        flex: 1,
        color: Colors.text,
        fontSize: FontSize.md,
    },
    filterToggleButton: {
        width: 50,
        height: 50,
        borderRadius: BorderRadius.lg,
        backgroundColor: Colors.card,
        borderWidth: 1,
        borderColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterToggleButtonActive: {
        borderColor: Colors.borderActive,
        backgroundColor: 'rgba(69,208,255,0.05)',
    },
    filterCountBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    filterCountText: {
        fontSize: 10,
        fontWeight: FontWeight.bold,
        color: Colors.background,
    },

    // Sport scroll
    sportScrollContainer: {
        maxHeight: 44,
        marginBottom: Spacing.sm,
    },
    sportScrollContent: {
        paddingHorizontal: Spacing.xxl,
        gap: Spacing.sm,
        alignItems: 'center',
    },

    // Location inline filter
    locationFilterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: Spacing.xxl,
        marginBottom: Spacing.sm,
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.md,
        height: 38,
        gap: 6,
    },
    locationInput: {
        flex: 1,
        color: Colors.text,
        fontSize: FontSize.sm,
    },

    // Quick filter pills scroll
    quickFilterScroll: {
        maxHeight: 40,
        marginBottom: Spacing.md,
    },
    quickFilterContent: {
        paddingHorizontal: Spacing.xxl,
        gap: Spacing.sm,
        alignItems: 'center',
        flexDirection: 'row',
    },
    pillGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.pill,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: 4,
        paddingVertical: 2,
    },
    pillGroupLabel: {
        fontSize: 9,
        fontWeight: FontWeight.bold,
        color: Colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        paddingHorizontal: 6,
    },
    pillDivider: {
        width: 1,
        height: 20,
        backgroundColor: Colors.border,
        marginHorizontal: 4,
    },
    pillButton: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: BorderRadius.pill,
    },
    pillButtonActive: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    pillText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.textMuted,
    },
    pillTextActive: {
        color: Colors.text,
    },

    // Trainer list
    listContent: {
        paddingHorizontal: Spacing.xxl,
        paddingBottom: 100,
        paddingTop: Spacing.xs,
    },

    // Trainer card
    trainerCard: {
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        ...Shadows.small,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 16,
        marginRight: Spacing.md,
    },
    avatarPlaceholder: {
        backgroundColor: Colors.primaryGlow,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },
    cardInfo: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
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
        gap: 3,
        marginTop: 3,
    },
    locationText: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        flexShrink: 1,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 3,
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
    priceBox: {
        alignItems: 'flex-end',
        backgroundColor: 'rgba(69,208,255,0.1)',
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: 'rgba(69,208,255,0.3)',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    priceAmount: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.heavy,
        color: Colors.primary,
    },
    priceUnit: {
        fontSize: FontSize.xs,
        color: 'rgba(69,208,255,0.6)',
        fontWeight: FontWeight.bold,
    },

    // Badges
    badgesRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: BorderRadius.sm,
    },
    badgeText: {
        fontSize: 9,
        fontWeight: FontWeight.heavy,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    badgeNew: {
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    badgeNewText: {
        color: Colors.text,
    },
    badgeVerified: {
        backgroundColor: 'rgba(69,208,255,0.1)',
    },
    badgeVerifiedText: {
        color: Colors.primary,
    },
    badgeFounding: {
        backgroundColor: 'rgba(255,171,0,0.15)',
    },
    badgeFoundingText: {
        color: Colors.warning,
    },
    badgeTopRated: {
        backgroundColor: 'rgba(255,149,0,0.15)',
    },
    badgeTopRatedText: {
        color: '#FF9500',
    },

    // Sport tags
    sportTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    sportTag: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: BorderRadius.pill,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    sportTagMore: {
        backgroundColor: Colors.surface,
    },
    sportTagText: {
        fontSize: 10,
        fontWeight: FontWeight.semibold,
        color: 'rgba(255,255,255,0.5)',
    },

    // Session lengths
    sessionLengths: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginBottom: Spacing.md,
    },
    sessionTag: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: BorderRadius.pill,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    sessionTagText: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.4)',
    },

    // View Profile button
    viewProfileButton: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
        marginTop: Spacing.xs,
    },
    viewProfileGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        gap: 6,
    },
    viewProfileText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.heavy,
        color: Colors.background,
    },

    // Empty state
    emptyState: {
        alignItems: 'center',
        paddingTop: Layout.headerTopPadding,
        gap: Spacing.md,
    },
    emptyTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    emptyText: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
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
        paddingHorizontal: Spacing.xxl,
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
        paddingHorizontal: Spacing.xxl,
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

    // Sort options
    sortList: { gap: Spacing.md },
    sortItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.xs,
    },
    radioOuter: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: Colors.glassBorder,
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioOuterActive: {
        borderColor: Colors.primary,
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.primary,
    },
    sortItemText: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
    },
    sortItemTextActive: {
        color: Colors.text,
        fontWeight: FontWeight.medium,
    },

    // Modal footer
    modalFooter: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.xxl,
        paddingVertical: Spacing.xl,
        gap: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    resetButton: {
        flex: 1,
        height: 48,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.glass,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        justifyContent: 'center',
        alignItems: 'center',
    },
    resetButtonText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
    },
    applyButton: {
        flex: 2,
        height: 48,
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
    },
    applyGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    applyButtonText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: '#FFFFFF',
    },
});

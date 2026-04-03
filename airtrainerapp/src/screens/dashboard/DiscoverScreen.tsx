import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
    TextInput, FlatList, ActivityIndicator, Modal, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, TrainerProfileRow, UserRow } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';
import Founding50Badge from '../../components/Founding50Badge';

const SPORTS = [
    { name: 'All', emoji: '🏆' },
    { name: 'Hockey', emoji: '🏒' }, { name: 'Baseball', emoji: '⚾' },
    { name: 'Basketball', emoji: '🏀' }, { name: 'Soccer', emoji: '⚽' },
    { name: 'Football', emoji: '🏈' }, { name: 'Tennis', emoji: '🎾' },
    { name: 'Golf', emoji: '⛳' }, { name: 'Swimming', emoji: '🏊' },
    { name: 'Boxing', emoji: '🥊' }, { name: 'Lacrosse', emoji: '🥍' },
];

const RATING_OPTIONS = [
    { label: 'Any', value: 0 },
    { label: '3.5+', value: 3.5 },
    { label: '4.0+', value: 4.0 },
    { label: '4.5+', value: 4.5 },
];

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Pro'];

const SORT_OPTIONS = [
    { label: 'Recommended', value: 'recommended' },
    { label: 'Price: Low to High', value: 'price_low' },
    { label: 'Price: High to Low', value: 'price_high' },
    { label: 'Highest Rated', value: 'rating' },
];

interface TrainerWithUser extends TrainerProfileRow {
    users: UserRow;
    avg_rating?: number;
    review_count?: number;
}

interface Filters {
    minPrice: string;
    maxPrice: string;
    minRating: number;
    skillLevels: string[];
    sortBy: string;
}

const DEFAULT_FILTERS: Filters = {
    minPrice: '',
    maxPrice: '',
    minRating: 0,
    skillLevels: [],
    sortBy: 'recommended',
};

export default function DiscoverScreen({ navigation }: any) {
    const { user } = useAuth();
    const [trainers, setTrainers] = useState<TrainerWithUser[]>([]);
    const [filteredTrainers, setFilteredTrainers] = useState<TrainerWithUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedSport, setSelectedSport] = useState('All');

    // Filter state
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [appliedFilters, setAppliedFilters] = useState<Filters>({ ...DEFAULT_FILTERS });
    const [draftFilters, setDraftFilters] = useState<Filters>({ ...DEFAULT_FILTERS });

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (appliedFilters.minPrice) count++;
        if (appliedFilters.maxPrice) count++;
        if (appliedFilters.minRating > 0) count++;
        if (appliedFilters.skillLevels.length > 0) count++;
        if (appliedFilters.sortBy !== 'recommended') count++;
        return count;
    }, [appliedFilters]);

    const activeFilterChips = useMemo(() => {
        const chips: { label: string; key: string }[] = [];
        if (appliedFilters.minPrice) chips.push({ label: `Min $${appliedFilters.minPrice}/hr`, key: 'minPrice' });
        if (appliedFilters.maxPrice) chips.push({ label: `Max $${appliedFilters.maxPrice}/hr`, key: 'maxPrice' });
        if (appliedFilters.minRating > 0) chips.push({ label: `${appliedFilters.minRating}+ rating`, key: 'minRating' });
        if (appliedFilters.skillLevels.length > 0) chips.push({ label: appliedFilters.skillLevels.join(', '), key: 'skillLevels' });
        if (appliedFilters.sortBy !== 'recommended') {
            const sortLabel = SORT_OPTIONS.find(o => o.value === appliedFilters.sortBy)?.label || '';
            chips.push({ label: sortLabel, key: 'sortBy' });
        }
        return chips;
    }, [appliedFilters]);

    const removeFilterChip = (key: string) => {
        setAppliedFilters(prev => {
            const next = { ...prev };
            if (key === 'minPrice') next.minPrice = '';
            else if (key === 'maxPrice') next.maxPrice = '';
            else if (key === 'minRating') next.minRating = 0;
            else if (key === 'skillLevels') next.skillLevels = [];
            else if (key === 'sortBy') next.sortBy = 'recommended';
            return next;
        });
    };

    const fetchTrainers = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('trainer_profiles')
                .select('*, users!trainer_profiles_user_id_fkey(*)')
                .eq('verification_status', 'verified')
                .order('reliability_score', { ascending: false });

            if (error) throw error;
            setTrainers((data || []) as TrainerWithUser[]);
        } catch (error) {
            console.error('Error fetching trainers:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTrainers();
    }, []);

    // Combined filter + search + sort effect
    useEffect(() => {
        let filtered = [...trainers];

        // Sport filter
        if (selectedSport !== 'All') {
            filtered = filtered.filter((t) => t.sports?.includes(selectedSport));
        }

        // Search filter
        if (search.trim()) {
            const q = search.toLowerCase();
            filtered = filtered.filter(
                (t) =>
                    t.users?.first_name?.toLowerCase().includes(q) ||
                    t.users?.last_name?.toLowerCase().includes(q) ||
                    t.headline?.toLowerCase().includes(q) ||
                    t.sports?.some((s) => s.toLowerCase().includes(q))
            );
        }

        // Price filters
        const minP = appliedFilters.minPrice ? Number(appliedFilters.minPrice) : null;
        const maxP = appliedFilters.maxPrice ? Number(appliedFilters.maxPrice) : null;
        if (minP) filtered = filtered.filter(t => Number(t.hourly_rate) >= minP);
        if (maxP) filtered = filtered.filter(t => Number(t.hourly_rate) <= maxP);

        // Rating filter
        if (appliedFilters.minRating > 0) {
            filtered = filtered.filter(t => (t.avg_rating || (t as any).average_rating || 0) >= appliedFilters.minRating);
        }

        // Skill level filter
        if (appliedFilters.skillLevels.length > 0) {
            filtered = filtered.filter(t => {
                const levels = (t as any).target_skill_levels as string[] | undefined;
                if (!levels) return false;
                return appliedFilters.skillLevels.some(sl => levels.map(l => l.toLowerCase()).includes(sl.toLowerCase()));
            });
        }

        // Sort
        switch (appliedFilters.sortBy) {
            case 'price_low':
                filtered.sort((a, b) => Number(a.hourly_rate) - Number(b.hourly_rate));
                break;
            case 'price_high':
                filtered.sort((a, b) => Number(b.hourly_rate) - Number(a.hourly_rate));
                break;
            case 'rating':
                filtered.sort((a, b) =>
                    ((b.avg_rating || (b as any).average_rating || 0) - (a.avg_rating || (a as any).average_rating || 0))
                );
                break;
            default:
                filtered.sort((a, b) => ((b.reliability_score || 0) - (a.reliability_score || 0)));
                break;
        }

        setFilteredTrainers(filtered);
    }, [selectedSport, search, trainers, appliedFilters]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchTrainers();
        setRefreshing(false);
    };

    const openFilterModal = () => {
        setDraftFilters({ ...appliedFilters });
        setFilterModalVisible(true);
    };

    const applyFilters = () => {
        setAppliedFilters({ ...draftFilters });
        setFilterModalVisible(false);
    };

    const resetFilters = () => {
        setDraftFilters({ ...DEFAULT_FILTERS });
    };

    const toggleSkillLevel = (level: string) => {
        setDraftFilters(prev => {
            const exists = prev.skillLevels.includes(level);
            return {
                ...prev,
                skillLevels: exists
                    ? prev.skillLevels.filter(l => l !== level)
                    : [...prev.skillLevels, level],
            };
        });
    };

    const renderTrainerCard = ({ item }: { item: TrainerWithUser }) => (
        <TouchableOpacity
            style={styles.trainerCard}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('TrainerDetail', { trainerId: item.user_id, trainer: item })}
        >
            <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {(item.users?.first_name?.[0] || '') + (item.users?.last_name?.[0] || '')}
                    </Text>
                </View>
                <View style={styles.cardInfo}>
                    <View style={styles.nameRow}>
                        <Text style={styles.trainerName}>
                            {item.users?.first_name} {item.users?.last_name}
                        </Text>
                        {item.is_verified && (
                            <View style={styles.verifiedBadge}>
                                <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
                            </View>
                        )}
                        {item.is_founding_50 && (
                            <Founding50Badge size="small" />
                        )}
                    </View>
                    <Text style={styles.headline} numberOfLines={1}>
                        {item.headline || 'Professional Trainer'}
                    </Text>
                    <View style={styles.metaRow}>
                        {item.city && (
                            <View style={styles.metaItem}>
                                <Ionicons name="location-outline" size={12} color={Colors.textTertiary} />
                                <Text style={styles.metaText}>{item.city}{item.state ? `, ${item.state}` : ''}</Text>
                            </View>
                        )}
                        <View style={styles.metaItem}>
                            <Ionicons name="star" size={12} color="#45D0FF" />
                            <Text style={styles.metaText}>{item.reliability_score || '5.0'}</Text>
                        </View>
                    </View>
                </View>
                <View style={styles.rateContainer}>
                    <Text style={styles.rateAmount}>${Number(item.hourly_rate || 50).toFixed(0)}</Text>
                    <Text style={styles.rateUnit}>/hr</Text>
                </View>
            </View>

            {/* Sports Tags */}
            <View style={styles.sportTags}>
                {(item.sports || []).slice(0, 3).map((sport) => (
                    <View key={sport} style={styles.sportTag}>
                        <Text style={styles.sportTagText}>{sport}</Text>
                    </View>
                ))}
                {(item.sports || []).length > 3 && (
                    <View style={[styles.sportTag, styles.sportTagMore]}>
                        <Text style={styles.sportTagText}>+{(item.sports || []).length - 3}</Text>
                    </View>
                )}
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
                <View style={styles.statItem}>
                    <Ionicons name="trophy-outline" size={14} color={Colors.primary} />
                    <Text style={styles.statText}>{item.years_experience || 0}yr exp</Text>
                </View>
                <View style={styles.statItem}>
                    <Ionicons name="people-outline" size={14} color={Colors.primary} />
                    <Text style={styles.statText}>{item.total_sessions || 0} sessions</Text>
                </View>
                <View style={styles.statItem}>
                    <Ionicons name="checkmark-done" size={14} color={Colors.success} />
                    <Text style={styles.statText}>{Number(item.completion_rate || 100).toFixed(0)}%</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

    if (isLoading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>Hello, {user?.firstName || 'Athlete'} 👋</Text>
                    <Text style={styles.headerTitle}>Find Your Trainer</Text>
                </View>
                <TouchableOpacity style={styles.notifButton} onPress={() => navigation.navigate('Notifications')}>
                    <Ionicons name="notifications-outline" size={24} color={Colors.text} />
                    <View style={styles.notifBadge} />
                </TouchableOpacity>
            </View>

            {/* Search Bar with Filter Button */}
            <View style={styles.searchRow}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color={Colors.textTertiary} style={{ marginRight: Spacing.md }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search trainers, sports..."
                        placeholderTextColor={Colors.textTertiary}
                        value={search}
                        onChangeText={setSearch}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
                        </TouchableOpacity>
                    )}
                </View>
                <TouchableOpacity style={styles.filterButton} onPress={openFilterModal} activeOpacity={0.7}>
                    <Ionicons name="options-outline" size={22} color={activeFilterCount > 0 ? Colors.primary : Colors.text} />
                    {activeFilterCount > 0 && (
                        <View style={styles.filterBadge}>
                            <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Active Filter Chips */}
            {activeFilterChips.length > 0 && (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipScrollContainer}
                    contentContainerStyle={styles.chipContainer}
                >
                    {activeFilterChips.map(chip => (
                        <View key={chip.key} style={styles.chip}>
                            <Text style={styles.chipText}>{chip.label}</Text>
                            <TouchableOpacity onPress={() => removeFilterChip(chip.key)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Ionicons name="close-circle" size={16} color={Colors.primary} />
                            </TouchableOpacity>
                        </View>
                    ))}
                    <TouchableOpacity
                        style={styles.clearAllChip}
                        onPress={() => setAppliedFilters({ ...DEFAULT_FILTERS })}
                    >
                        <Text style={styles.clearAllText}>Clear all</Text>
                    </TouchableOpacity>
                </ScrollView>
            )}

            {/* Sports Filter */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.sportsFilterContainer}
                contentContainerStyle={styles.sportsFilter}
            >
                {SPORTS.map((sport) => (
                    <TouchableOpacity
                        key={sport.name}
                        style={[styles.sportFilterButton, selectedSport === sport.name && styles.sportFilterActive]}
                        onPress={() => setSelectedSport(sport.name)}
                    >
                        <Text style={styles.sportFilterEmoji}>{sport.emoji}</Text>
                        <Text style={[styles.sportFilterText, selectedSport === sport.name && styles.sportFilterTextActive]}>
                            {sport.name}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Results */}
            <Text style={styles.resultsText}>{filteredTrainers.length} trainers found</Text>

            <FlatList
                data={filteredTrainers}
                renderItem={renderTrainerCard}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="search-outline" size={48} color={Colors.textTertiary} />
                        <Text style={styles.emptyTitle}>No trainers found</Text>
                        <Text style={styles.emptyText}>Try adjusting your filters</Text>
                    </View>
                }
            />

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
                            <TouchableOpacity onPress={() => setFilterModalVisible(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                                <Ionicons name="close" size={24} color={Colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
                            {/* Price Range */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>Price Range ($/hr)</Text>
                                <View style={styles.priceRow}>
                                    <View style={styles.priceInputWrapper}>
                                        <Text style={styles.priceLabel}>Min</Text>
                                        <TextInput
                                            style={styles.priceInput}
                                            placeholder="0"
                                            placeholderTextColor={Colors.textTertiary}
                                            keyboardType="numeric"
                                            value={draftFilters.minPrice}
                                            onChangeText={(v) => setDraftFilters(prev => ({ ...prev, minPrice: v.replace(/[^0-9]/g, '') }))}
                                        />
                                    </View>
                                    <Text style={styles.priceSeparator}>-</Text>
                                    <View style={styles.priceInputWrapper}>
                                        <Text style={styles.priceLabel}>Max</Text>
                                        <TextInput
                                            style={styles.priceInput}
                                            placeholder="Any"
                                            placeholderTextColor={Colors.textTertiary}
                                            keyboardType="numeric"
                                            value={draftFilters.maxPrice}
                                            onChangeText={(v) => setDraftFilters(prev => ({ ...prev, maxPrice: v.replace(/[^0-9]/g, '') }))}
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Rating Filter */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>Minimum Rating</Text>
                                <View style={styles.optionRow}>
                                    {RATING_OPTIONS.map(opt => (
                                        <TouchableOpacity
                                            key={opt.value}
                                            style={[
                                                styles.optionButton,
                                                draftFilters.minRating === opt.value && styles.optionButtonActive,
                                            ]}
                                            onPress={() => setDraftFilters(prev => ({ ...prev, minRating: opt.value }))}
                                        >
                                            <Text style={[
                                                styles.optionButtonText,
                                                draftFilters.minRating === opt.value && styles.optionButtonTextActive,
                                            ]}>
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
                                    {SKILL_LEVELS.map(level => (
                                        <TouchableOpacity
                                            key={level}
                                            style={[
                                                styles.optionButton,
                                                draftFilters.skillLevels.includes(level) && styles.optionButtonActive,
                                            ]}
                                            onPress={() => toggleSkillLevel(level)}
                                        >
                                            <Text style={[
                                                styles.optionButtonText,
                                                draftFilters.skillLevels.includes(level) && styles.optionButtonTextActive,
                                            ]}>
                                                {level}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Sort By */}
                            <View style={styles.filterSection}>
                                <Text style={styles.filterSectionTitle}>Sort By</Text>
                                <View style={styles.sortList}>
                                    {SORT_OPTIONS.map(opt => (
                                        <TouchableOpacity
                                            key={opt.value}
                                            style={styles.sortItem}
                                            onPress={() => setDraftFilters(prev => ({ ...prev, sortBy: opt.value }))}
                                        >
                                            <View style={[
                                                styles.radioOuter,
                                                draftFilters.sortBy === opt.value && styles.radioOuterActive,
                                            ]}>
                                                {draftFilters.sortBy === opt.value && <View style={styles.radioInner} />}
                                            </View>
                                            <Text style={[
                                                styles.sortItemText,
                                                draftFilters.sortBy === opt.value && styles.sortItemTextActive,
                                            ]}>
                                                {opt.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </ScrollView>

                        {/* Modal Footer */}
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
                                <Text style={styles.resetButtonText}>Reset</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.applyButton} onPress={applyFilters} activeOpacity={0.8}>
                                <LinearGradient
                                    colors={[Colors.gradientStart, Colors.gradientEnd]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.applyGradient}
                                >
                                    <Text style={styles.applyButtonText}>Apply Filters</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A0D14' },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.xxl, paddingTop: 60, paddingBottom: Spacing.lg },
    greeting: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 2 },
    headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    notifButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    notifBadge: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.error },

    // Search row with filter button
    searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.xxl, marginBottom: Spacing.md, gap: Spacing.sm },
    searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#161B22', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingHorizontal: Spacing.lg, height: 48 },
    searchInput: { flex: 1, color: Colors.text, fontSize: FontSize.md },
    filterButton: { width: 48, height: 48, borderRadius: BorderRadius.md, backgroundColor: '#161B22', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
    filterBadge: { position: 'absolute', top: 6, right: 6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
    filterBadgeText: { fontSize: 10, fontWeight: FontWeight.bold, color: '#0A0D14' },

    // Active filter chips
    chipScrollContainer: { marginBottom: Spacing.sm, maxHeight: 36 },
    chipContainer: { paddingHorizontal: Spacing.xxl, gap: Spacing.sm, flexDirection: 'row', alignItems: 'center' },
    chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primaryGlow, borderRadius: BorderRadius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6, gap: 6, borderWidth: 1, borderColor: Colors.borderActive },
    chipText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: FontWeight.medium },
    clearAllChip: { paddingHorizontal: Spacing.md, paddingVertical: 6 },
    clearAllText: { fontSize: FontSize.xs, color: Colors.error, fontWeight: FontWeight.medium },

    sportsFilterContainer: { height: 50, marginBottom: Spacing.lg },
    sportsFilter: { paddingHorizontal: Spacing.xxl, gap: Spacing.sm, alignItems: 'center' },
    sportFilterButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg, height: 40, borderRadius: BorderRadius.pill, backgroundColor: '#161B22', borderWidth: 1, borderColor: Colors.border, gap: 6 },
    sportFilterActive: { backgroundColor: '#45D0FF', borderColor: '#45D0FF' },
    sportFilterEmoji: { fontSize: 16 },
    sportFilterText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: 'rgba(255,255,255,0.5)' },
    sportFilterTextActive: { color: '#0A0D14' },
    resultsText: { fontSize: FontSize.sm, color: Colors.textTertiary, paddingHorizontal: Spacing.xxl, marginBottom: Spacing.lg },
    listContent: { paddingHorizontal: Spacing.xxl, paddingBottom: 100, paddingTop: Spacing.sm },
    trainerCard: { backgroundColor: '#161B22', borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', ...Shadows.small },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
    avatar: { width: 52, height: 52, borderRadius: 16, backgroundColor: Colors.primaryGlow, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    avatarText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#45D0FF' },
    cardInfo: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    trainerName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    verifiedBadge: { marginLeft: 2 },
    headline: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
    metaRow: { flexDirection: 'row', gap: Spacing.md, marginTop: 4 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    metaText: { fontSize: FontSize.xs, color: Colors.textTertiary },
    rateContainer: { alignItems: 'flex-end' },
    rateAmount: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: '#45D0FF' },
    rateUnit: { fontSize: FontSize.xs, color: Colors.textTertiary },
    sportTags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
    sportTag: { paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: BorderRadius.pill, backgroundColor: Colors.primaryGlow },
    sportTagMore: { backgroundColor: Colors.surface },
    sportTagText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, color: '#45D0FF' },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
    statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    statText: { fontSize: FontSize.xs, color: Colors.textSecondary },
    emptyState: { alignItems: 'center', paddingTop: 60, gap: Spacing.md },
    emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#FFFFFF' },
    emptyText: { fontSize: FontSize.md, color: Colors.textSecondary },

    // Modal styles
    modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
    modalContent: { backgroundColor: Colors.background, borderTopLeftRadius: BorderRadius.xxl, borderTopRightRadius: BorderRadius.xxl, maxHeight: '85%', borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.glassBorder },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.xxl, paddingTop: Spacing.xxl, paddingBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
    modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
    modalScroll: { paddingHorizontal: Spacing.xxl },

    // Filter sections
    filterSection: { paddingVertical: Spacing.xl, borderBottomWidth: 1, borderBottomColor: Colors.border },
    filterSectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text, marginBottom: Spacing.md },

    // Price inputs
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    priceInputWrapper: { flex: 1 },
    priceLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: Spacing.xs },
    priceInput: { backgroundColor: Colors.card, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.glassBorder, paddingHorizontal: Spacing.lg, height: 44, color: Colors.text, fontSize: FontSize.md },
    priceSeparator: { fontSize: FontSize.lg, color: Colors.textTertiary, marginTop: Spacing.lg },

    // Option buttons (rating, skill level)
    optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    optionButton: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.pill, backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder },
    optionButtonActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    optionButtonText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, color: Colors.textSecondary },
    optionButtonTextActive: { color: '#0A0D14', fontWeight: FontWeight.semibold },

    // Sort options
    sortList: { gap: Spacing.md },
    sortItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
    radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.glassBorder, justifyContent: 'center', alignItems: 'center' },
    radioOuterActive: { borderColor: Colors.primary },
    radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary },
    sortItemText: { fontSize: FontSize.md, color: Colors.textSecondary },
    sortItemTextActive: { color: Colors.text, fontWeight: FontWeight.medium },

    // Modal footer
    modalFooter: { flexDirection: 'row', paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.xl, gap: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
    resetButton: { flex: 1, height: 48, borderRadius: BorderRadius.md, backgroundColor: Colors.glass, borderWidth: 1, borderColor: Colors.glassBorder, justifyContent: 'center', alignItems: 'center' },
    resetButtonText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.textSecondary },
    applyButton: { flex: 2, height: 48, borderRadius: BorderRadius.md, overflow: 'hidden' },
    applyGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    applyButtonText: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: '#FFFFFF' },
});

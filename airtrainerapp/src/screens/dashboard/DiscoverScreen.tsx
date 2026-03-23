import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
    TextInput, FlatList, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, TrainerProfileRow, UserRow } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

const SPORTS = [
    { name: 'All', emoji: '🏆' },
    { name: 'Hockey', emoji: '🏒' }, { name: 'Baseball', emoji: '⚾' },
    { name: 'Basketball', emoji: '🏀' }, { name: 'Soccer', emoji: '⚽' },
    { name: 'Football', emoji: '🏈' }, { name: 'Tennis', emoji: '🎾' },
    { name: 'Golf', emoji: '⛳' }, { name: 'Swimming', emoji: '🏊' },
    { name: 'Boxing', emoji: '🥊' }, { name: 'Lacrosse', emoji: '🥍' },
];

interface TrainerWithUser extends TrainerProfileRow {
    users: UserRow;
    avg_rating?: number;
    review_count?: number;
}

export default function DiscoverScreen({ navigation }: any) {
    const { user } = useAuth();
    const [trainers, setTrainers] = useState<TrainerWithUser[]>([]);
    const [filteredTrainers, setFilteredTrainers] = useState<TrainerWithUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedSport, setSelectedSport] = useState('All');

    const fetchTrainers = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('trainer_profiles')
                .select('*, users!trainer_profiles_user_id_fkey(*)')
                .eq('verification_status', 'verified')
                .order('reliability_score', { ascending: false });

            if (error) throw error;
            setTrainers((data || []) as TrainerWithUser[]);
            setFilteredTrainers((data || []) as TrainerWithUser[]);
        } catch (error) {
            console.error('Error fetching trainers:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Also fetch unverified trainers as fallback (for demo purposes)
    const fetchAllTrainers = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('trainer_profiles')
                .select('*, users!trainer_profiles_user_id_fkey(*)')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTrainers((data || []) as TrainerWithUser[]);
            setFilteredTrainers((data || []) as TrainerWithUser[]);
        } catch (error) {
            console.error('Error fetching all trainers:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllTrainers();
    }, []);

    useEffect(() => {
        let filtered = trainers;
        if (selectedSport !== 'All') {
            filtered = filtered.filter((t) => t.sports?.includes(selectedSport));
        }
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
        setFilteredTrainers(filtered);
    }, [selectedSport, search, trainers]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchAllTrainers();
        setRefreshing(false);
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

            {/* Search Bar */}
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
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#161B22', borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginHorizontal: Spacing.xxl, paddingHorizontal: Spacing.lg, height: 48, marginBottom: Spacing.md },
    searchInput: { flex: 1, color: Colors.text, fontSize: FontSize.md },
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
});

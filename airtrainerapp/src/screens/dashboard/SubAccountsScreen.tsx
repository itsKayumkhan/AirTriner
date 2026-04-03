import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
    ScrollView,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

const MAX_SUB_ACCOUNTS = 6;

const SPORTS_LIST = [
    { label: 'Hockey', emoji: '\u{1F3D2}' },
    { label: 'Baseball', emoji: '\u{26BE}' },
    { label: 'Basketball', emoji: '\u{1F3C0}' },
    { label: 'Soccer', emoji: '\u{26BD}' },
    { label: 'Football', emoji: '\u{1F3C8}' },
    { label: 'Tennis', emoji: '\u{1F3BE}' },
    { label: 'Golf', emoji: '\u{26F3}' },
    { label: 'Swimming', emoji: '\u{1F3CA}' },
    { label: 'Boxing', emoji: '\u{1F94A}' },
    { label: 'Lacrosse', emoji: '\u{1F94D}' },
] as const;

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Pro'] as const;
type SkillLevel = (typeof SKILL_LEVELS)[number];

type SubAccountProfileData = {
    name?: string;
    email?: string | null;
    role?: 'athlete' | 'trainer';
    age?: number | null;
    sport?: string | null;
    skill_level?: SkillLevel | null;
    notes?: string | null;
    max_bookings_per_month?: number | null;
};

type SubAccount = {
    id: string;
    parent_user_id: string;
    profile_data: SubAccountProfileData;
    max_bookings_per_month: number | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
};

type Role = 'athlete' | 'trainer';

function getSportEmoji(sportLabel: string): string {
    const found = SPORTS_LIST.find((s) => s.label === sportLabel);
    return found ? found.emoji : '\u{1F3C5}';
}

function getInitials(name: string): string {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}

function AvatarGradient({ initials }: { initials: string }) {
    return (
        <View style={styles.avatarContainer}>
            {/* Simulate gradient with layered views */}
            <View style={styles.avatarGradientBase} />
            <View style={styles.avatarGradientOverlay} />
            <Text style={styles.avatarText}>{initials}</Text>
        </View>
    );
}

function RoleBadge({ role }: { role: Role }) {
    const isTrainer = role === 'trainer';
    return (
        <View style={[styles.roleBadge, isTrainer ? styles.roleBadgeTrainer : styles.roleBadgeAthlete]}>
            <Text style={[styles.roleBadgeText, isTrainer ? styles.roleBadgeTextTrainer : styles.roleBadgeTextAthlete]}>
                {isTrainer ? 'Trainer' : 'Athlete'}
            </Text>
        </View>
    );
}

export default function SubAccountsScreen({ navigation }: any) {
    const { user } = useAuth();
    const [accounts, setAccounts] = useState<SubAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isModalVisible, setModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Form state
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<Role>('athlete');
    const [age, setAge] = useState('');
    const [sport, setSport] = useState<string | null>(null);
    const [skillLevel, setSkillLevel] = useState<SkillLevel | null>(null);
    const [notes, setNotes] = useState('');
    const [maxBookings, setMaxBookings] = useState('');

    const fetchAccounts = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('sub_accounts')
                .select('*')
                .eq('parent_user_id', user.id)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setAccounts((data || []) as SubAccount[]);

        } catch (err) {
            console.error('Error fetching sub-accounts:', err);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchAccounts();
    }, [fetchAccounts]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchAccounts();
        setRefreshing(false);
    };

    const resetForm = () => {
        setFirstName('');
        setLastName('');
        setEmail('');
        setRole('athlete');
        setAge('');
        setSport(null);
        setSkillLevel(null);
        setNotes('');
        setMaxBookings('');
    };

    const handleOpenModal = () => {
        resetForm();
        setModalVisible(true);
    };

    const handleCloseModal = () => {
        setModalVisible(false);
        resetForm();
    };

    const handleAddAccount = async () => {
        if (!firstName.trim() || !user) return;
        if (accounts.length >= MAX_SUB_ACCOUNTS) {
            Alert.alert('Limit Reached', `You can only have up to ${MAX_SUB_ACCOUNTS} sub-accounts.`);
            return;
        }

        // Validate age if provided
        const ageNum = age.trim() ? parseInt(age.trim(), 10) : null;
        if (ageNum !== null && (isNaN(ageNum) || ageNum < 3 || ageNum > 99)) {
            Alert.alert('Invalid Age', 'Age must be a number between 3 and 99.');
            return;
        }

        const maxBookingsNum = maxBookings.trim() ? parseInt(maxBookings.trim(), 10) : null;
        if (maxBookingsNum !== null && (isNaN(maxBookingsNum) || maxBookingsNum < 1)) {
            Alert.alert('Invalid Value', 'Max bookings must be a positive number.');
            return;
        }

        setIsSaving(true);
        try {
            const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
            const profileData: SubAccountProfileData = {
                name: fullName,
                email: email.trim() || null,
                role,
                age: ageNum,
                sport: sport || null,
                skill_level: skillLevel || null,
                notes: notes.trim() || null,
                max_bookings_per_month: maxBookingsNum,
            };

            const { data, error } = await supabase
                .from('sub_accounts')
                .insert({
                    parent_user_id: user.id,
                    profile_data: profileData,
                    is_active: true,
                })
                .select()
                .single();

            if (error) throw error;

            setAccounts((prev) => [...prev, data as SubAccount]);
            handleCloseModal();
        } catch (err: any) {
            console.error('Error creating sub-account:', err);
            Alert.alert('Error', err.message || 'Failed to create sub-account');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLongPress = (account: SubAccount) => {
        Alert.alert(
            'Remove Sub-Account',
            `Are you sure you want to remove "${account.profile_data?.name}"? This action cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('sub_accounts')
                                .delete()
                                .eq('id', account.id);
                            if (error) throw error;
                            setAccounts((prev) => prev.filter((a) => a.id !== account.id));
                        } catch (err: any) {
                            Alert.alert('Error', err.message || 'Failed to remove sub-account');
                        }
                    },
                },
            ]
        );
    };

    if (isLoading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    const canAdd = accounts.length < MAX_SUB_ACCOUNTS;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={22} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Sub-Accounts</Text>
                {canAdd ? (
                    <TouchableOpacity style={styles.addHeaderButton} onPress={handleOpenModal}>
                        <Ionicons name="add" size={22} color={Colors.background} />
                    </TouchableOpacity>
                ) : (
                    <View style={styles.countBadge}>
                        <Text style={styles.countText}>{accounts.length}/{MAX_SUB_ACCOUNTS}</Text>
                    </View>
                )}
            </View>

            <ScrollView
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={Colors.primary}
                        colors={[Colors.primary]}
                    />
                }
            >
                {/* Capacity indicator */}
                {accounts.length > 0 && (
                    <View style={styles.capacityRow}>
                        <Text style={styles.capacityLabel}>
                            {accounts.length} of {MAX_SUB_ACCOUNTS} slots used
                        </Text>
                        <View style={styles.capacityBarTrack}>
                            <View
                                style={[
                                    styles.capacityBarFill,
                                    { width: `${(accounts.length / MAX_SUB_ACCOUNTS) * 100}%` },
                                ]}
                            />
                        </View>
                    </View>
                )}

                {/* Empty state */}
                {accounts.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconWrap}>
                            <Ionicons name="people-outline" size={44} color={Colors.primary} />
                        </View>
                        <Text style={styles.emptyTitle}>No sub-accounts yet</Text>
                        <Text style={styles.emptyText}>
                            Add family members or athletes you manage. Each sub-account can book sessions under your account.
                        </Text>
                        <TouchableOpacity style={styles.emptyAddButton} onPress={handleOpenModal}>
                            <Ionicons name="add-circle-outline" size={20} color={Colors.background} />
                            <Text style={styles.emptyAddButtonText}>Add Sub-Account</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.listContainer}>
                        <Text style={styles.sectionLabel}>ACCOUNTS</Text>
                        {accounts.map((acc) => {
                            const pd = acc.profile_data;
                            return (
                                <TouchableWithoutFeedback
                                    key={acc.id}
                                    onLongPress={() => handleLongPress(acc)}
                                    delayLongPress={500}
                                >
                                    <View style={styles.accountCard}>
                                        <AvatarGradient initials={getInitials(pd?.name || '?')} />
                                        <View style={styles.accountInfo}>
                                            <View style={styles.accountNameRow}>
                                                <Text style={styles.accountName}>{pd?.name}</Text>
                                                <RoleBadge role={pd?.role ?? 'athlete'} />
                                            </View>
                                            {pd?.email ? (
                                                <Text style={styles.accountEmail}>{pd.email}</Text>
                                            ) : (
                                                <Text style={styles.accountEmailMuted}>No email set</Text>
                                            )}
                                            {/* Extra info row */}
                                            {(pd?.age || pd?.sport || pd?.skill_level) && (
                                                <View style={styles.cardMetaRow}>
                                                    {pd?.age != null && (
                                                        <View style={styles.cardMetaBadge}>
                                                            <Text style={styles.cardMetaBadgeText}>
                                                                Age {pd.age}
                                                            </Text>
                                                        </View>
                                                    )}
                                                    {pd?.sport && (
                                                        <View style={styles.cardSportChip}>
                                                            <Text style={styles.cardSportChipText}>
                                                                {getSportEmoji(pd.sport)} {pd.sport}
                                                            </Text>
                                                        </View>
                                                    )}
                                                    {pd?.skill_level && (
                                                        <View style={styles.cardSkillBadge}>
                                                            <Text style={styles.cardSkillBadgeText}>
                                                                {pd.skill_level}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                            )}
                                            {pd?.notes ? (
                                                <Text style={styles.cardNotesPreview} numberOfLines={1}>
                                                    {pd.notes}
                                                </Text>
                                            ) : null}
                                        </View>
                                    </View>
                                </TouchableWithoutFeedback>
                            );
                        })}
                        <Text style={styles.longPressHint}>Long press an account to remove it</Text>
                    </View>
                )}

                {/* Add button at bottom when list has items */}
                {accounts.length > 0 && canAdd && (
                    <TouchableOpacity style={styles.addButton} onPress={handleOpenModal}>
                        <Ionicons name="add" size={20} color={Colors.background} />
                        <Text style={styles.addButtonText}>Add Sub-Account</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            {/* Add Account Modal */}
            <Modal visible={isModalVisible} transparent animationType="slide">
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <TouchableWithoutFeedback onPress={handleCloseModal}>
                        <View style={styles.modalBackdrop} />
                    </TouchableWithoutFeedback>

                    <View style={styles.modalContent}>
                        {/* Modal handle */}
                        <View style={styles.modalHandle} />

                        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>New Sub-Account</Text>
                                <TouchableOpacity onPress={handleCloseModal} style={styles.closeButton}>
                                    <Ionicons name="close" size={20} color={Colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            {/* First Name */}
                            <Text style={styles.inputLabel}>First Name *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Alex"
                                placeholderTextColor={Colors.textTertiary}
                                value={firstName}
                                onChangeText={setFirstName}
                                autoFocus
                                autoCapitalize="words"
                            />

                            {/* Last Name */}
                            <Text style={styles.inputLabel}>Last Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Johnson"
                                placeholderTextColor={Colors.textTertiary}
                                value={lastName}
                                onChangeText={setLastName}
                                autoCapitalize="words"
                            />

                            {/* Email */}
                            <Text style={styles.inputLabel}>Email</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. alex@example.com"
                                placeholderTextColor={Colors.textTertiary}
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />

                            {/* Role Picker */}
                            <Text style={styles.inputLabel}>Role</Text>
                            <View style={styles.rolePicker}>
                                <TouchableOpacity
                                    style={[styles.roleOption, role === 'athlete' && styles.roleOptionActive]}
                                    onPress={() => setRole('athlete')}
                                >
                                    <Ionicons
                                        name="fitness-outline"
                                        size={18}
                                        color={role === 'athlete' ? Colors.background : Colors.textSecondary}
                                    />
                                    <Text
                                        style={[
                                            styles.roleOptionText,
                                            role === 'athlete' && styles.roleOptionTextActive,
                                        ]}
                                    >
                                        Athlete
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.roleOption, role === 'trainer' && styles.roleOptionActive]}
                                    onPress={() => setRole('trainer')}
                                >
                                    <Ionicons
                                        name="ribbon-outline"
                                        size={18}
                                        color={role === 'trainer' ? Colors.background : Colors.textSecondary}
                                    />
                                    <Text
                                        style={[
                                            styles.roleOptionText,
                                            role === 'trainer' && styles.roleOptionTextActive,
                                        ]}
                                    >
                                        Trainer
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Age */}
                            <Text style={styles.inputLabel}>Age</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. 12"
                                placeholderTextColor={Colors.textTertiary}
                                value={age}
                                onChangeText={(text) => setAge(text.replace(/[^0-9]/g, ''))}
                                keyboardType="number-pad"
                                maxLength={2}
                            />

                            {/* Primary Sport */}
                            <Text style={styles.inputLabel}>Primary Sport</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.sportScrollContainer}
                                contentContainerStyle={styles.sportScrollContent}
                            >
                                {SPORTS_LIST.map((s) => {
                                    const isActive = sport === s.label;
                                    return (
                                        <TouchableOpacity
                                            key={s.label}
                                            style={[
                                                styles.sportChip,
                                                isActive && styles.sportChipActive,
                                            ]}
                                            onPress={() => setSport(isActive ? null : s.label)}
                                        >
                                            <Text style={styles.sportChipEmoji}>{s.emoji}</Text>
                                            <Text
                                                style={[
                                                    styles.sportChipText,
                                                    isActive && styles.sportChipTextActive,
                                                ]}
                                            >
                                                {s.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>

                            {/* Skill Level */}
                            <Text style={styles.inputLabel}>Skill Level</Text>
                            <View style={styles.skillLevelRow}>
                                {SKILL_LEVELS.map((level) => {
                                    const isActive = skillLevel === level;
                                    return (
                                        <TouchableOpacity
                                            key={level}
                                            style={[
                                                styles.skillLevelButton,
                                                isActive && styles.skillLevelButtonActive,
                                            ]}
                                            onPress={() => setSkillLevel(isActive ? null : level)}
                                        >
                                            <Text
                                                style={[
                                                    styles.skillLevelText,
                                                    isActive && styles.skillLevelTextActive,
                                                ]}
                                            >
                                                {level}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Notes */}
                            <Text style={styles.inputLabel}>Notes</Text>
                            <TextInput
                                style={[styles.input, styles.inputMultiline]}
                                placeholder="Any injuries, allergies, or preferences..."
                                placeholderTextColor={Colors.textTertiary}
                                value={notes}
                                onChangeText={setNotes}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                            />

                            {/* Max Bookings/Month */}
                            <Text style={styles.inputLabel}>Max Bookings / Month</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. 4 (optional)"
                                placeholderTextColor={Colors.textTertiary}
                                value={maxBookings}
                                onChangeText={(text) => setMaxBookings(text.replace(/[^0-9]/g, ''))}
                                keyboardType="number-pad"
                                maxLength={3}
                            />

                            {/* Save Button */}
                            <TouchableOpacity
                                style={[styles.saveButton, (!firstName.trim() || isSaving) && styles.saveButtonDisabled]}
                                onPress={handleAddAccount}
                                disabled={!firstName.trim() || isSaving}
                            >
                                {isSaving ? (
                                    <ActivityIndicator color={Colors.background} size="small" />
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle-outline" size={20} color={Colors.background} />
                                        <Text style={styles.saveButtonText}>Create Account</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.xxl,
        paddingTop: 60,
        paddingBottom: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.border,
    },
    headerTitle: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    addHeaderButton: {
        width: 44,
        height: 44,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    countBadge: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.pill,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    countText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        fontWeight: FontWeight.medium,
    },

    // Content
    contentContainer: {
        padding: Spacing.xxl,
        flexGrow: 1,
    },

    // Capacity bar
    capacityRow: {
        marginBottom: Spacing.xl,
        gap: Spacing.sm,
    },
    capacityLabel: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    capacityBarTrack: {
        height: 4,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.pill,
        overflow: 'hidden',
    },
    capacityBarFill: {
        height: '100%',
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.pill,
    },

    // Empty state
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: Spacing.lg,
    },
    emptyIconWrap: {
        width: 88,
        height: 88,
        borderRadius: BorderRadius.xxl,
        backgroundColor: Colors.primaryGlow,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.borderActive,
    },
    emptyTitle: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    emptyText: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        paddingHorizontal: Spacing.xl,
        lineHeight: 22,
    },
    emptyAddButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.sm,
    },
    emptyAddButtonText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.background,
    },

    // List
    sectionLabel: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
        color: Colors.textTertiary,
        letterSpacing: 1.2,
        marginBottom: Spacing.md,
    },
    listContainer: {
        gap: Spacing.sm,
        marginBottom: Spacing.xl,
    },
    accountCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: Colors.card,
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: Spacing.md,
        ...Shadows.small,
    },

    // Avatar
    avatarContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    avatarGradientBase: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#45D0FF',
    },
    avatarGradientOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#0047AB',
        opacity: 0.55,
    },
    avatarText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: '#ffffff',
        zIndex: 1,
    },

    // Account info
    accountInfo: {
        flex: 1,
        gap: 3,
    },
    accountNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    accountName: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
        flex: 1,
    },
    accountEmail: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    accountEmailMuted: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
        fontStyle: 'italic',
    },

    // Card meta badges
    cardMetaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
        marginTop: Spacing.xs,
    },
    cardMetaBadge: {
        backgroundColor: Colors.glass,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.pill,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
    },
    cardMetaBadgeText: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        fontWeight: FontWeight.medium,
    },
    cardSportChip: {
        backgroundColor: Colors.primaryGlow,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.pill,
        borderWidth: 1,
        borderColor: Colors.borderActive,
    },
    cardSportChipText: {
        fontSize: FontSize.xs,
        color: Colors.primary,
        fontWeight: FontWeight.medium,
    },
    cardSkillBadge: {
        backgroundColor: 'rgba(0, 71, 171, 0.2)',
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.pill,
    },
    cardSkillBadgeText: {
        fontSize: FontSize.xs,
        color: '#7eb4ff',
        fontWeight: FontWeight.medium,
    },
    cardNotesPreview: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        fontStyle: 'italic',
        marginTop: Spacing.xs,
    },

    // Role badge
    roleBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: BorderRadius.pill,
    },
    roleBadgeAthlete: {
        backgroundColor: Colors.primaryGlow,
    },
    roleBadgeTrainer: {
        backgroundColor: 'rgba(0, 71, 171, 0.2)',
    },
    roleBadgeText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.semibold,
    },
    roleBadgeTextAthlete: {
        color: Colors.primary,
    },
    roleBadgeTextTrainer: {
        color: '#7eb4ff',
    },

    longPressHint: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        textAlign: 'center',
        marginTop: Spacing.sm,
    },

    // Add button
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.primary,
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
    },
    addButtonText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.background,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    modalContent: {
        backgroundColor: Colors.card,
        borderTopLeftRadius: BorderRadius.xxl,
        borderTopRightRadius: BorderRadius.xxl,
        padding: Spacing.xxl,
        paddingBottom: 40,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: Colors.border,
        maxHeight: '90%',
        ...Shadows.large,
    },
    modalHandle: {
        width: 40,
        height: 4,
        backgroundColor: Colors.border,
        borderRadius: BorderRadius.pill,
        alignSelf: 'center',
        marginBottom: Spacing.xl,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    modalTitle: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Form inputs
    inputLabel: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        fontWeight: FontWeight.medium,
        marginBottom: Spacing.xs,
    },
    input: {
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        color: Colors.text,
        fontSize: FontSize.md,
        marginBottom: Spacing.lg,
    },
    inputMultiline: {
        minHeight: 80,
        paddingTop: Spacing.md,
    },

    // Role picker
    rolePicker: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginBottom: Spacing.xl,
    },
    roleOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1.5,
        borderColor: Colors.border,
        backgroundColor: Colors.surface,
    },
    roleOptionActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    roleOptionText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.medium,
        color: Colors.textSecondary,
    },
    roleOptionTextActive: {
        color: Colors.background,
        fontWeight: FontWeight.semibold,
    },

    // Sport selector
    sportScrollContainer: {
        marginBottom: Spacing.lg,
    },
    sportScrollContent: {
        gap: Spacing.sm,
        paddingVertical: Spacing.xs,
    },
    sportChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.pill,
        backgroundColor: Colors.glass,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
    },
    sportChipActive: {
        backgroundColor: Colors.primaryGlow,
        borderColor: Colors.primary,
    },
    sportChipEmoji: {
        fontSize: 16,
    },
    sportChipText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        fontWeight: FontWeight.medium,
    },
    sportChipTextActive: {
        color: Colors.primary,
        fontWeight: FontWeight.semibold,
    },

    // Skill level selector
    skillLevelRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginBottom: Spacing.xl,
    },
    skillLevelButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
        borderWidth: 1.5,
        borderColor: Colors.border,
        backgroundColor: Colors.surface,
    },
    skillLevelButtonActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    skillLevelText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.medium,
        color: Colors.textSecondary,
    },
    skillLevelTextActive: {
        color: Colors.background,
        fontWeight: FontWeight.semibold,
    },

    // Save button
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.primary,
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.sm,
    },
    saveButtonDisabled: {
        opacity: 0.45,
    },
    saveButtonText: {
        color: Colors.background,
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
    },
});

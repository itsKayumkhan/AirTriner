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
    'hockey', 'baseball', 'basketball', 'soccer', 'football',
    'tennis', 'golf', 'swimming', 'boxing', 'lacrosse',
] as const;

const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'pro'] as const;
type SkillLevel = (typeof SKILL_LEVELS)[number];

type SubAccountProfileData = {
    first_name: string;
    last_name: string;
    age?: number;
    sport?: string;
    skill_level?: string;
    notes?: string;
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

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function getInitials(pd: SubAccountProfileData): string {
    const f = pd.first_name?.[0] || '';
    const l = pd.last_name?.[0] || '';
    return (f + l).toUpperCase() || '??';
}

function AvatarGradient({ initials }: { initials: string }) {
    return (
        <View style={styles.avatarContainer}>
            <View style={styles.avatarGradientBase} />
            <View style={styles.avatarGradientOverlay} />
            <Text style={styles.avatarText}>{initials}</Text>
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
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Form state - matches web: first_name, last_name, age, sport, skill_level, notes
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [age, setAge] = useState('');
    const [sport, setSport] = useState('hockey');
    const [skillLevel, setSkillLevel] = useState<SkillLevel>('beginner');
    const [notes, setNotes] = useState('');
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [saveError, setSaveError] = useState<string | null>(null);

    const fetchAccounts = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('sub_accounts')
                .select('*')
                .eq('parent_user_id', user.id)
                .eq('is_active', true)
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
        setAge('');
        setSport('hockey');
        setSkillLevel('beginner');
        setNotes('');
        setFormErrors({});
        setSaveError(null);
        setEditingId(null);
        setModalVisible(false);
    };

    const openAddModal = () => {
        resetForm();
        setModalVisible(true);
    };

    const openEditModal = (account: SubAccount) => {
        const pd = account.profile_data;
        setFirstName(pd.first_name || '');
        setLastName(pd.last_name || '');
        setAge(pd.age ? String(pd.age) : '');
        setSport(pd.sport || 'hockey');
        setSkillLevel((pd.skill_level as SkillLevel) || 'beginner');
        setNotes(pd.notes || '');
        setFormErrors({});
        setSaveError(null);
        setEditingId(account.id);
        setModalVisible(true);
    };

    const validateForm = (): boolean => {
        const errors: Record<string, string> = {};

        if (!firstName.trim()) {
            errors.first_name = 'First name is required';
        } else if (firstName.trim().length < 2) {
            errors.first_name = 'First name must be at least 2 characters';
        }

        if (!lastName.trim()) {
            errors.last_name = 'Last name is required';
        } else if (lastName.trim().length < 2) {
            errors.last_name = 'Last name must be at least 2 characters';
        }

        if (age && (Number(age) < 3 || Number(age) > 99)) {
            errors.age = 'Age must be between 3 and 99';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSave = async () => {
        if (!user || !validateForm()) return;
        setIsSaving(true);
        setSaveError(null);

        const profileData: SubAccountProfileData = {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            age: age ? Number(age) : undefined,
            sport,
            skill_level: skillLevel,
            notes: notes.trim() || undefined,
        };

        try {
            if (editingId) {
                // Update existing
                const { error } = await supabase
                    .from('sub_accounts')
                    .update({ profile_data: profileData, updated_at: new Date().toISOString() })
                    .eq('id', editingId);

                if (error) throw error;

                setAccounts((prev) =>
                    prev.map((a) => (a.id === editingId ? { ...a, profile_data: profileData } : a))
                );
            } else {
                // Create new
                if (accounts.length >= MAX_SUB_ACCOUNTS) {
                    setSaveError(`You can only have up to ${MAX_SUB_ACCOUNTS} sub-accounts.`);
                    setIsSaving(false);
                    return;
                }

                const { data, error } = await supabase
                    .from('sub_accounts')
                    .insert({
                        parent_user_id: user.id,
                        profile_data: profileData,
                        max_bookings_per_month: 10,
                        is_active: true,
                    })
                    .select()
                    .single();

                if (error) throw error;
                setAccounts((prev) => [...prev, data as SubAccount]);
            }
            resetForm();
        } catch (err: any) {
            const msg = err?.message || 'Failed to save. Please try again.';
            setSaveError(msg);
            console.error('Save failed:', err);
        } finally {
            setIsSaving(false);
        }
    };

    // Soft-delete matching web behavior
    const handleDelete = (account: SubAccount) => {
        Alert.alert(
            'Remove Sub-Account',
            `Remove ${account.profile_data.first_name} ${account.profile_data.last_name}? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        setDeleteError(null);
                        try {
                            const { error } = await supabase
                                .from('sub_accounts')
                                .update({ is_active: false, updated_at: new Date().toISOString() })
                                .eq('id', account.id);
                            if (error) throw error;
                            setAccounts((prev) => prev.filter((a) => a.id !== account.id));
                        } catch (err: any) {
                            setDeleteError(err?.message || 'Failed to remove sub-account.');
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
                    <TouchableOpacity style={styles.addHeaderButton} onPress={openAddModal}>
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
                {/* Subtitle */}
                <Text style={styles.pageSubtitle}>
                    Manage profiles for family members ({accounts.length}/{MAX_SUB_ACCOUNTS} used)
                </Text>

                {/* Capacity indicator */}
                {accounts.length > 0 && (
                    <View style={styles.capacityRow}>
                        <View style={styles.capacityBarTrack}>
                            <View
                                style={[
                                    styles.capacityBarFill,
                                    {
                                        width: `${(accounts.length / MAX_SUB_ACCOUNTS) * 100}%`,
                                        backgroundColor: accounts.length >= MAX_SUB_ACCOUNTS ? Colors.warning : Colors.primary,
                                    },
                                ]}
                            />
                        </View>
                        {accounts.length >= MAX_SUB_ACCOUNTS && (
                            <Text style={styles.capacityFull}>
                                Maximum sub-accounts reached. Remove one to add another.
                            </Text>
                        )}
                    </View>
                )}

                {/* Delete error toast */}
                {deleteError && (
                    <View style={styles.errorBanner}>
                        <Ionicons name="close-circle" size={18} color={Colors.error} />
                        <Text style={styles.errorBannerText}>{deleteError}</Text>
                        <TouchableOpacity onPress={() => setDeleteError(null)}>
                            <Ionicons name="close" size={16} color={Colors.error} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* Empty state */}
                {accounts.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconWrap}>
                            <Ionicons name="people-outline" size={44} color={Colors.primary} />
                        </View>
                        <Text style={styles.emptyTitle}>No family members yet</Text>
                        <Text style={styles.emptyText}>
                            Add up to {MAX_SUB_ACCOUNTS} family members who can book sessions under your account.
                        </Text>
                        <Text style={styles.emptySubText}>
                            All sessions booked by family members are billed to your account.
                        </Text>
                        <TouchableOpacity style={styles.emptyAddButton} onPress={openAddModal}>
                            <Ionicons name="add-circle-outline" size={20} color={Colors.background} />
                            <Text style={styles.emptyAddButtonText}>Add First Member</Text>
                        </TouchableOpacity>

                        {/* Feature hints */}
                        <View style={styles.featureHints}>
                            {[
                                { title: 'Shared Billing', desc: 'Billing goes to the parent account automatically.' },
                                { title: 'Individual Profiles', desc: 'Each member has their own sport and skill settings.' },
                                { title: 'Easy Booking', desc: 'Select a family member when booking a session.' },
                            ].map((f) => (
                                <View key={f.title} style={styles.featureHintCard}>
                                    <Text style={styles.featureHintTitle}>{f.title}</Text>
                                    <Text style={styles.featureHintDesc}>{f.desc}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : (
                    <View style={styles.listContainer}>
                        {accounts.map((acc) => {
                            const pd = acc.profile_data;
                            return (
                                <View key={acc.id} style={styles.accountCard}>
                                    <View style={styles.accountCardTop}>
                                        <AvatarGradient initials={getInitials(pd)} />
                                        <View style={styles.accountInfo}>
                                            <Text style={styles.accountName}>
                                                {pd.first_name} {pd.last_name}
                                            </Text>
                                            {pd.age ? (
                                                <Text style={styles.accountAge}>Age {pd.age}</Text>
                                            ) : (
                                                <Text style={styles.accountAgeMuted}>No age set</Text>
                                            )}
                                        </View>
                                    </View>

                                    {/* Tags */}
                                    {(pd.sport || pd.skill_level) && (
                                        <View style={styles.cardMetaRow}>
                                            {pd.sport && (
                                                <View style={styles.cardSportChip}>
                                                    <Text style={styles.cardSportChipText}>
                                                        {pd.sport.replace(/_/g, ' ')}
                                                    </Text>
                                                </View>
                                            )}
                                            {pd.skill_level && (
                                                <View style={styles.cardSkillBadge}>
                                                    <Text style={styles.cardSkillBadgeText}>
                                                        {capitalize(pd.skill_level)}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    {/* Notes */}
                                    {pd.notes ? (
                                        <View style={styles.notesContainer}>
                                            <Text style={styles.notesLabel}>Notes</Text>
                                            <Text style={styles.notesText} numberOfLines={2}>
                                                {pd.notes}
                                            </Text>
                                        </View>
                                    ) : null}

                                    {/* Action buttons - Edit + Remove */}
                                    <View style={styles.cardActions}>
                                        <TouchableOpacity
                                            style={styles.editBtn}
                                            onPress={() => openEditModal(acc)}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="create-outline" size={14} color={Colors.text} />
                                            <Text style={styles.editBtnText}>Edit</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.removeBtn}
                                            onPress={() => handleDelete(acc)}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="trash-outline" size={14} color={Colors.error} />
                                            <Text style={styles.removeBtnText}>Remove</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Add button at bottom when list has items */}
                {accounts.length > 0 && canAdd && (
                    <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
                        <Ionicons name="add" size={20} color={Colors.background} />
                        <Text style={styles.addButtonText}>Add Member</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            {/* Add/Edit Account Modal */}
            <Modal visible={isModalVisible} transparent animationType="slide">
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <TouchableWithoutFeedback onPress={resetForm}>
                        <View style={styles.modalBackdrop} />
                    </TouchableWithoutFeedback>

                    <View style={styles.modalContent}>
                        <View style={styles.modalHandle} />

                        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>
                                    {editingId ? 'Edit Member' : 'Add Family Member'}
                                </Text>
                                <TouchableOpacity onPress={resetForm} style={styles.closeButton}>
                                    <Ionicons name="close" size={20} color={Colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            {/* First Name */}
                            <Text style={styles.inputLabel}>First Name *</Text>
                            <TextInput
                                style={[styles.input, formErrors.first_name ? styles.inputError : null]}
                                placeholder="First name"
                                placeholderTextColor={Colors.textTertiary}
                                value={firstName}
                                onChangeText={(t) => { setFirstName(t); setFormErrors((p) => ({ ...p, first_name: '' })); }}
                                autoFocus
                                autoCapitalize="words"
                            />
                            {formErrors.first_name ? (
                                <Text style={styles.fieldError}>{formErrors.first_name}</Text>
                            ) : null}

                            {/* Last Name */}
                            <Text style={styles.inputLabel}>Last Name *</Text>
                            <TextInput
                                style={[styles.input, formErrors.last_name ? styles.inputError : null]}
                                placeholder="Last name"
                                placeholderTextColor={Colors.textTertiary}
                                value={lastName}
                                onChangeText={(t) => { setLastName(t); setFormErrors((p) => ({ ...p, last_name: '' })); }}
                                autoCapitalize="words"
                            />
                            {formErrors.last_name ? (
                                <Text style={styles.fieldError}>{formErrors.last_name}</Text>
                            ) : null}

                            {/* Age */}
                            <Text style={styles.inputLabel}>Age</Text>
                            <TextInput
                                style={[styles.input, formErrors.age ? styles.inputError : null]}
                                placeholder="Age (optional)"
                                placeholderTextColor={Colors.textTertiary}
                                value={age}
                                onChangeText={(text) => { setAge(text.replace(/[^0-9]/g, '')); setFormErrors((p) => ({ ...p, age: '' })); }}
                                keyboardType="number-pad"
                                maxLength={2}
                            />
                            {formErrors.age ? (
                                <Text style={styles.fieldError}>{formErrors.age}</Text>
                            ) : null}

                            {/* Primary Sport */}
                            <Text style={styles.inputLabel}>Primary Sport</Text>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.sportScrollContainer}
                                contentContainerStyle={styles.sportScrollContent}
                            >
                                {SPORTS_LIST.map((s) => {
                                    const isActive = sport === s;
                                    return (
                                        <TouchableOpacity
                                            key={s}
                                            style={[styles.sportChip, isActive && styles.sportChipActive]}
                                            onPress={() => setSport(s)}
                                        >
                                            <Text style={[styles.sportChipText, isActive && styles.sportChipTextActive]}>
                                                {capitalize(s)}
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
                                            style={[styles.skillLevelButton, isActive && styles.skillLevelButtonActive]}
                                            onPress={() => setSkillLevel(level)}
                                        >
                                            <Text style={[styles.skillLevelText, isActive && styles.skillLevelTextActive]}>
                                                {capitalize(level)}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Notes */}
                            <Text style={styles.inputLabel}>Notes</Text>
                            <TextInput
                                style={[styles.input, styles.inputMultiline]}
                                placeholder="Injuries, preferences, or any special notes"
                                placeholderTextColor={Colors.textTertiary}
                                value={notes}
                                onChangeText={setNotes}
                                multiline
                                numberOfLines={3}
                                textAlignVertical="top"
                            />

                            {/* Save error */}
                            {saveError && (
                                <View style={styles.saveErrorBanner}>
                                    <Ionicons name="close-circle" size={16} color={Colors.error} />
                                    <Text style={styles.saveErrorText}>{saveError}</Text>
                                </View>
                            )}

                            {/* Action buttons */}
                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={styles.cancelBtn}
                                    onPress={resetForm}
                                >
                                    <Text style={styles.cancelBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.saveButton,
                                        (!firstName.trim() || !lastName.trim() || isSaving) && styles.saveButtonDisabled,
                                    ]}
                                    onPress={handleSave}
                                    disabled={!firstName.trim() || !lastName.trim() || isSaving}
                                >
                                    {isSaving ? (
                                        <ActivityIndicator color={Colors.background} size="small" />
                                    ) : (
                                        <Text style={styles.saveButtonText}>
                                            {editingId ? 'Update Member' : 'Add Member'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
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
    pageSubtitle: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.lg,
    },

    // Capacity bar
    capacityRow: {
        marginBottom: Spacing.lg,
    },
    capacityBarTrack: {
        height: 4,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.pill,
        overflow: 'hidden',
    },
    capacityBarFill: {
        height: '100%',
        borderRadius: BorderRadius.pill,
    },
    capacityFull: {
        fontSize: FontSize.xs,
        color: Colors.warning,
        fontWeight: FontWeight.bold,
        marginTop: Spacing.sm,
    },

    // Error banner
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        padding: Spacing.md,
        backgroundColor: Colors.errorLight,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: 'rgba(255,23,68,0.2)',
        marginBottom: Spacing.lg,
    },
    errorBannerText: {
        flex: 1,
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.error,
    },

    // Empty state
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        gap: Spacing.md,
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
    emptySubText: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
        textAlign: 'center',
        paddingHorizontal: Spacing.xxl,
        lineHeight: 20,
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
    featureHints: {
        width: '100%',
        gap: Spacing.sm,
        marginTop: Spacing.xl,
    },
    featureHintCard: {
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        padding: Spacing.lg,
    },
    featureHintTitle: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.textSecondary,
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: Spacing.xs,
    },
    featureHintDesc: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        lineHeight: 18,
    },

    // List
    listContainer: {
        gap: Spacing.md,
        marginBottom: Spacing.xl,
    },
    accountCard: {
        backgroundColor: Colors.card,
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        ...Shadows.small,
    },
    accountCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        marginBottom: Spacing.md,
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
    },
    accountName: {
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    accountAge: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginTop: 2,
    },
    accountAgeMuted: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        fontStyle: 'italic',
        marginTop: 2,
    },

    // Card meta badges
    cardMetaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    cardSportChip: {
        backgroundColor: Colors.primaryGlow,
        paddingHorizontal: Spacing.md,
        paddingVertical: 4,
        borderRadius: BorderRadius.pill,
        borderWidth: 1,
        borderColor: Colors.borderActive,
    },
    cardSportChipText: {
        fontSize: FontSize.xs,
        color: Colors.primary,
        fontWeight: FontWeight.bold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    cardSkillBadge: {
        backgroundColor: Colors.glass,
        paddingHorizontal: Spacing.md,
        paddingVertical: 4,
        borderRadius: BorderRadius.pill,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
    },
    cardSkillBadgeText: {
        fontSize: FontSize.xs,
        color: Colors.textSecondary,
        fontWeight: FontWeight.bold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    // Notes
    notesContainer: {
        backgroundColor: Colors.surface,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: Spacing.md,
    },
    notesLabel: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        fontWeight: FontWeight.medium,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    notesText: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 20,
    },

    // Card actions
    cardActions: {
        flexDirection: 'row',
        gap: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        paddingTop: Spacing.md,
    },
    editBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.glass,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
    },
    editBtnText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    removeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.errorLight,
        borderWidth: 1,
        borderColor: 'rgba(255,23,68,0.2)',
    },
    removeBtnText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.error,
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
    inputError: {
        borderColor: 'rgba(255,23,68,0.5)',
    },
    inputMultiline: {
        minHeight: 80,
        paddingTop: Spacing.md,
    },
    fieldError: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.error,
        marginTop: -Spacing.md,
        marginBottom: Spacing.md,
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
        paddingHorizontal: Spacing.lg,
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

    // Save error
    saveErrorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        padding: Spacing.md,
        backgroundColor: Colors.errorLight,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: 'rgba(255,23,68,0.2)',
        marginBottom: Spacing.lg,
    },
    saveErrorText: {
        flex: 1,
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.error,
    },

    // Modal actions
    modalActions: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginTop: Spacing.sm,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: Colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelBtnText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
    },

    // Save button
    saveButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
    },
    saveButtonDisabled: {
        opacity: 0.4,
    },
    saveButtonText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.background,
    },
});

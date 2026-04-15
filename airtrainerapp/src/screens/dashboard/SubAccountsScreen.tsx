import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    TouchableOpacity,
    TouchableWithoutFeedback,
    ScrollView,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';
import { formatSportName } from '../../lib/format';
import { ScreenWrapper, ScreenHeader, Card, Badge, Avatar, EmptyState, LoadingScreen, Button, SectionHeader } from '../../components/ui';

const MAX_SUB_ACCOUNTS = 6;

const SPORTS_LIST = [
    'hockey', 'baseball', 'basketball', 'soccer', 'football',
    'tennis', 'golf', 'swimming', 'boxing', 'lacrosse',
] as const;

const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'pro'] as const;
type SkillLevel = (typeof SKILL_LEVELS)[number];

const MAX_SPORTS = 3;

type SubAccountProfileData = {
    first_name: string;
    last_name: string;
    age?: number;
    sport?: string;       // kept for backwards compatibility
    sports?: string[];    // up to 3 sports
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

/** Normalize legacy single-sport to sports array for backwards compat */
function normalizeSports(profileData: SubAccountProfileData): string[] {
    return profileData.sports?.length
        ? profileData.sports
        : profileData.sport
            ? [profileData.sport]
            : [];
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
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

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [age, setAge] = useState('');
    const [selectedSports, setSelectedSports] = useState<string[]>([]);
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
        setSelectedSports([]);
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
        // Migrate from legacy single `sport` to `sports` array
        setSelectedSports(normalizeSports(pd));
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

        if (selectedSports.length === 0) {
            errors.sports = 'Please select at least one sport';
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
            sports: selectedSports,
            sport: selectedSports[0] || undefined, // backwards compat
            skill_level: skillLevel,
            notes: notes.trim() || undefined,
        };

        try {
            if (editingId) {
                const { error } = await supabase
                    .from('sub_accounts')
                    .update({ profile_data: profileData, updated_at: new Date().toISOString() })
                    .eq('id', editingId);

                if (error) throw error;

                setAccounts((prev) =>
                    prev.map((a) => (a.id === editingId ? { ...a, profile_data: profileData } : a))
                );
            } else {
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
        return <LoadingScreen message="Loading sub-accounts..." />;
    }

    const canAdd = accounts.length < MAX_SUB_ACCOUNTS;

    return (
        <ScreenWrapper refreshing={refreshing} onRefresh={onRefresh}>
            <ScreenHeader
                title="Sub-Accounts"
                subtitle={`${accounts.length}/${MAX_SUB_ACCOUNTS} used`}
                onBack={() => navigation.goBack()}
                rightAction={
                    canAdd
                        ? { icon: 'add', onPress: openAddModal }
                        : undefined
                }
            />

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
                <Card variant="outlined" style={styles.errorBanner}>
                    <View style={styles.errorBannerRow}>
                        <Ionicons name="close-circle" size={18} color={Colors.error} />
                        <Text style={styles.errorBannerText}>{deleteError}</Text>
                        <TouchableOpacity onPress={() => setDeleteError(null)}>
                            <Ionicons name="close" size={16} color={Colors.error} />
                        </TouchableOpacity>
                    </View>
                </Card>
            )}

            {/* Empty state */}
            {accounts.length === 0 ? (
                <>
                    <EmptyState
                        icon="people-outline"
                        title="No family members yet"
                        description={`Add up to ${MAX_SUB_ACCOUNTS} family members who can book sessions under your account. All sessions are billed to your account.`}
                        actionLabel="Add First Member"
                        onAction={openAddModal}
                    />

                    {/* Feature hints */}
                    <View style={styles.featureHints}>
                        {[
                            { title: 'Shared Billing', desc: 'Billing goes to the parent account automatically.' },
                            { title: 'Individual Profiles', desc: 'Each member has their own sport and skill settings.' },
                            { title: 'Easy Booking', desc: 'Select a family member when booking a session.' },
                        ].map((f) => (
                            <Card key={f.title} variant="outlined" style={styles.featureHintCard}>
                                <Text style={styles.featureHintTitle}>{f.title}</Text>
                                <Text style={styles.featureHintDesc}>{f.desc}</Text>
                            </Card>
                        ))}
                    </View>
                </>
            ) : (
                <View style={styles.listContainer}>
                    {accounts.map((acc, index) => {
                        const pd = acc.profile_data;
                        const fullName = `${pd.first_name} ${pd.last_name}`;

                        return (
                            <Animated.View key={acc.id} entering={FadeInDown.duration(200).delay(index * 30)}>
                            <Card style={styles.accountCard}>
                                <View style={styles.accountCardTop}>
                                    <Avatar
                                        name={fullName}
                                        size={48}
                                        borderColor={Colors.borderActive}
                                    />
                                    <View style={styles.accountInfo}>
                                        <Text style={styles.accountName}>{fullName}</Text>
                                        {pd.age ? (
                                            <Text style={styles.accountAge}>Age {pd.age}</Text>
                                        ) : (
                                            <Text style={styles.accountAgeMuted}>No age set</Text>
                                        )}
                                    </View>
                                </View>

                                {(normalizeSports(pd).length > 0 || pd.skill_level) && (
                                    <View style={styles.cardMetaRow}>
                                        {normalizeSports(pd).map((s) => (
                                            <Badge
                                                key={s}
                                                label={formatSportName(s)}
                                                color={Colors.primary}
                                                bgColor={Colors.primaryGlow}
                                            />
                                        ))}
                                        {pd.skill_level && (
                                            <Badge
                                                label={capitalize(pd.skill_level)}
                                                color={Colors.textSecondary}
                                                bgColor={Colors.glass}
                                            />
                                        )}
                                    </View>
                                )}

                                {pd.notes ? (
                                    <View style={styles.notesContainer}>
                                        <Text style={styles.notesLabel}>Notes</Text>
                                        <Text style={styles.notesText} numberOfLines={2}>
                                            {pd.notes}
                                        </Text>
                                    </View>
                                ) : null}

                                <View style={styles.cardActions}>
                                    <Pressable
                                        style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                                        onPress={() => openEditModal(acc)}
                                        accessibilityLabel={`Edit ${fullName}`}
                                    >
                                        <Ionicons name="create-outline" size={14} color={Colors.text} />
                                        <Text style={styles.editBtnText}>Edit</Text>
                                    </Pressable>
                                    <Pressable
                                        style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                                        onPress={() => handleDelete(acc)}
                                        accessibilityLabel={`Remove ${fullName}`}
                                    >
                                        <Ionicons name="trash-outline" size={14} color={Colors.error} />
                                        <Text style={styles.removeBtnText}>Remove</Text>
                                    </Pressable>
                                </View>
                            </Card>
                            </Animated.View>
                        );
                    })}
                </View>
            )}

            {/* Add button at bottom when list has items */}
            {accounts.length > 0 && canAdd && (
                <Button
                    title="Add Member"
                    onPress={openAddModal}
                    variant="primary"
                    icon="add"
                />
            )}

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

                            {/* Sports (up to 3) */}
                            <View style={styles.sportLabelRow}>
                                <Text style={styles.inputLabel}>Sports</Text>
                                <Text style={styles.sportCount}>
                                    {selectedSports.length}/{MAX_SPORTS} selected
                                </Text>
                            </View>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.sportScrollContainer}
                                contentContainerStyle={styles.sportScrollContent}
                            >
                                {SPORTS_LIST.map((s) => {
                                    const isActive = selectedSports.includes(s);
                                    const isDisabled = !isActive && selectedSports.length >= MAX_SPORTS;
                                    return (
                                        <TouchableOpacity
                                            key={s}
                                            style={[
                                                styles.sportChip,
                                                isActive && styles.sportChipActive,
                                                isDisabled && styles.sportChipDisabled,
                                            ]}
                                            onPress={() => {
                                                if (isActive) {
                                                    setSelectedSports((prev) => prev.filter((x) => x !== s));
                                                } else if (selectedSports.length < MAX_SPORTS) {
                                                    setSelectedSports((prev) => [...prev, s]);
                                                }
                                                setFormErrors((p) => ({ ...p, sports: '' }));
                                            }}
                                            disabled={isDisabled}
                                        >
                                            <Text style={[styles.sportChipText, isActive && styles.sportChipTextActive, isDisabled && styles.sportChipTextDisabled]}>
                                                {capitalize(s)}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                            {formErrors.sports ? (
                                <Text style={styles.fieldError}>{formErrors.sports}</Text>
                            ) : null}

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
                                <View style={{ flex: 1 }}>
                                    <Button
                                        title="Cancel"
                                        onPress={resetForm}
                                        variant="secondary"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Button
                                        title={editingId ? 'Update Member' : 'Add Member'}
                                        onPress={handleSave}
                                        variant="primary"
                                        loading={isSaving}
                                        disabled={!firstName.trim() || !lastName.trim() || isSaving}
                                    />
                                </View>
                            </View>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
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
        marginBottom: Spacing.lg,
        borderColor: Colors.error + '33',
        backgroundColor: Colors.errorMuted,
    },
    errorBannerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    errorBannerText: {
        flex: 1,
        fontSize: FontSize.sm,
        fontWeight: FontWeight.bold,
        color: Colors.error,
    },

    // Feature hints
    featureHints: {
        gap: Spacing.sm,
        marginTop: Spacing.xl,
    },
    featureHintCard: {
        // card handles padding
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
        ...Shadows.small,
    },
    accountCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        marginBottom: Spacing.md,
    },
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
        marginBottom: Spacing.xs,
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
        backgroundColor: Colors.errorMuted,
        borderWidth: 1,
        borderColor: Colors.error + '33',
    },
    removeBtnText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.error,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Colors.overlay,
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
        borderColor: Colors.error + '88',
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
        backgroundColor: Colors.primaryMuted,
        borderColor: Colors.borderActive,
    },
    sportChipDisabled: {
        opacity: 0.35,
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
    sportChipTextDisabled: {
        color: Colors.textMuted,
    },
    sportLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.xs,
    },
    sportCount: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        fontWeight: FontWeight.medium,
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
        backgroundColor: Colors.errorMuted,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.error + '33',
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
});

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
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

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
    created_at: string;
};

type FormState = {
    title: string;
    description: string;
    price: string;
    sport: string;
    duration_minutes: string;
};

const EMPTY_FORM: FormState = {
    title: '',
    description: '',
    price: '',
    sport: '',
    duration_minutes: '60',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function TrainingOffersScreen({ navigation }: any) {
    const { user } = useAuth();
    const trainerProfile = user?.trainerProfile;

    const [offers, setOffers] = useState<TrainingOffer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [formErrors, setFormErrors] = useState<Partial<FormState>>({});

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
            setOffers((data || []) as TrainingOffer[]);
        } catch (err: any) {
            console.error('TrainingOffersScreen fetchOffers:', err);
            Alert.alert('Error', 'Could not load training offers.');
        } finally {
            setIsLoading(false);
        }
    }, [trainerProfile?.id]);

    useEffect(() => {
        fetchOffers();
    }, [fetchOffers]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchOffers();
        setRefreshing(false);
    };

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
            const { error } = await supabase.from('training_offers').insert({
                trainer_id: trainerProfile.id,
                title: form.title.trim(),
                description: form.description.trim() || null,
                price: parseFloat(form.price),
                sport: form.sport.trim() || null,
                duration_minutes: parseInt(form.duration_minutes, 10),
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

            {/* List */}
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
                    <View style={[styles.metaChip, { marginLeft: 'auto' }]}>
                        <View style={[styles.activeDot, { backgroundColor: offer.is_active ? Colors.success : Colors.textTertiary }]} />
                        <Text style={[styles.metaChipText, { color: offer.is_active ? Colors.success : Colors.textTertiary }]}>
                            {offer.is_active ? 'Active' : 'Inactive'}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
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
        paddingTop: 60,
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

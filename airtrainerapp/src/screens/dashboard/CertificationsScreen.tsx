import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';

type Certification = {
    name: string;
    issuer?: string;
    year?: number;
};

export default function CertificationsScreen({ navigation }: any) {
    const { user, refreshUser } = useAuth();

    // Normalise certs from trainerProfile
    const rawCerts = (user?.trainerProfile?.certifications as any[]) || [];
    const certs: Certification[] = rawCerts.map((c: any) =>
        typeof c === 'string' ? { name: c } : c,
    );

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [certName, setCertName] = useState('');
    const [certIssuer, setCertIssuer] = useState('');
    const [certYear, setCertYear] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [nameError, setNameError] = useState('');

    const openModal = () => {
        setCertName('');
        setCertIssuer('');
        setCertYear('');
        setNameError('');
        setModalVisible(true);
    };

    const closeModal = () => {
        setModalVisible(false);
    };

    const handleAddCert = async () => {
        if (!certName.trim()) {
            setNameError('Certification name is required.');
            return;
        }
        setNameError('');

        if (!user?.trainerProfile) {
            Alert.alert('Error', 'Trainer profile not found.');
            return;
        }

        setIsSaving(true);
        try {
            const newCert: Certification = { name: certName.trim() };
            if (certIssuer.trim()) newCert.issuer = certIssuer.trim();
            const parsedYear = parseInt(certYear, 10);
            if (!isNaN(parsedYear) && parsedYear > 1900 && parsedYear <= new Date().getFullYear()) {
                newCert.year = parsedYear;
            }

            const updatedCerts = [...certs, newCert];

            const { error } = await supabase
                .from('trainer_profiles')
                .update({ certifications: updatedCerts })
                .eq('user_id', user.id);

            if (error) throw error;

            await refreshUser();
            closeModal();
        } catch (err: any) {
            console.error('Error saving certification:', err);
            Alert.alert('Error', err.message || 'Failed to save certification.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveCert = (index: number) => {
        const cert = certs[index];
        Alert.alert(
            'Remove Certification',
            `Remove "${cert.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        if (!user?.trainerProfile) return;
                        try {
                            const updatedCerts = certs.filter((_, i) => i !== index);
                            const { error } = await supabase
                                .from('trainer_profiles')
                                .update({ certifications: updatedCerts })
                                .eq('user_id', user.id);
                            if (error) throw error;
                            await refreshUser();
                        } catch (err: any) {
                            console.error('Error removing certification:', err);
                            Alert.alert('Error', err.message || 'Failed to remove certification.');
                        }
                    },
                },
            ],
        );
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="arrow-back" size={22} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Certifications</Text>
                <TouchableOpacity
                    onPress={openModal}
                    style={styles.addButton}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="add" size={24} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* Info banner */}
                <View style={styles.infoCard}>
                    <Ionicons name="ribbon-outline" size={22} color={Colors.primary} />
                    <Text style={styles.infoText}>
                        Add your coaching certifications to build trust with athletes. Verified
                        trainers get more bookings!
                    </Text>
                </View>

                {/* Cert count */}
                {certs.length > 0 && (
                    <View style={styles.sectionHeadingRow}>
                        <Text style={styles.sectionHeading}>Your Certifications</Text>
                        <Text style={styles.sectionCount}>
                            {certs.length} cert{certs.length !== 1 ? 's' : ''}
                        </Text>
                    </View>
                )}

                {/* Cert list */}
                {certs.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconWrap}>
                            <Ionicons
                                name="document-text-outline"
                                size={40}
                                color={Colors.primary}
                            />
                        </View>
                        <Text style={styles.emptyTitle}>No certifications added yet</Text>
                        <Text style={styles.emptyText}>
                            Tap the + button in the top right to add your first certification.
                        </Text>
                        <TouchableOpacity style={styles.emptyAddButton} onPress={openModal}>
                            <Ionicons name="add" size={18} color={Colors.background} />
                            <Text style={styles.emptyAddButtonText}>Add Certification</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    certs.map((cert, i) => (
                        <TouchableOpacity
                            key={i}
                            style={styles.certCard}
                            onLongPress={() => handleRemoveCert(i)}
                            activeOpacity={0.85}
                            delayLongPress={500}
                        >
                            <View style={styles.certIconWrap}>
                                <Ionicons name="ribbon" size={22} color={Colors.primary} />
                            </View>
                            <View style={styles.certInfo}>
                                <Text style={styles.certName}>{cert.name}</Text>
                                {cert.issuer ? (
                                    <Text style={styles.certIssuer}>{cert.issuer}</Text>
                                ) : null}
                            </View>
                            <View style={styles.certRight}>
                                {cert.year ? (
                                    <View style={styles.yearBadge}>
                                        <Text style={styles.yearBadgeText}>{cert.year}</Text>
                                    </View>
                                ) : null}
                                <Ionicons
                                    name="ellipsis-vertical"
                                    size={16}
                                    color={Colors.textTertiary}
                                />
                            </View>
                        </TouchableOpacity>
                    ))
                )}

                {certs.length > 0 && (
                    <Text style={styles.longPressHint}>
                        Long press a certification to remove it
                    </Text>
                )}

                <View style={{ height: 60 }} />
            </ScrollView>

            {/* Add Certification Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent
                onRequestClose={closeModal}
            >
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.modalKeyboardView}
                    >
                        <View style={styles.modalSheet}>
                            {/* Modal handle */}
                            <View style={styles.modalHandle} />

                            {/* Modal header */}
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Add Certification</Text>
                                <TouchableOpacity
                                    onPress={closeModal}
                                    style={styles.modalCloseButton}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Ionicons name="close" size={20} color={Colors.textSecondary} />
                                </TouchableOpacity>
                            </View>

                            {/* Name field */}
                            <View style={styles.fieldGroup}>
                                <Text style={styles.fieldLabel}>
                                    Certification Name{' '}
                                    <Text style={styles.required}>*</Text>
                                </Text>
                                <TextInput
                                    style={[
                                        styles.input,
                                        nameError ? styles.inputError : null,
                                    ]}
                                    placeholder="e.g. NASM Personal Trainer"
                                    placeholderTextColor={Colors.textTertiary}
                                    value={certName}
                                    onChangeText={(t) => {
                                        setCertName(t);
                                        if (nameError) setNameError('');
                                    }}
                                    autoFocus
                                    returnKeyType="next"
                                />
                                {nameError ? (
                                    <Text style={styles.errorText}>{nameError}</Text>
                                ) : null}
                            </View>

                            {/* Issuer field */}
                            <View style={styles.fieldGroup}>
                                <Text style={styles.fieldLabel}>Issuing Organization</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. National Academy of Sports Medicine"
                                    placeholderTextColor={Colors.textTertiary}
                                    value={certIssuer}
                                    onChangeText={setCertIssuer}
                                    returnKeyType="next"
                                />
                            </View>

                            {/* Year field */}
                            <View style={styles.fieldGroup}>
                                <Text style={styles.fieldLabel}>Year Obtained</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. 2022"
                                    placeholderTextColor={Colors.textTertiary}
                                    value={certYear}
                                    onChangeText={setCertYear}
                                    keyboardType="number-pad"
                                    maxLength={4}
                                    returnKeyType="done"
                                    onSubmitEditing={handleAddCert}
                                />
                            </View>

                            {/* Save button */}
                            <TouchableOpacity
                                style={[styles.modalSaveButton, isSaving && styles.saveDisabled]}
                                onPress={handleAddCert}
                                disabled={isSaving}
                                activeOpacity={0.85}
                            >
                                {isSaving ? (
                                    <ActivityIndicator size="small" color={Colors.background} />
                                ) : (
                                    <>
                                        <Ionicons
                                            name="checkmark-circle-outline"
                                            size={20}
                                            color={Colors.background}
                                        />
                                        <Text style={styles.modalSaveButtonText}>
                                            Add Certification
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={closeModal}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
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
    addButton: {
        width: 44,
        height: 44,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primaryGlow,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.borderActive,
    },

    contentContainer: {
        padding: Spacing.xxl,
    },

    // Info banner
    infoCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.md,
        padding: Spacing.lg,
        backgroundColor: Colors.primaryGlow,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.borderActive,
        marginBottom: Spacing.xl,
    },
    infoText: {
        flex: 1,
        fontSize: FontSize.sm,
        color: Colors.primary,
        lineHeight: 20,
    },

    // Section heading
    sectionHeadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    sectionHeading: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    sectionCount: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
    },

    // Cert card
    certCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    certIconWrap: {
        width: 46,
        height: 46,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primaryGlow,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.borderActive,
    },
    certInfo: {
        flex: 1,
        gap: 3,
    },
    certName: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    certIssuer: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
    },
    certRight: {
        alignItems: 'flex-end',
        gap: Spacing.xs,
    },
    yearBadge: {
        backgroundColor: Colors.primaryGlow,
        borderRadius: BorderRadius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor: Colors.borderActive,
    },
    yearBadgeText: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.bold,
        color: Colors.primary,
    },
    longPressHint: {
        textAlign: 'center',
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        marginTop: Spacing.md,
    },

    // Empty state
    emptyState: {
        alignItems: 'center',
        paddingTop: 40,
        gap: Spacing.md,
    },
    emptyIconWrap: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.primaryGlow,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.sm,
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
        lineHeight: 22,
        paddingHorizontal: Spacing.xxl,
    },
    emptyAddButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginTop: Spacing.md,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.xxl,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.pill,
    },
    emptyAddButtonText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.background,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: Colors.overlay,
        justifyContent: 'flex-end',
    },
    modalKeyboardView: {
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: Colors.card,
        borderTopLeftRadius: BorderRadius.xxl,
        borderTopRightRadius: BorderRadius.xxl,
        padding: Spacing.xxl,
        paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xxl,
        borderTopWidth: 1,
        borderColor: Colors.border,
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
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.xl,
    },
    modalTitle: {
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    modalCloseButton: {
        width: 32,
        height: 32,
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Form fields
    fieldGroup: {
        marginBottom: Spacing.lg,
    },
    fieldLabel: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.textSecondary,
        marginBottom: Spacing.sm,
    },
    required: {
        color: Colors.error,
    },
    input: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        fontSize: FontSize.md,
        color: Colors.text,
    },
    inputError: {
        borderColor: Colors.error,
    },
    errorText: {
        fontSize: FontSize.xs,
        color: Colors.error,
        marginTop: 4,
    },

    // Modal buttons
    modalSaveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.lg,
        paddingVertical: Spacing.lg,
        marginTop: Spacing.sm,
    },
    saveDisabled: {
        opacity: 0.6,
    },
    modalSaveButtonText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.background,
    },
    modalCancelButton: {
        alignItems: 'center',
        paddingVertical: Spacing.lg,
        marginTop: Spacing.xs,
    },
    modalCancelText: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        fontWeight: FontWeight.medium,
    },
});

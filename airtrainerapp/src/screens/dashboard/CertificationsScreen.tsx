import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Modal,
    TextInput,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';
import { ScreenWrapper, ScreenHeader, Card, Badge, EmptyState, Button, Input } from '../../components/ui';

type Certification = {
    name: string;
    issuer?: string;
    year?: number;
};

export default function CertificationsScreen({ navigation }: any) {
    const { user, refreshUser } = useAuth();

    const rawCerts = (user?.trainerProfile?.certifications as any[]) || [];
    const certs: Certification[] = rawCerts.map((c: any) =>
        typeof c === 'string' ? { name: c } : c,
    );

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
        <ScreenWrapper>
            <ScreenHeader
                title="Certifications"
                onBack={() => navigation.goBack()}
                rightAction={{ icon: 'add', onPress: openModal }}
            />

            {/* Info banner */}
            <Animated.View entering={FadeInDown.duration(250)}>
            <Card variant="outlined" style={styles.infoCard}>
                <View style={styles.infoRow}>
                    <Ionicons name="ribbon-outline" size={22} color={Colors.primary} />
                    <Text style={styles.infoText}>
                        Add your coaching certifications to build trust with athletes. Verified
                        trainers get more bookings!
                    </Text>
                </View>
            </Card>
            </Animated.View>

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
                <EmptyState
                    icon="document-text-outline"
                    title="No certifications added yet"
                    description="Tap the + button in the top right to add your first certification."
                    actionLabel="Add Certification"
                    onAction={openModal}
                />
            ) : (
                certs.map((cert, i) => (
                    <Animated.View key={i} entering={FadeInDown.duration(200).delay(i * 100)}>
                        <Pressable
                            delayLongPress={500}
                            onLongPress={() => handleRemoveCert(i)}
                            accessibilityLabel={`Certification: ${cert.name}`}
                            style={({ pressed }) => [pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                        >
                            <Card style={styles.certCard}>
                                <View style={styles.certRow}>
                                    <View style={styles.certIconWrap}>
                                        <Ionicons name="document-text" size={22} color={Colors.primary} />
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
                                </View>
                            </Card>
                        </Pressable>
                    </Animated.View>
                ))
            )}

            {certs.length > 0 && (
                <Text style={styles.longPressHint}>
                    Long press a certification to remove it
                </Text>
            )}

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
                            <View style={styles.modalHandle} />

                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Add Certification</Text>
                                <Pressable
                                    onPress={closeModal}
                                    style={({ pressed }) => [styles.modalCloseButton, pressed && { opacity: 0.7 }]}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    accessibilityLabel="Close"
                                >
                                    <Ionicons name="close" size={20} color={Colors.textSecondary} />
                                </Pressable>
                            </View>

                            <Input
                                label="Certification Name *"
                                placeholder="e.g. NASM Personal Trainer"
                                value={certName}
                                onChangeText={(t: string) => {
                                    setCertName(t);
                                    if (nameError) setNameError('');
                                }}
                                error={nameError}
                                autoFocus
                            />

                            <Input
                                label="Issuing Organization"
                                placeholder="e.g. National Academy of Sports Medicine"
                                value={certIssuer}
                                onChangeText={setCertIssuer}
                            />

                            <Input
                                label="Year Obtained"
                                placeholder="e.g. 2022"
                                value={certYear}
                                onChangeText={setCertYear}
                                keyboardType="number-pad"
                                maxLength={4}
                            />

                            <Button
                                title="Add Certification"
                                onPress={handleAddCert}
                                variant="primary"
                                icon="checkmark-circle-outline"
                                loading={isSaving}
                                disabled={isSaving}
                            />

                            <Button
                                title="Cancel"
                                onPress={closeModal}
                                variant="ghost"
                                style={{ marginTop: Spacing.xs }}
                            />
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    infoCard: {
        marginBottom: Spacing.xl,
        borderColor: Colors.borderActive,
        backgroundColor: Colors.primaryMuted,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.md,
    },
    infoText: {
        flex: 1,
        fontSize: FontSize.sm,
        color: Colors.primary,
        lineHeight: 20,
    },
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
    certCard: {
        marginBottom: Spacing.sm,
    },
    certRow: {
        flexDirection: 'row',
        alignItems: 'center',
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
        borderRadius: BorderRadius.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
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
});

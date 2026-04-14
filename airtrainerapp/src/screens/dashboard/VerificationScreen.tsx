import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Alert,
    ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { TrainerProfileRow } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';
import { ScreenWrapper, ScreenHeader, Card, Badge, LoadingScreen, Button } from '../../components/ui';

type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended' | null;

type VerificationDocument = {
    name: string;
    url: string;
    uploadedAt: string;
};

type ChecklistItem = {
    id: string;
    label: string;
    description: string;
    done: boolean;
    icon: keyof typeof Ionicons.glyphMap;
};

function buildChecklist(profile: TrainerProfileRow | null | undefined): ChecklistItem[] {
    const certs = Array.isArray(profile?.certifications)
        ? profile!.certifications
        : profile?.certifications
        ? Object.keys(profile.certifications as object)
        : [];

    return [
        {
            id: 'profile',
            label: 'Profile Created',
            description: 'Your account is set up and ready.',
            done: true,
            icon: 'person-circle-outline',
        },
        {
            id: 'bio',
            label: 'Bio & Headline',
            description: 'Tell athletes about yourself.',
            done: !!(profile?.bio && profile.bio.trim().length > 0),
            icon: 'document-text-outline',
        },
        {
            id: 'sports',
            label: 'Sports Selected',
            description: 'Select the sports you train.',
            done: !!(profile?.sports && profile.sports.length > 0),
            icon: 'trophy-outline',
        },
        {
            id: 'location',
            label: 'Location Set',
            description: 'Let athletes find you nearby.',
            done: !!(profile?.city && profile.city.trim().length > 0),
            icon: 'location-outline',
        },
        {
            id: 'certifications',
            label: 'Certifications Added',
            description: 'Show your credentials.',
            done: certs.length > 0,
            icon: 'ribbon-outline',
        },
        {
            id: 'submit',
            label: 'Submit for Review',
            description: 'Our team will review your profile.',
            done: false,
            icon: 'paper-plane-outline',
        },
    ];
}

function StatusBanner({ status }: { status: VerificationStatus }) {
    if (!status) return null;

    const config = {
        pending: {
            bg: Colors.warningMuted,
            border: Colors.warning + '55',
            text: Colors.warning,
            icon: 'time-outline' as keyof typeof Ionicons.glyphMap,
            label: 'Pending Review',
            subtitle: "Your profile is under review. We'll notify you within 2-3 business days.",
        },
        verified: {
            bg: Colors.successMuted,
            border: Colors.success + '55',
            text: Colors.success,
            icon: 'shield-checkmark-outline' as keyof typeof Ionicons.glyphMap,
            label: 'Verified Trainer',
            subtitle: "You're officially verified. Your badge is now visible to athletes.",
        },
        rejected: {
            bg: Colors.errorMuted,
            border: Colors.error + '55',
            text: Colors.error,
            icon: 'close-circle-outline' as keyof typeof Ionicons.glyphMap,
            label: 'Verification Rejected',
            subtitle: 'Your application was not approved. Please update your profile and resubmit.',
        },
        suspended: {
            bg: Colors.errorMuted,
            border: Colors.error + '55',
            text: Colors.error,
            icon: 'ban-outline' as keyof typeof Ionicons.glyphMap,
            label: 'Account Suspended',
            subtitle: 'Your account has been suspended. Please contact support.',
        },
    };

    const c = config[status] || config.pending;

    return (
        <View style={[styles.statusBanner, { backgroundColor: c.bg, borderColor: c.border }]}>
            <Ionicons name={c.icon} size={22} color={c.text} />
            <View style={styles.statusBannerText}>
                <Text style={[styles.statusBannerLabel, { color: c.text }]}>{c.label}</Text>
                <Text style={styles.statusBannerSubtitle}>{c.subtitle}</Text>
            </View>
        </View>
    );
}

function ChecklistRow({ item, isLast, index }: { item: ChecklistItem; isLast: boolean; index: number }) {
    return (
        <Animated.View entering={FadeInDown.duration(200).delay(index * 30)}>
            <View style={styles.checklistRow}>
                {/* Step circle with connecting line */}
                <View style={styles.checkStepColumn}>
                    <View style={[styles.checkIcon, item.done ? styles.checkIconDone : styles.checkIconPending]}>
                        {item.done ? (
                            <Ionicons name="checkmark" size={14} color={Colors.background} />
                        ) : (
                            <View style={styles.checkCircleInner} />
                        )}
                    </View>
                    {!isLast && (
                        <View style={[styles.connectingLine, item.done && styles.connectingLineDone]} />
                    )}
                </View>
                <View style={styles.checklistContent}>
                    <Text style={[styles.checklistLabel, item.done && styles.checklistLabelDone]}>
                        {item.label}
                    </Text>
                    <Text style={styles.checklistDesc}>{item.description}</Text>
                </View>
                <Ionicons
                    name={item.done ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={item.done ? Colors.primary : Colors.textMuted}
                />
            </View>
        </Animated.View>
    );
}

export default function VerificationScreen({ navigation }: any) {
    const { user } = useAuth();
    const [profile, setProfile] = useState<TrainerProfileRow | null>(
        user?.trainerProfile ?? null
    );
    const [isLoading, setIsLoading] = useState(!user?.trainerProfile);
    const [refreshing, setRefreshing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [documents, setDocuments] = useState<VerificationDocument[]>([]);
    const [uploading, setUploading] = useState(false);

    const fetchProfile = useCallback(async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase
                .from('trainer_profiles')
                .select('*')
                .eq('user_id', user.id)
                .single();
            if (error) throw error;
            setProfile(data as TrainerProfileRow);
            setDocuments((data as any)?.verification_documents || []);
        } catch (err) {
            console.error('Error fetching trainer profile:', err);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!profile) {
            fetchProfile();
        }
    }, [fetchProfile, profile]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchProfile();
        setRefreshing(false);
    };

    const handleSubmitVerification = async () => {
        if (!user || !profile) return;

        Alert.alert(
            'Submit for Verification',
            'Are you ready to submit your profile for review? Make sure all steps are complete.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Submit',
                    onPress: async () => {
                        setIsSubmitting(true);
                        try {
                            const { error } = await supabase
                                .from('trainer_profiles')
                                .update({ verification_status: 'pending' })
                                .eq('user_id', user.id);
                            if (error) throw error;
                            setProfile((prev) =>
                                prev ? { ...prev, verification_status: 'pending' } : prev
                            );
                            Alert.alert(
                                'Submitted!',
                                'Your profile has been submitted for verification. We\'ll review it within 2-3 business days.',
                                [{ text: 'OK' }]
                            );
                        } catch (err: any) {
                            Alert.alert('Error', err.message || 'Failed to submit verification');
                        } finally {
                            setIsSubmitting(false);
                        }
                    },
                },
            ]
        );
    };

    const handleUploadDocument = async () => {
        if (!user) return;
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'image/*'],
                copyToCacheDirectory: true,
            });

            if (result.canceled) return;

            setUploading(true);
            const file = result.assets[0];
            const fileName = `verification/${user.id}/${Date.now()}_${file.name}`;

            const response = await fetch(file.uri);
            const blob = await response.blob();

            const { error: uploadError } = await supabase.storage
                .from('verification-docs')
                .upload(fileName, blob, {
                    contentType: file.mimeType || 'application/pdf',
                    upsert: false,
                });

            if (uploadError) {
                Alert.alert('Upload Failed', uploadError.message);
                setUploading(false);
                return;
            }

            const {
                data: { publicUrl },
            } = supabase.storage.from('verification-docs').getPublicUrl(fileName);

            const currentDocs = documents || [];
            const newDoc: VerificationDocument = {
                name: file.name,
                url: publicUrl,
                uploadedAt: new Date().toISOString(),
            };
            const updatedDocs = [...currentDocs, newDoc];

            await supabase
                .from('trainer_profiles')
                .update({ verification_documents: updatedDocs })
                .eq('user_id', user.id);

            setDocuments(updatedDocs);
            Alert.alert('Uploaded', 'Document uploaded successfully.');
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to upload document.');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteDocument = async (index: number) => {
        if (!user) return;
        Alert.alert('Delete Document', 'Remove this document?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    const updatedDocs = documents.filter((_, i) => i !== index);
                    await supabase
                        .from('trainer_profiles')
                        .update({ verification_documents: updatedDocs })
                        .eq('user_id', user.id);
                    setDocuments(updatedDocs);
                },
            },
        ]);
    };

    if (isLoading) {
        return <LoadingScreen message="Loading verification..." />;
    }

    const status = profile?.verification_status ?? null;
    const isVerified = status === 'verified';
    const checklist = buildChecklist(profile);

    if (status === 'pending' || status === 'verified') {
        const submitItem = checklist.find((i) => i.id === 'submit');
        if (submitItem) submitItem.done = true;
    }

    const completedCount = checklist.filter((i) => i.done).length;
    const totalCount = checklist.length;
    const progressPercent = (completedCount / totalCount) * 100;

    const prereqsDone = checklist
        .filter((i) => i.id !== 'submit')
        .every((i) => i.done);

    const hasDocuments = documents.length > 0;
    const canSubmit =
        prereqsDone && hasDocuments && (status === null || status === 'rejected') && !isSubmitting;

    return (
        <ScreenWrapper refreshing={refreshing} onRefresh={onRefresh}>
            <ScreenHeader
                title="Verification"
                onBack={() => navigation.goBack()}
            />

            {/* Verified state */}
            {isVerified && (
                <View style={styles.verifiedHero}>
                    <View style={styles.verifiedIconRing}>
                        <View style={styles.verifiedIconInner}>
                            <Ionicons name="checkmark" size={42} color={Colors.background} />
                        </View>
                    </View>
                    <Text style={styles.verifiedTitle}>You're a Verified Trainer!</Text>
                    <Text style={styles.verifiedSubtitle}>
                        Your verified badge is now visible to all athletes searching for trainers. Keep your profile up to date to maintain your status.
                    </Text>
                    <Badge
                        label="Verified Trainer"
                        color={Colors.success}
                        bgColor={Colors.successLight}
                        size="md"
                        dot
                    />
                </View>
            )}

            {/* Status Banner */}
            <StatusBanner status={status} />

            {/* Progress Card */}
            {!isVerified && (
                <Card style={styles.progressCard}>
                    <View style={styles.progressHeader}>
                        <Text style={styles.progressTitle}>Profile Completion</Text>
                        <Text style={styles.progressFraction}>
                            {completedCount}/{totalCount}
                        </Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                    </View>
                    <Text style={styles.progressPercent}>
                        {Math.round(progressPercent)}% complete
                    </Text>
                </Card>
            )}

            {/* Checklist */}
            <Card style={styles.checklistCard}>
                <Text style={styles.checklistTitle}>Verification Steps</Text>
                {checklist.map((item, index) => (
                    <ChecklistRow
                        key={item.id}
                        item={item}
                        isLast={index === checklist.length - 1}
                        index={index}
                    />
                ))}
            </Card>

            {/* Verification Documents */}
            <Card style={styles.documentsCard}>
                <Text style={styles.documentsTitle}>Verification Documents</Text>
                <Text style={styles.documentsSubtitle}>
                    Upload certificates, IDs, or other supporting documents (PDF or images).
                </Text>

                {documents.length > 0 && (
                    <View style={styles.documentsList}>
                        {documents.map((doc, index) => (
                            <View key={`${doc.name}-${index}`} style={styles.documentRow}>
                                <Ionicons name="document-outline" size={20} color={Colors.primary} />
                                <View style={styles.documentInfo}>
                                    <Text style={styles.documentName} numberOfLines={1} ellipsizeMode="middle">
                                        {doc.name}
                                    </Text>
                                    <Text style={styles.documentDate}>
                                        {new Date(doc.uploadedAt).toLocaleDateString()}
                                    </Text>
                                </View>
                                <Pressable
                                    onPress={() => handleDeleteDocument(index)}
                                    style={({ pressed }) => [styles.documentDeleteButton, pressed && { opacity: 0.7 }]}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    accessibilityLabel="Delete document"
                                >
                                    <Ionicons name="close-circle" size={20} color={Colors.error} />
                                </Pressable>
                            </View>
                        ))}
                    </View>
                )}

                <Pressable
                    style={({ pressed }) => [styles.uploadButton, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
                    onPress={handleUploadDocument}
                    disabled={uploading}
                    accessibilityLabel="Upload document"
                >
                    {uploading ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                        <>
                            <Ionicons name="cloud-upload-outline" size={22} color={Colors.primary} />
                            <Text style={styles.uploadButtonText}>Upload Document</Text>
                        </>
                    )}
                </Pressable>
            </Card>

            {/* Submit Button */}
            {!isVerified && (
                <Button
                    title={
                        status === 'pending'
                            ? 'Verification Submitted'
                            : status === 'rejected'
                            ? 'Resubmit for Verification'
                            : 'Submit for Verification'
                    }
                    onPress={handleSubmitVerification}
                    variant="primary"
                    icon="paper-plane-outline"
                    loading={isSubmitting}
                    disabled={!canSubmit}
                />
            )}

            {!canSubmit && !isVerified && status !== 'pending' && !isSubmitting && (
                <Text style={styles.submitHint}>
                    {!prereqsDone
                        ? 'Complete all steps above before submitting.'
                        : !hasDocuments
                        ? 'Upload at least one verification document before submitting.'
                        : 'Complete all steps above before submitting.'}
                </Text>
            )}
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    // Verified Hero
    verifiedHero: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
        gap: Spacing.md,
        marginBottom: Spacing.lg,
    },
    verifiedIconRing: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: Colors.successMuted,
        borderWidth: 2,
        borderColor: Colors.success + '66',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    verifiedIconInner: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: Colors.success,
        justifyContent: 'center',
        alignItems: 'center',
    },
    verifiedTitle: {
        fontSize: FontSize.xxl,
        fontWeight: FontWeight.heavy,
        color: Colors.text,
        textAlign: 'center',
    },
    verifiedSubtitle: {
        fontSize: FontSize.md,
        color: Colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        paddingHorizontal: Spacing.md,
    },

    // Status Banner
    statusBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.md,
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        marginBottom: Spacing.lg,
    },
    statusBannerText: {
        flex: 1,
        gap: Spacing.xs,
    },
    statusBannerLabel: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
    },
    statusBannerSubtitle: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 18,
    },

    // Progress Card
    progressCard: {
        marginBottom: Spacing.lg,
        gap: Spacing.sm,
        ...Shadows.small,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    progressTitle: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.text,
    },
    progressFraction: {
        fontSize: FontSize.sm,
        color: Colors.textSecondary,
        fontWeight: FontWeight.medium,
    },
    progressBarTrack: {
        height: 6,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.pill,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.pill,
    },
    progressPercent: {
        fontSize: FontSize.sm,
        color: Colors.primary,
        fontWeight: FontWeight.medium,
    },

    // Checklist Card
    checklistCard: {
        marginBottom: Spacing.lg,
        ...Shadows.small,
    },
    checklistTitle: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.text,
        marginBottom: Spacing.lg,
    },
    checklistRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    checkStepColumn: {
        alignItems: 'center',
    },
    connectingLine: {
        width: 2,
        flex: 1,
        minHeight: 20,
        backgroundColor: Colors.border,
        marginTop: Spacing.xs,
    },
    connectingLineDone: {
        backgroundColor: Colors.primary,
    },
    checkIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkIconDone: {
        backgroundColor: Colors.primary,
    },
    checkIconPending: {
        backgroundColor: Colors.surface,
        borderWidth: 2,
        borderColor: Colors.border,
    },
    checkCircleInner: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.textMuted,
    },
    checklistContent: {
        flex: 1,
        gap: 2,
    },
    checklistLabel: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.medium,
        color: Colors.textSecondary,
    },
    checklistLabelDone: {
        color: Colors.text,
        fontWeight: FontWeight.semibold,
    },
    checklistDesc: {
        fontSize: FontSize.xs,
        color: Colors.textMuted,
    },

    // Documents Section
    documentsCard: {
        marginBottom: Spacing.lg,
        gap: Spacing.sm,
        ...Shadows.small,
    },
    documentsTitle: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        color: Colors.text,
    },
    documentsSubtitle: {
        fontSize: FontSize.sm,
        color: Colors.textMuted,
        lineHeight: 18,
        marginBottom: Spacing.xs,
    },
    documentsList: {
        gap: Spacing.sm,
    },
    documentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        backgroundColor: Colors.surface,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    documentInfo: {
        flex: 1,
        gap: 2,
    },
    documentName: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.medium,
        color: Colors.text,
    },
    documentDate: {
        fontSize: FontSize.xs,
        color: Colors.textMuted,
    },
    documentDeleteButton: {
        padding: Spacing.xs,
    },
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.lg,
        borderRadius: BorderRadius.md,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: Colors.borderLight,
        backgroundColor: Colors.glass,
        marginTop: Spacing.xs,
    },
    uploadButtonText: {
        fontSize: FontSize.md,
        fontWeight: FontWeight.semibold,
        color: Colors.primary,
    },

    // Submit hint
    submitHint: {
        fontSize: FontSize.sm,
        color: Colors.textMuted,
        textAlign: 'center',
        marginTop: Spacing.sm,
    },
});

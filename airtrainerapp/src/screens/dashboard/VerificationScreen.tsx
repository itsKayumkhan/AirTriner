import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { TrainerProfileRow } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

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
            done: false, // controlled by status
            icon: 'paper-plane-outline',
        },
    ];
}

function StatusBanner({ status }: { status: VerificationStatus }) {
    if (!status) return null;

    const config = {
        pending: {
            bg: 'rgba(255,171,0,0.12)',
            border: 'rgba(255,171,0,0.35)',
            text: Colors.warning,
            icon: 'time-outline' as keyof typeof Ionicons.glyphMap,
            label: 'Pending Review',
            subtitle: "Your profile is under review. We'll notify you within 2-3 business days.",
        },
        verified: {
            bg: 'rgba(0,200,83,0.12)',
            border: 'rgba(0,200,83,0.35)',
            text: Colors.success,
            icon: 'shield-checkmark-outline' as keyof typeof Ionicons.glyphMap,
            label: 'Verified Trainer',
            subtitle: "You're officially verified. Your badge is now visible to athletes.",
        },
        rejected: {
            bg: Colors.errorLight,
            border: 'rgba(255,23,68,0.35)',
            text: Colors.error,
            icon: 'close-circle-outline' as keyof typeof Ionicons.glyphMap,
            label: 'Verification Rejected',
            subtitle: 'Your application was not approved. Please update your profile and resubmit.',
        },
        suspended: {
            bg: Colors.errorLight,
            border: 'rgba(255,23,68,0.35)',
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

function ChecklistRow({ item, isLast }: { item: ChecklistItem; isLast: boolean }) {
    return (
        <View style={[styles.checklistRow, !isLast && styles.checklistRowBorder]}>
            <View style={[styles.checkIcon, item.done ? styles.checkIconDone : styles.checkIconPending]}>
                {item.done ? (
                    <Ionicons name="checkmark" size={14} color={Colors.background} />
                ) : (
                    <View style={styles.checkCircleInner} />
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
                                'Your profile has been submitted for verification. We\'ll review it within 2–3 business days.',
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

            // Upload to Supabase Storage
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

            // Add to verification_documents array
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
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    const status = profile?.verification_status ?? null;
    const isVerified = status === 'verified';
    const checklist = buildChecklist(profile);

    // Mark "Submit for Review" as done when status is pending/verified/rejected
    if (status === 'pending' || status === 'verified') {
        const submitItem = checklist.find((i) => i.id === 'submit');
        if (submitItem) submitItem.done = true;
    }

    const completedCount = checklist.filter((i) => i.done).length;
    const totalCount = checklist.length;
    const progressPercent = (completedCount / totalCount) * 100;

    // Prerequisites for submit (all except submit step)
    const prereqsDone = checklist
        .filter((i) => i.id !== 'submit')
        .every((i) => i.done);

    const hasDocuments = documents.length > 0;
    const canSubmit =
        prereqsDone && hasDocuments && (status === null || status === 'rejected') && !isSubmitting;

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={22} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Verification</Text>
                <View style={{ width: 44 }} />
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
                {/* Verified state — big success view */}
                {isVerified ? (
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
                        <View style={styles.verifiedBadge}>
                            <Ionicons name="shield-checkmark" size={16} color={Colors.success} />
                            <Text style={styles.verifiedBadgeText}>Verified Trainer</Text>
                        </View>
                    </View>
                ) : null}

                {/* Status Banner */}
                <StatusBanner status={status} />

                {/* Progress Card */}
                {!isVerified && (
                    <View style={styles.progressCard}>
                        <View style={styles.progressHeader}>
                            <Text style={styles.progressTitle}>Profile Completion</Text>
                            <Text style={styles.progressFraction}>
                                {completedCount}/{totalCount}
                            </Text>
                        </View>
                        <View style={styles.progressBarTrack}>
                            <View
                                style={[styles.progressBarFill, { width: `${progressPercent}%` }]}
                            />
                        </View>
                        <Text style={styles.progressPercent}>
                            {Math.round(progressPercent)}% complete
                        </Text>
                    </View>
                )}

                {/* Checklist */}
                <View style={styles.checklistCard}>
                    <Text style={styles.checklistTitle}>Verification Steps</Text>
                    {checklist.map((item, index) => (
                        <ChecklistRow
                            key={item.id}
                            item={item}
                            isLast={index === checklist.length - 1}
                        />
                    ))}
                </View>

                {/* Verification Documents */}
                <View style={styles.documentsCard}>
                    <Text style={styles.documentsTitle}>Verification Documents</Text>
                    <Text style={styles.documentsSubtitle}>
                        Upload certificates, IDs, or other supporting documents (PDF or images).
                    </Text>

                    {documents.length > 0 && (
                        <View style={styles.documentsList}>
                            {documents.map((doc, index) => (
                                <View key={`${doc.name}-${index}`} style={styles.documentRow}>
                                    <Ionicons
                                        name="document-outline"
                                        size={20}
                                        color={Colors.primary}
                                    />
                                    <View style={styles.documentInfo}>
                                        <Text
                                            style={styles.documentName}
                                            numberOfLines={1}
                                            ellipsizeMode="middle"
                                        >
                                            {doc.name}
                                        </Text>
                                        <Text style={styles.documentDate}>
                                            {new Date(doc.uploadedAt).toLocaleDateString()}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => handleDeleteDocument(index)}
                                        style={styles.documentDeleteButton}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons
                                            name="close-circle"
                                            size={20}
                                            color={Colors.error}
                                        />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}

                    <TouchableOpacity
                        style={styles.uploadButton}
                        onPress={handleUploadDocument}
                        disabled={uploading}
                    >
                        {uploading ? (
                            <ActivityIndicator size="small" color={Colors.primary} />
                        ) : (
                            <>
                                <Ionicons
                                    name="cloud-upload-outline"
                                    size={22}
                                    color={Colors.primary}
                                />
                                <Text style={styles.uploadButtonText}>Upload Document</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Submit Button */}
                {!isVerified && (
                    <TouchableOpacity
                        style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
                        onPress={handleSubmitVerification}
                        disabled={!canSubmit}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color={Colors.background} size="small" />
                        ) : (
                            <>
                                <Ionicons name="paper-plane-outline" size={20} color={Colors.background} />
                                <Text style={styles.submitButtonText}>
                                    {status === 'pending'
                                        ? 'Verification Submitted'
                                        : status === 'rejected'
                                        ? 'Resubmit for Verification'
                                        : 'Submit for Verification'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
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
            </ScrollView>
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

    // Content
    contentContainer: {
        padding: Spacing.xxl,
        gap: Spacing.lg,
        flexGrow: 1,
    },

    // Verified Hero
    verifiedHero: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
        gap: Spacing.md,
    },
    verifiedIconRing: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(0,200,83,0.12)',
        borderWidth: 2,
        borderColor: 'rgba(0,200,83,0.4)',
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
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        backgroundColor: 'rgba(0,200,83,0.12)',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.pill,
        borderWidth: 1,
        borderColor: 'rgba(0,200,83,0.3)',
        marginTop: Spacing.sm,
    },
    verifiedBadgeText: {
        fontSize: FontSize.sm,
        fontWeight: FontWeight.semibold,
        color: Colors.success,
    },

    // Status Banner
    statusBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.md,
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
    },
    statusBannerText: {
        flex: 1,
        gap: 4,
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
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
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
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
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
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.md,
    },
    checklistRowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
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
        backgroundColor: Colors.card,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
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
        padding: 4,
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

    // Submit button
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.primary,
        padding: Spacing.lg,
        borderRadius: BorderRadius.md,
        ...Shadows.glow,
    },
    submitButtonDisabled: {
        opacity: 0.4,
        ...Shadows.small,
    },
    submitButtonText: {
        color: Colors.background,
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
    },
    submitHint: {
        fontSize: FontSize.sm,
        color: Colors.textMuted,
        textAlign: 'center',
        marginTop: -Spacing.sm,
    },
});

import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput,
    KeyboardAvoidingView, Platform, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight, Shadows } from '../../theme';

const MAX_SUB_ACCOUNTS = 6;

type SubAccount = {
    id: string;
    parent_user_id: string;
    profile_data: {
        first_name?: string;
        last_name?: string;
        sport?: string;
        skill_level?: string;
    };
    max_bookings_per_month: number;
    is_active: boolean;
    created_at: string;
};

export default function SubAccountsScreen({ navigation }: any) {
    const { user } = useAuth();
    const [accounts, setAccounts] = useState<SubAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isModalVisible, setModalVisible] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [sport, setSport] = useState('');

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
        } catch (error) {
            console.error('Error fetching sub-accounts:', error);
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

    const handleAddAccount = async () => {
        if (!firstName.trim() || !user) return;
        if (accounts.length >= MAX_SUB_ACCOUNTS) {
            Alert.alert('Limit Reached', `You can only have up to ${MAX_SUB_ACCOUNTS} sub-accounts.`);
            return;
        }

        setIsSaving(true);
        try {
            const { data, error } = await supabase
                .from('sub_accounts')
                .insert({
                    parent_user_id: user.id,
                    profile_data: {
                        first_name: firstName.trim(),
                        last_name: lastName.trim(),
                        sport: sport.trim() || null,
                    },
                })
                .select()
                .single();

            if (error) throw error;

            setAccounts((prev) => [...prev, data as SubAccount]);
            setFirstName('');
            setLastName('');
            setSport('');
            setModalVisible(false);
        } catch (error: any) {
            console.error('Error creating sub-account:', error);
            Alert.alert('Error', error.message || 'Failed to create sub-account');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteAccount = (account: SubAccount) => {
        Alert.alert(
            'Remove Sub-Account',
            `Are you sure you want to remove ${account.profile_data?.first_name || 'this account'}?`,
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
                        } catch (error: any) {
                            Alert.alert('Error', error.message || 'Failed to remove sub-account');
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

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Sub-Accounts</Text>
                <Text style={styles.headerCount}>{accounts.length}/{MAX_SUB_ACCOUNTS}</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            >
                {accounts.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="people-outline" size={64} color={Colors.textTertiary} />
                        <Text style={styles.emptyTitle}>No Sub-Accounts</Text>
                        <Text style={styles.emptyText}>
                            Add sub-accounts for your family members to manage their training. You can add up to {MAX_SUB_ACCOUNTS}.
                        </Text>
                    </View>
                ) : (
                    <View style={styles.listContainer}>
                        {accounts.map((acc) => (
                            <View key={acc.id} style={styles.accountCard}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>
                                        {(acc.profile_data?.first_name?.[0] || '?').toUpperCase()}
                                    </Text>
                                </View>
                                <View style={styles.accountInfo}>
                                    <Text style={styles.accountName}>
                                        {acc.profile_data?.first_name} {acc.profile_data?.last_name}
                                    </Text>
                                    <Text style={styles.accountType}>
                                        {acc.profile_data?.sport || 'Athlete'} {acc.is_active ? '' : '• Inactive'}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.deleteButton}
                                    onPress={() => handleDeleteAccount(acc)}
                                >
                                    <Ionicons name="trash-outline" size={18} color={Colors.error} />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}

                {accounts.length < MAX_SUB_ACCOUNTS && (
                    <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
                        <Ionicons name="add-circle-outline" size={24} color={Colors.text} />
                        <Text style={styles.addButtonText}>Add New Account</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            <Modal visible={isModalVisible} transparent animationType="fade">
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Sub-Account</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeModalButton}>
                                <Ionicons name="close" size={20} color={Colors.textTertiary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.modalLabel}>First Name *</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. John"
                            placeholderTextColor={Colors.textTertiary}
                            value={firstName}
                            onChangeText={setFirstName}
                            autoFocus
                        />

                        <Text style={styles.modalLabel}>Last Name</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. Doe Jr."
                            placeholderTextColor={Colors.textTertiary}
                            value={lastName}
                            onChangeText={setLastName}
                        />

                        <Text style={styles.modalLabel}>Primary Sport</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. Baseball"
                            placeholderTextColor={Colors.textTertiary}
                            value={sport}
                            onChangeText={setSport}
                        />

                        <TouchableOpacity
                            style={[styles.saveButton, (!firstName.trim() || isSaving) && styles.saveButtonDisabled]}
                            onPress={handleAddAccount}
                            disabled={!firstName.trim() || isSaving}
                        >
                            {isSaving ? (
                                <ActivityIndicator color={Colors.text} size="small" />
                            ) : (
                                <Text style={styles.saveButtonText}>Create Account</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    center: { justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xxl, paddingTop: 60, paddingBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
    backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
    headerCount: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
    contentContainer: { padding: Spacing.xxl },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: Spacing.md },
    emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
    emptyText: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', paddingHorizontal: Spacing.xl },
    listContainer: { gap: Spacing.md, marginBottom: Spacing.xl },
    accountCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border },
    avatar: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colors.primaryGlow, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    avatarText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.primary },
    accountInfo: { flex: 1 },
    accountName: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 2 },
    accountType: { fontSize: FontSize.xs, color: Colors.textSecondary },
    deleteButton: { padding: Spacing.sm },
    addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, backgroundColor: Colors.primary, borderRadius: BorderRadius.md, gap: Spacing.sm },
    addButtonText: { fontSize: FontSize.md, fontWeight: FontWeight.semibold, color: Colors.text },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
    modalContent: { width: '100%', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border, ...Shadows.large },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
    modalTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text },
    closeModalButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
    modalLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xs },
    modalInput: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, color: Colors.text, fontSize: FontSize.md, marginBottom: Spacing.lg },
    saveButton: { backgroundColor: Colors.primary, padding: Spacing.lg, borderRadius: BorderRadius.md, alignItems: 'center' },
    saveButtonDisabled: { opacity: 0.5 },
    saveButtonText: { color: Colors.text, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});

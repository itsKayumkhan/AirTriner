import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors, Spacing, BorderRadius, FontSize, FontWeight } from '../../theme';

export default function SupportScreen({ navigation }: any) {
    const { user } = useAuth();
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleSubmit = async () => {
        if (!subject.trim() || !message.trim()) {
            Alert.alert('Missing Information', 'Please fill in both subject and message.');
            return;
        }
        setIsSending(true);
        try {
            // Create a notification for admin
            const { error } = await supabase.from('notifications').insert({
                user_id: user?.id,
                type: 'support_ticket',
                title: `Support: ${subject.trim()}`,
                body: message.trim(),
                data: { from_email: user?.email, from_name: `${user?.firstName} ${user?.lastName}` },
            });
            if (error) throw error;
            Alert.alert('Message Sent', 'Our support team will get back to you within 24 hours.', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to send message');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Contact Support</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.contactOptions}>
                    <TouchableOpacity style={styles.contactOption} onPress={() => Linking.openURL('mailto:support@airtrainr.com')}>
                        <View style={[styles.contactIcon, { backgroundColor: Colors.primaryGlow }]}>
                            <Ionicons name="mail" size={22} color={Colors.primary} />
                        </View>
                        <Text style={styles.contactOptionLabel}>Email Us</Text>
                        <Text style={styles.contactOptionValue}>support@airtrainr.com</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.sectionTitle}>Send us a message</Text>

                <Text style={styles.label}>Subject</Text>
                <TextInput
                    style={styles.input}
                    value={subject}
                    onChangeText={setSubject}
                    placeholder="What's this about?"
                    placeholderTextColor={Colors.textTertiary}
                />

                <Text style={styles.label}>Message</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Describe your issue or question in detail..."
                    placeholderTextColor={Colors.textTertiary}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                />

                <TouchableOpacity
                    style={[styles.submitBtn, (!subject.trim() || !message.trim() || isSending) && styles.submitBtnDisabled]}
                    onPress={handleSubmit}
                    disabled={!subject.trim() || !message.trim() || isSending}
                >
                    {isSending ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text style={styles.submitBtnText}>Send Message</Text>
                    )}
                </TouchableOpacity>
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xxl, paddingTop: 60, paddingBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
    backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
    headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text },
    contentContainer: { padding: Spacing.xxl },
    contactOptions: { marginBottom: Spacing.xxl },
    contactOption: { alignItems: 'center', padding: Spacing.xl, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
    contactIcon: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    contactOptionLabel: { fontSize: FontSize.md, fontWeight: FontWeight.bold, color: Colors.text },
    contactOptionValue: { fontSize: FontSize.sm, color: Colors.primary },
    sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: Spacing.lg },
    label: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.xs },
    input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, padding: Spacing.md, color: Colors.text, fontSize: FontSize.md, marginBottom: Spacing.lg },
    textArea: { minHeight: 140 },
    submitBtn: { backgroundColor: Colors.primary, padding: Spacing.lg, borderRadius: BorderRadius.md, alignItems: 'center', marginTop: Spacing.md },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },
});

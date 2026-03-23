import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// Register for push notifications and store token
export async function registerForPushNotifications(userId: string): Promise<string | null> {
    if (!Device.isDevice) {
        console.log('Push notifications require a physical device');
        return null;
    }

    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Push notification permission not granted');
            return null;
        }

        // Get Expo push token
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId,
        });
        const token = tokenData.data;

        // Store token in database
        const { error } = await supabase.from('push_tokens').upsert(
            {
                user_id: userId,
                token,
                platform: Platform.OS,
                is_active: true,
            },
            { onConflict: 'user_id,token' }
        );

        if (error) {
            // If upsert fails due to constraint, try insert
            await supabase.from('push_tokens').insert({
                user_id: userId,
                token,
                platform: Platform.OS,
                is_active: true,
            });
        }

        // Android channel setup
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Default',
                importance: Notifications.AndroidImportance.HIGH,
                sound: 'default',
                vibrationPattern: [0, 250, 250, 250],
            });
        }

        return token;
    } catch (error) {
        console.error('Error registering for push notifications:', error);
        return null;
    }
}

// Create an in-app notification in the database
export async function createNotification(params: {
    userId: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
}): Promise<void> {
    try {
        await supabase.from('notifications').insert({
            user_id: params.userId,
            type: params.type,
            title: params.title,
            body: params.body,
            data: params.data || {},
        });
    } catch (error) {
        console.error('Error creating notification:', error);
    }
}

// Send a local push notification (shown on device immediately)
export async function sendLocalNotification(params: {
    title: string;
    body: string;
    data?: Record<string, unknown>;
}): Promise<void> {
    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: params.title,
                body: params.body,
                data: params.data || {},
                sound: 'default',
            },
            trigger: null, // Show immediately
        });
    } catch (error) {
        console.error('Error sending local notification:', error);
    }
}

// Get unread message count for a user
export async function getUnreadMessageCount(userId: string): Promise<number> {
    try {
        // Get all bookings where the user is either athlete or trainer
        const { data: bookings } = await supabase
            .from('bookings')
            .select('id')
            .or(`athlete_id.eq.${userId},trainer_id.eq.${userId}`);

        if (!bookings || bookings.length === 0) return 0;

        const bookingIds = bookings.map(b => b.id);

        const { count, error } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .in('booking_id', bookingIds)
            .neq('sender_id', userId)
            .is('read_at', null);

        if (error) throw error;
        return count || 0;
    } catch (error) {
        console.error('Error getting unread count:', error);
        return 0;
    }
}

// Get unread notification count
export async function getUnreadNotificationCount(userId: string): Promise<number> {
    try {
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('read', false);

        if (error) throw error;
        return count || 0;
    } catch (error) {
        console.error('Error getting notification count:', error);
        return 0;
    }
}

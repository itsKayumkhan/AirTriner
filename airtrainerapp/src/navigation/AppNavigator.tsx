import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { Colors, FontSize, FontWeight } from '../theme';
import { supabase } from '../lib/supabase';
import { registerForPushNotifications, getUnreadMessageCount, sendLocalNotification } from '../lib/notifications';
import CustomDrawerContent from '../components/CustomDrawerContent';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Dashboard Screens
import DiscoverScreen from '../screens/dashboard/DiscoverScreen';
import TrainerDashboardScreen from '../screens/dashboard/TrainerDashboardScreen';
import AthleteDashboardScreen from '../screens/dashboard/AthleteDashboardScreen';
import BookingsScreen from '../screens/dashboard/BookingsScreen';
import MessagesScreen from '../screens/dashboard/MessagesScreen';
import ProfileScreen from '../screens/dashboard/ProfileScreen';
import NotificationsScreen from '../screens/dashboard/NotificationsScreen';
import TrainerDetailScreen from '../screens/dashboard/TrainerDetailScreen';
import ChatScreen from '../screens/dashboard/ChatScreen';
import SubAccountsScreen from '../screens/dashboard/SubAccountsScreen';
import EditProfileScreen from '../screens/dashboard/EditProfileScreen';
import VerificationScreen from '../screens/dashboard/VerificationScreen';
import PaymentMethodsScreen from '../screens/dashboard/PaymentMethodsScreen';
import ReviewsScreen from '../screens/dashboard/ReviewsScreen';
import TrainingHistoryScreen from '../screens/dashboard/TrainingHistoryScreen';
import AvailabilityScreen from '../screens/dashboard/AvailabilityScreen';
import EarningsScreen from '../screens/dashboard/EarningsScreen';
import CertificationsScreen from '../screens/dashboard/CertificationsScreen';
import HelpCenterScreen from '../screens/dashboard/HelpCenterScreen';
import SupportScreen from '../screens/dashboard/SupportScreen';
import TermsScreen from '../screens/dashboard/TermsScreen';
import PrivacyScreen from '../screens/dashboard/PrivacyScreen';
import SubscriptionScreen from '../screens/dashboard/SubscriptionScreen';
import TrainingOffersScreen from '../screens/dashboard/TrainingOffersScreen';
import BookingDetailScreen from '../screens/dashboard/BookingDetailScreen';

const AuthStack = createNativeStackNavigator();
const MainStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

function AuthNavigator() {
    return (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
            <AuthStack.Screen name="Login" component={LoginScreen} />
            <AuthStack.Screen name="Register" component={RegisterScreen} />
        </AuthStack.Navigator>
    );
}

function TabNavigator() {
    const { user } = useAuth();
    const isTrainer = user?.role === 'trainer';
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [unreadNotifications, setUnreadNotifications] = useState(0);

    // Fetch unread message count
    const fetchUnreadCount = useCallback(async () => {
        if (!user) return;
        const count = await getUnreadMessageCount(user.id);
        setUnreadMessages(count);
    }, [user]);

    // Fetch unread notification count
    const fetchUnreadNotificationCount = useCallback(async () => {
        if (!user) return;
        const { count } = await supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('read', false);
        setUnreadNotifications(count ?? 0);
    }, [user]);

    useEffect(() => {
        fetchUnreadCount();
        fetchUnreadNotificationCount();

        // Register for push notifications
        if (user) {
            registerForPushNotifications(user.id);
        }

        // Listen for new messages in real-time to update badge
        if (!user) return;
        const channel = supabase
            .channel('global-messages-badge')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
            }, (payload) => {
                const msg = payload.new as any;
                // If the new message is NOT from current user, increment badge
                if (msg.sender_id !== user.id) {
                    setUnreadMessages((prev) => prev + 1);
                    // Show local push notification
                    sendLocalNotification({
                        title: 'New Message',
                        body: msg.content?.substring(0, 100) || 'You have a new message',
                        data: { bookingId: msg.booking_id },
                    });
                }
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`,
            }, (payload) => {
                const notif = payload.new as any;
                // Increment unread notification badge
                setUnreadNotifications((prev) => prev + 1);
                // Show local push notification for in-app notifications
                sendLocalNotification({
                    title: notif.title || 'AirTrainr',
                    body: notif.body || 'You have a new notification',
                    data: notif.data || {},
                });
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${user.id}`,
            }, () => {
                // Re-fetch count when a notification is marked as read
                fetchUnreadNotificationCount();
            })
            .subscribe();

        // Refresh counts every 30 seconds
        const interval = setInterval(() => {
            fetchUnreadCount();
            fetchUnreadNotificationCount();
        }, 30000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, [user, fetchUnreadCount, fetchUnreadNotificationCount]);

    // Reset badge when Messages tab is focused
    const handleMessagesTabFocus = () => {
        setUnreadMessages(0);
    };

    // Reset notification badge when Profile tab is focused
    const handleProfileTabFocus = () => {
        setUnreadNotifications(0);
    };

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarActiveTintColor: '#45D0FF',
                tabBarInactiveTintColor: 'rgba(255,255,255,0.35)',
                tabBarLabelStyle: styles.tabBarLabel,
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName: keyof typeof Ionicons.glyphMap = 'home';

                    switch (route.name) {
                        case 'Discover':
                            iconName = focused ? 'compass' : 'compass-outline';
                            break;
                        case 'Dashboard':
                            iconName = isTrainer
                                ? (focused ? 'grid' : 'grid-outline')
                                : (focused ? 'home' : 'home-outline');
                            break;
                        case 'Bookings':
                            iconName = focused ? 'calendar' : 'calendar-outline';
                            break;
                        case 'Messages':
                            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
                            break;
                        case 'Profile':
                            iconName = focused ? 'person-circle' : 'person-circle-outline';
                            break;
                    }

                    return (
                        <View style={[styles.tabIconContainer, focused && styles.tabIconContainerActive]}>
                            <Ionicons name={iconName} size={24} color={color} />
                            {route.name === 'Messages' && unreadMessages > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>
                                        {unreadMessages > 99 ? '99+' : unreadMessages}
                                    </Text>
                                </View>
                            )}
                            {route.name === 'Profile' && unreadNotifications > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>
                                        {unreadNotifications > 99 ? '99+' : unreadNotifications}
                                    </Text>
                                </View>
                            )}
                        </View>
                    );
                },
            })}
        >
            {isTrainer ? (
                <Tab.Screen
                    name="Dashboard"
                    component={TrainerDashboardScreen}
                    options={{ tabBarLabel: 'Dashboard' }}
                />
            ) : (
                <>
                    <Tab.Screen
                        name="Dashboard"
                        component={AthleteDashboardScreen}
                        options={{ tabBarLabel: 'Dashboard' }}
                    />
                    <Tab.Screen
                        name="Discover"
                        component={DiscoverScreen}
                        options={{ tabBarLabel: 'Discover' }}
                    />
                </>
            )}
            <Tab.Screen
                name="Bookings"
                component={BookingsScreen}
                options={{ tabBarLabel: 'Bookings' }}
            />
            <Tab.Screen
                name="Messages"
                component={MessagesScreen}
                options={{ tabBarLabel: 'Messages' }}
                listeners={{ tabPress: handleMessagesTabFocus }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ tabBarLabel: 'Profile' }}
                listeners={{ tabPress: handleProfileTabFocus }}
            />
        </Tab.Navigator>
    );
}

function MainStackNavigator() {
    return (
        <MainStack.Navigator screenOptions={{ headerShown: false }}>
            <MainStack.Screen name="Tabs" component={TabNavigator} />
            <MainStack.Screen name="Notifications" component={NotificationsScreen} />
            <MainStack.Screen name="TrainerDetail" component={TrainerDetailScreen} options={{ animation: 'slide_from_right' }} />
            <MainStack.Screen name="Chat" component={ChatScreen} options={{ animation: 'slide_from_right' }} />
            <MainStack.Screen name="SubAccounts" component={SubAccountsScreen} options={{ animation: 'slide_from_right' }} />
            <MainStack.Screen name="EditProfile" component={EditProfileScreen} options={{ animation: 'slide_from_right' }} />
            <MainStack.Screen name="Verification" component={VerificationScreen} options={{ animation: 'slide_from_right' }} />
            <MainStack.Screen name="PaymentMethods" component={PaymentMethodsScreen} options={{ animation: 'slide_from_right' }} />
            <MainStack.Screen name="Reviews" component={ReviewsScreen} options={{ animation: 'slide_from_right' }} />
            <MainStack.Screen name="TrainingHistory" component={TrainingHistoryScreen} options={{ animation: 'slide_from_right' }} />
            <MainStack.Screen name="Availability" component={AvailabilityScreen} options={{ animation: 'slide_from_right' }} />
            <MainStack.Screen name="Earnings" component={EarningsScreen} options={{ animation: 'slide_from_right' }} />
            <MainStack.Screen name="Certifications" component={CertificationsScreen} options={{ animation: 'slide_from_right' }} />
            <MainStack.Screen name="HelpCenter" component={HelpCenterScreen} options={{ animation: 'slide_from_right' }} />
            <MainStack.Screen name="Support" component={SupportScreen} options={{ animation: 'slide_from_right' }} />
            <MainStack.Screen name="Terms" component={TermsScreen} options={{ animation: 'slide_from_right' }} />
            <MainStack.Screen name="Privacy" component={PrivacyScreen} options={{ animation: 'slide_from_right' }} />
            <MainStack.Screen name="Subscription" component={SubscriptionScreen} options={{ animation: 'slide_from_right' }} />
            <MainStack.Screen name="TrainingOffers" component={TrainingOffersScreen} options={{ animation: 'slide_from_right' }} />
            <MainStack.Screen name="BookingDetail" component={BookingDetailScreen} options={{ animation: 'slide_from_right' }} />
        </MainStack.Navigator>
    );
}

function MainNavigator() {
    return (
        <Drawer.Navigator
            drawerContent={(props) => <CustomDrawerContent {...props} />}
            screenOptions={{
                headerShown: false,
                drawerType: 'front',
                drawerStyle: {
                    width: 300,
                    backgroundColor: Colors.background,
                },
                overlayColor: 'rgba(0, 0, 0, 0.6)',
                swipeEnabled: true,
                swipeEdgeWidth: 50,
            }}
        >
            <Drawer.Screen name="Main" component={MainStackNavigator} />
        </Drawer.Navigator>
    );
}

export default function AppNavigator() {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <View style={styles.loadingDot} />
            </View>
        );
    }

    return (
        <NavigationContainer>
            {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: '#0A0D14',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
        height: Platform.OS === 'ios' ? 88 : 68,
        paddingTop: 8,
        paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        elevation: 0,
    },
    tabBarLabel: {
        fontSize: FontSize.xs,
        fontWeight: FontWeight.medium,
        marginTop: 2,
    },
    tabIconContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        width: 44,
        height: 32,
        borderRadius: 10,
    },
    tabIconContainerActive: {
        backgroundColor: Colors.primaryGlow,
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -8,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: Colors.error,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: FontWeight.bold,
        color: '#fff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
    },
    loadingDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: Colors.primary,
    },
});

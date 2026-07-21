import React, { useEffect } from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import MainTabNavigator from './MainTabNavigator';
import ChatRoomScreen from '../screens/chat/ChatRoomScreen';
import CreateChatScreen from '../screens/chat/CreateChatScreen';
import CommunityListScreen from '../screens/community/CommunityListScreen';
import CommunityPreviewScreen from '../screens/community/CommunityPreviewScreen';
import CommunityDashboardScreen from '../screens/community/CommunityDashboardScreen';
import CommunityMembersScreen from '../screens/community/CommunityMembersScreen';
import CommunitySettingsScreen from '../screens/community/CommunitySettingsScreen';
import CommunityAuditLogScreen from '../screens/community/CommunityAuditLogScreen';
import EventListScreen from '../screens/community/EventListScreen';
import SplashScreen from '../screens/auth/SplashScreen';
import RideGroupsScreen from '../screens/ride/RideGroupsScreen';
import CreateGroupScreen from '../screens/ride/CreateGroupScreen';
import GroupDetailScreen from '../screens/ride/GroupDetailScreen';
import GroupDetailsScreen from '../screens/chat/GroupDetailsScreen';
import MembersListScreen from '../screens/chat/MembersListScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import NotificationPopup from '../components/notifications/NotificationPopup';

import RideDetailScreen from '../screens/ride/RideDetailScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
    const session = useAuthStore((state) => state.session);
    const initialized = useAuthStore((state) => state.initialized);
    const { startRealtimeListener, stopRealtimeListener, fetchNotifications } = useNotificationStore();

    // Start notification listener globally when user is authenticated
    useEffect(() => {
        if (session?.user) {
            fetchNotifications();
            startRealtimeListener(session.user.id);
        }
        return () => {
            stopRealtimeListener();
        };
    }, [session?.user?.id]);

    if (!initialized) {
        return <SplashScreen />;
    }

    return (
        <View style={{ flex: 1 }}>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {session && session.user ? (
                    // Authenticated Stack
                    <>
                        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
                        <Stack.Screen
                            name="ChatRoom"
                            component={ChatRoomScreen}
                            options={{ presentation: 'modal' }}
                        />
                        <Stack.Screen
                            name="CreateChat"
                            component={CreateChatScreen}
                            options={{ presentation: 'modal' }}
                        />
                        <Stack.Screen
                            name="GroupDetails"
                            component={GroupDetailsScreen}
                        />
                        <Stack.Screen
                            name="MembersList"
                            component={MembersListScreen}
                        />
                        <Stack.Screen
                            name="CommunityList"
                            component={CommunityListScreen}
                            options={{ title: 'Clubs' }}
                        />
                        <Stack.Screen
                            name="CommunityPreview"
                            component={CommunityPreviewScreen}
                            options={{ presentation: 'modal' }}
                        />
                        <Stack.Screen
                            name="CommunityDashboard"
                            component={CommunityDashboardScreen}
                        />
                        <Stack.Screen
                            name="CommunityMembers"
                            component={CommunityMembersScreen}
                        />
                        <Stack.Screen
                            name="CommunitySettings"
                            component={CommunitySettingsScreen}
                        />
                        <Stack.Screen
                            name="CommunityAuditLogs"
                            component={CommunityAuditLogScreen}
                        />
                        <Stack.Screen
                            name="EventList"
                            component={EventListScreen}
                            options={{ title: 'Explore Events' }}
                        />
                        <Stack.Screen
                            name="RideGroups"
                            component={RideGroupsScreen}
                        />
                        <Stack.Screen
                            name="CreateGroup"
                            component={CreateGroupScreen}
                            options={{ presentation: 'modal' }}
                        />
                        <Stack.Screen
                            name="GroupDetail"
                            component={GroupDetailScreen}
                        />
                        <Stack.Screen
                            name="RideDetail"
                            component={RideDetailScreen}
                        />
                        <Stack.Screen
                            name="Notifications"
                            component={NotificationsScreen}
                        />
                    </>
                ) : (
                    // Auth Stack
                    <>
                        <Stack.Screen name="Login" component={LoginScreen} />
                        <Stack.Screen name="Register" component={RegisterScreen} />
                    </>
                )}
            </Stack.Navigator>

            {/* Global Notification Popup — renders above all screens */}
            {session?.user && <NotificationPopup />}
        </View>
    );
}

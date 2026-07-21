import React from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Temporary screens for now
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import MapScreen from '../screens/map/MapScreen';
import ChatListScreen from '../screens/chat/ChatListScreen';
import CommunityListScreen from '../screens/community/CommunityListScreen';
import DailyActivitiesScreen from '../screens/activity/DailyActivitiesScreen';

import { useUnreadCount } from '../hooks/useUnreadCount';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
    const unreadCount = useUnreadCount();

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: '#FF2D55',
                tabBarInactiveTintColor: '#888',
                tabBarStyle: {
                    backgroundColor: '#121212',
                    borderTopColor: '#2C2C2E',
                    height: 60,
                    paddingBottom: 8,
                },
                tabBarBackground: () => (
                    <View style={{ flex: 1, backgroundColor: '#121212' }} />
                ),
                sceneStyle: { backgroundColor: '#121212' },
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName: keyof typeof Ionicons.glyphMap = 'help-outline';

                    if (route.name === 'Dashboard') {
                        iconName = focused ? 'home' : 'home-outline';
                    } else if (route.name === 'Map') {
                        iconName = focused ? 'navigate' : 'navigate-outline';
                    } else if (route.name === 'ChatList') {
                        iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
                    } else if (route.name === 'Activities') {
                        iconName = focused ? 'stats-chart' : 'stats-chart-outline';
                    } else if (route.name === 'Profile') {
                        iconName = focused ? 'person' : 'person-outline';
                    }

                    return <Ionicons name={iconName} size={size} color={color} />;
                },
            })}
        >
            <Tab.Screen
                name="Dashboard"
                component={DashboardScreen}
                options={{ tabBarLabel: 'Home' }}
            />
            <Tab.Screen
                name="Map"
                component={MapScreen}
                options={{ tabBarLabel: 'Ride' }}
            />
            <Tab.Screen
                name="ChatList"
                component={ChatListScreen}
                options={{
                    tabBarLabel: 'Chat',
                    tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
                    tabBarBadgeStyle: { backgroundColor: '#FF2D55' }
                }}
            />
            <Tab.Screen
                name="Activities"
                component={DailyActivitiesScreen}
                options={{ tabBarLabel: 'Stats' }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ tabBarLabel: 'Profile' }}
            />
        </Tab.Navigator>
    );
}

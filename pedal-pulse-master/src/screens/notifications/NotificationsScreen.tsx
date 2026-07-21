import React, { useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    RefreshControl, ActivityIndicator, Animated
} from 'react-native';
import { SwipeListView } from 'react-native-swipe-list-view';
import { Ionicons } from '@expo/vector-icons';
import { useNotificationStore, Notification } from '../../store/useNotificationStore';
import { useAuthStore } from '../../store/useAuthStore';

function formatTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

function NotificationCard({ item, onPress }: { item: Notification; onPress: () => void }) {
    const isEmergency = item.type === 'emergency';

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={onPress}
            style={[
                styles.card,
                !item.is_read && styles.unreadCard,
                isEmergency && styles.emergencyCard,
            ]}
        >
            <View style={[
                styles.iconContainer,
                isEmergency ? styles.emergencyIcon : styles.normalIcon
            ]}>
                <Ionicons
                    name={
                        isEmergency ? 'warning' :
                            item.type === 'ride' ? 'bicycle' :
                                item.type === 'group' ? 'people' :
                                    'notifications'
                    }
                    size={22}
                    color={isEmergency ? '#FF3B30' : '#FF2D55'}
                />
            </View>

            <View style={styles.content}>
                <View style={styles.titleRow}>
                    <Text style={[
                        styles.title,
                        isEmergency && styles.emergencyTitle
                    ]} numberOfLines={1}>
                        {item.title}
                    </Text>
                    <Text style={styles.time}>{formatTimeAgo(item.created_at)}</Text>
                </View>
                <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
            </View>

            {!item.is_read && <View style={styles.unreadDot} />}
        </TouchableOpacity>
    );
}

export default function NotificationsScreen() {
    const user = useAuthStore(s => s.user);
    const {
        notifications, unreadCount, isLoading,
        fetchNotifications, markAsRead, markAllRead,
        startRealtimeListener, deleteNotification
    } = useNotificationStore();

    useEffect(() => {
        fetchNotifications();
        if (user?.id) {
            startRealtimeListener(user.id);
        }
    }, [user?.id]);

    const handleRefresh = useCallback(() => {
        fetchNotifications();
    }, []);

    const handlePress = useCallback((item: Notification) => {
        if (!item.is_read) {
            markAsRead(item.id);
        }
    }, []);

    const renderItem = useCallback((data: any) => (
        <NotificationCard item={data.item} onPress={() => handlePress(data.item)} />
    ), []);

    const renderHiddenItem = useCallback((data: any) => (
        <View style={styles.rowBack}>
            <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => deleteNotification(data.item.id)}
            >
                <Ionicons name="trash" size={24} color="#fff" />
            </TouchableOpacity>
        </View>
    ), []);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Notifications</Text>
                {unreadCount > 0 && (
                    <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
                        <Text style={styles.markAllText}>Mark all read</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* List */}
            {isLoading && notifications.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <ActivityIndicator size="large" color="#FF2D55" />
                </View>
            ) : notifications.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="notifications-off-outline" size={60} color="#444" />
                    <Text style={styles.emptyText}>No notifications yet</Text>
                    <Text style={styles.emptySubtext}>Emergency alerts and updates will appear here</Text>
                </View>
            ) : (
                <SwipeListView
                    data={notifications}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    renderHiddenItem={renderHiddenItem}
                    rightOpenValue={-80}
                    disableRightSwipe
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl
                            refreshing={isLoading}
                            onRefresh={handleRefresh}
                            tintColor="#FF2D55"
                            colors={['#FF2D55']}
                        />
                    }
                    showsVerticalScrollIndicator={false}
                    useNativeDriver={false}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0A0A',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1C1C1E',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: -0.5,
    },
    markAllBtn: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(255, 45, 85, 0.15)',
        borderRadius: 16,
    },
    markAllText: {
        color: '#FF2D55',
        fontSize: 13,
        fontWeight: '600',
    },
    list: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 30,
    },
    rowBack: {
        alignItems: 'center',
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginBottom: 10,
        borderRadius: 14,
        overflow: 'hidden',
    },
    deleteBtn: {
        backgroundColor: '#FF3B30',
        width: 80,
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        borderTopRightRadius: 14,
        borderBottomRightRadius: 14,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
    },
    unreadCard: {
        backgroundColor: '#1A1A2E',
        borderLeftWidth: 3,
        borderLeftColor: '#FF2D55',
    },
    emergencyCard: {
        backgroundColor: '#2D0A0A',
        borderLeftWidth: 3,
        borderLeftColor: '#FF3B30',
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    normalIcon: {
        backgroundColor: 'rgba(255, 45, 85, 0.12)',
    },
    emergencyIcon: {
        backgroundColor: 'rgba(255, 59, 48, 0.2)',
    },
    content: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        color: '#fff',
        flex: 1,
        marginRight: 8,
    },
    emergencyTitle: {
        color: '#FF3B30',
    },
    time: {
        fontSize: 12,
        color: '#666',
    },
    body: {
        fontSize: 13,
        color: '#999',
        lineHeight: 18,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF2D55',
        marginLeft: 8,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#666',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#444',
        marginTop: 8,
        textAlign: 'center',
    },
});

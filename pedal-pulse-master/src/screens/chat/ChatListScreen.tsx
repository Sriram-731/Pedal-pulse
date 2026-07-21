import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl, Image, Modal, Alert,
    ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ChatRoom, ChatParticipant } from '../../types/chat';

const categories = [
    { id: 'all', label: 'All', icon: 'chatbubbles-outline' },
    { id: 'direct', label: 'Friends', icon: 'person-outline' },
    { id: 'group', label: 'Groups', icon: 'people-outline' },
    { id: 'community', label: 'Clubs', icon: 'shield-outline' },
    { id: 'event', label: 'Events', icon: 'calendar-outline' },
];

export default function ChatListScreen({ navigation }: any) {
    const user = useAuthStore(state => state.user);
    const [rooms, setRooms] = useState<ChatRoom[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
    const [menuVisible, setMenuVisible] = useState(false);
    const [activeTab, setActiveTab] = useState('all');

    useFocusEffect(
        useCallback(() => {
            fetchRooms();
        }, [])
    );

    useEffect(() => {
        if (!user) return;

        fetchRooms();

        const channel = supabase
            .channel('chat_list_updates')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'chat_rooms'
            }, (payload) => {
                if (payload.eventType === 'UPDATE') {
                    const updated = payload.new as ChatRoom;
                    setRooms(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r));
                } else {
                    fetchRooms();
                }
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'chat_participants',
                filter: `user_id=eq.${user.id}`
            }, (payload) => {
                if (payload.eventType === 'UPDATE') {
                    const updated = payload.new as ChatParticipant;
                    setRooms(prev => prev.map(r => {
                        if (r.id === updated.room_id) {
                            const newParts = r.chat_participants?.map(p =>
                                p.user_id === user.id ? { ...p, ...updated } : p
                            );
                            return { ...r, chat_participants: newParts };
                        }
                        return r;
                    }));
                } else {
                    fetchRooms();
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const fetchRooms = async () => {
        if (!user) return;

        // 1. Get rooms the user is a part of
        const { data: myParts, error: partsError } = await supabase
            .from('chat_participants')
            .select('room_id')
            .eq('user_id', user.id);

        if (partsError) {
            console.error('FETCH_PARTS_ERROR:', partsError);
            setLoading(false);
            setRefreshing(false);
            return;
        }

        const roomIds = myParts?.map(p => p.room_id) || [];

        if (roomIds.length === 0) {
            setRooms([]);
            setLoading(false);
            setRefreshing(false);
            return;
        }

        // 2. Fetch full room details including all participants
        const { data, error } = await supabase
            .from('chat_rooms')
            .select(`
                *,
                chat_participants (
                    user_id,
                    last_read_at,
                    unread_count,
                    profiles (
                        name,
                        avatar_url
                    )
                )
            `)
            .in('id', roomIds)
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('FETCH_ROOMS_ERROR:', error);
        } else if (data) {
            setRooms(data as any);
        }
        setLoading(false);
        setRefreshing(false);
    };

    const filteredRooms = useMemo(() => {
        if (activeTab === 'all') return rooms;
        return rooms.filter(r => r.type === activeTab);
    }, [rooms, activeTab]);

    const handleRoomPress = (room: ChatRoom) => {
        const otherParticipant = room.chat_participants?.find(p => p.user_id !== user?.id);
        const roomName = room.type === 'direct'
            ? otherParticipant?.profiles?.name || 'Direct Chat'
            : room.name || 'Group Chat';

        navigation.navigate('ChatRoom', { roomId: room.id, roomName });
    };

    const handleLongPress = (room: ChatRoom) => {
        setSelectedRoom(room);
        setMenuVisible(true);
    };

    const deleteChat = async () => {
        if (!selectedRoom || !user) return;

        const { error } = await supabase
            .from('chat_participants')
            .delete()
            .match({ room_id: selectedRoom.id, user_id: user.id });

        if (error) {
            Alert.alert('Error', 'Failed to leave chat');
        } else {
            setRooms(prev => prev.filter(r => r.id !== selectedRoom.id));
        }
        setMenuVisible(false);
        setSelectedRoom(null);
    };

    const renderItem = ({ item }: { item: ChatRoom }) => {
        const otherParticipant = item.chat_participants?.find(p => p.user_id !== user?.id);
        const myParticipant = item.chat_participants?.find(p => p.user_id === user?.id);
        const unreadCount = myParticipant?.unread_count || 0;

        const roomName = item.type === 'direct'
            ? otherParticipant?.profiles?.name || 'Direct Chat'
            : item.name || 'Group Chat';

        let typeIcon: any = 'person';
        let typeColor = '#8E8E93';
        if (item.type === 'group') { typeIcon = 'people'; typeColor = '#FF2D55'; }
        if (item.type === 'community') { typeIcon = 'business'; typeColor = '#5856D6'; }

        return (
            <TouchableOpacity
                style={styles.roomItem}
                onPress={() => handleRoomPress(item)}
                onLongPress={() => handleLongPress(item)}
            >
                <View style={styles.avatarContainer}>
                    {item.type === 'direct' ? (
                        otherParticipant?.profiles?.avatar_url ? (
                            <Image source={{ uri: otherParticipant.profiles.avatar_url }} style={styles.avatar} />
                        ) : (
                            <LinearGradient colors={['#FF2D55', '#D40035']} style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarText}>{otherParticipant?.profiles?.name?.charAt(0).toUpperCase() || '?'}</Text>
                            </LinearGradient>
                        )
                    ) : (
                        <LinearGradient colors={['#2C2C2E', '#1C1C1E']} style={styles.avatarPlaceholder}>
                            <Ionicons name={typeIcon} size={24} color="#8E8E93" />
                        </LinearGradient>
                    )}
                    {unreadCount > 0 && <View style={styles.unreadDot} />}
                </View>

                <View style={styles.roomInfo}>
                    <View style={styles.roomHeader}>
                        <View style={styles.nameRow}>
                            <Text style={styles.roomNameText} numberOfLines={1}>{roomName}</Text>
                            {item.type !== 'direct' && (
                                <View style={[styles.typeBadge, { backgroundColor: typeColor + '20' }]}>
                                    <Text style={[styles.typeBadgeText, { color: typeColor }]}>
                                        {item.type.toUpperCase()}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.timeText}>
                            {new Date(item.updated_at).toLocaleDateString() === new Date().toLocaleDateString()
                                ? new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : new Date(item.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
                            }
                        </Text>
                    </View>

                    <View style={styles.roomFooter}>
                        <Text style={[styles.previewText, unreadCount > 0 && styles.unreadPreview]} numberOfLines={1}>
                            {item.last_message_preview || 'No messages yet'}
                        </Text>
                        {unreadCount > 0 && (
                            <View style={styles.unreadBadge}>
                                <Text style={styles.unreadCountText}>{unreadCount}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#FF2D55" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Messages</Text>
                <TouchableOpacity onPress={() => navigation.navigate('CreateChat')}>
                    <Ionicons name="create-outline" size={26} color="#FF2D55" />
                </TouchableOpacity>
            </View>

            <View style={styles.filterContainer}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterScroll}
                >
                    {categories.map(cat => (
                        <TouchableOpacity
                            key={cat.id}
                            style={[
                                styles.filterItem,
                                activeTab === cat.id && styles.filterItemActive
                            ]}
                            onPress={() => setActiveTab(cat.id)}
                        >
                            <Ionicons
                                name={cat.icon as any}
                                size={18}
                                color={activeTab === cat.id ? '#fff' : '#8E8E93'}
                                style={styles.filterIcon}
                            />
                            <Text style={[
                                styles.filterText,
                                activeTab === cat.id && styles.filterTextActive
                            ]}>
                                {cat.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <FlatList
                data={filteredRooms}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRooms(); }} tintColor="#FF2D55" />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="chatbubbles-outline" size={60} color="#333" />
                        <Text style={styles.emptyText}>No {activeTab === 'all' ? 'conversations' : activeTab} yet</Text>
                    </View>
                }
            />

            <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
                    <View style={styles.menuContainer}>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); handleRoomPress(selectedRoom!); }}>
                            <Ionicons name="open-outline" size={22} color="#fff" />
                            <Text style={styles.menuItemText}>Open Chat</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.menuItem, styles.deleteItem]} onPress={deleteChat}>
                            <Ionicons name="trash-outline" size={22} color="#FF2D55" />
                            <Text style={[styles.menuItemText, { color: '#FF2D55' }]}>Leave Conversation</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F0F0F' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 15,
        paddingBottom: 10,
    },
    headerTitle: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
    filterContainer: {
        marginBottom: 10,
    },
    filterScroll: {
        paddingHorizontal: 15,
        paddingBottom: 10,
    },
    filterItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#1C1C1E',
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#2C2C2E',
    },
    filterItemActive: {
        backgroundColor: '#FF2D55',
        borderColor: '#FF2D55',
    },
    filterIcon: {
        marginRight: 6,
    },
    filterText: {
        color: '#8E8E93',
        fontSize: 14,
        fontWeight: '600',
    },
    filterTextActive: {
        color: '#fff',
    },
    listContent: { paddingHorizontal: 15, paddingBottom: 20 },
    roomItem: { flexDirection: 'row', paddingVertical: 14, alignItems: 'center' },
    avatarContainer: { marginRight: 15, position: 'relative' },
    avatar: { width: 60, height: 60, borderRadius: 30 },
    avatarPlaceholder: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center'
    },
    avatarText: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    unreadDot: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#FF2D55',
        borderWidth: 2,
        borderColor: '#0F0F0F',
    },
    roomInfo: { flex: 1, borderBottomWidth: 0.5, borderBottomColor: '#1C1C1E', paddingBottom: 14 },
    roomHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    nameRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    roomNameText: { color: '#fff', fontSize: 17, fontWeight: '700', marginRight: 8 },
    typeBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    typeBadgeText: {
        fontSize: 9,
        fontWeight: '900',
    },
    timeText: { color: '#8E8E93', fontSize: 13 },
    roomFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    previewText: { color: '#8E8E93', fontSize: 14, flex: 1, marginRight: 10 },
    unreadPreview: { color: '#fff' },
    unreadBadge: {
        backgroundColor: '#FF2D55',
        borderRadius: 12,
        minWidth: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6
    },
    unreadCountText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#333', fontSize: 18, marginTop: 15 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    menuContainer: { backgroundColor: '#1C1C1E', borderRadius: 20, width: '80%', padding: 10, borderWidth: 1, borderColor: '#2C2C2E' },
    menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    menuItemText: { color: '#fff', fontSize: 16, marginLeft: 16, fontWeight: '500' },
    deleteItem: { borderTopWidth: 1, borderTopColor: '#2C2C2E', marginTop: 5 }
});

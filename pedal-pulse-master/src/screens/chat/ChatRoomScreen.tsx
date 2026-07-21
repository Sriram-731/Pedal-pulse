import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
    KeyboardAvoidingView, Platform, Alert, Modal, Keyboard,
    ActivityIndicator, StatusBar
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMessages } from '../../hooks/useMessages';
import { usePresence } from '../../hooks/usePresence';
import { useTypingIndicator } from '../../hooks/useTypingIndicator';
import { Message } from '../../types/chat';
import MessageBubble from '../../components/chat/MessageBubble';

export default function ChatRoomScreen({ route, navigation }: any) {
    const { roomId, roomName } = route.params;
    const user = useAuthStore(state => state.user);
    const insets = useSafeAreaInsets();
    const headerHeight = useHeaderHeight();

    const {
        messages, loading, loadingMore, hasMore,
        sendMessage, fetchMore, handleReaction: toggleReaction, markAsSeen
    } = useMessages(roomId);

    const { isUserOnline } = usePresence(roomId);
    const { typingUsers, setTyping } = useTypingIndicator(roomId);

    const [newMessage, setNewMessage] = useState('');
    const [replyTo, setReplyTo] = useState<Message | null>(null);
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
    const [menuVisible, setMenuVisible] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [displayRoomName, setDisplayRoomName] = useState(roomName);
    const [otherUserId, setOtherUserId] = useState<string | null>(null);

    useEffect(() => {
        fetchRoomDetails();
        markAsSeen();
    }, [roomId]);

    useEffect(() => {
        if (messages.length > 0) markAsSeen();
    }, [messages.length]);

    const fetchRoomDetails = async () => {
        const { data: room } = await supabase
            .from('chat_rooms')
            .select('*, chat_participants(user_id, profiles(name))')
            .eq('id', roomId)
            .single();

        if (room) {
            if (room.type === 'direct') {
                const other = (room.chat_participants as any[]).find(p => p.user_id !== user?.id);
                if (other) {
                    setOtherUserId(other.user_id);
                    if (other.profiles) setDisplayRoomName(other.profiles.name);
                }
            } else if (room.name) {
                setDisplayRoomName(room.name);
            }
        }
    };

    const handleSend = async () => {
        if (!newMessage.trim() && !uploading) return;
        const content = newMessage.trim();
        setNewMessage('');
        const replyId = replyTo?.id;
        setReplyTo(null);
        setTyping(false);
        await sendMessage(content, undefined, replyId);
    };

    const handleLongPress = (message: Message) => {
        setSelectedMessage(message);
        setMenuVisible(true);
    };

    const handleReaction = (emoji: string) => {
        if (selectedMessage) {
            toggleReaction(selectedMessage.id, emoji);
            setMenuVisible(false);
            setSelectedMessage(null);
        }
    };

    const renderMessage = ({ item, index }: { item: Message, index: number }) => {
        const isMine = item.sender_id === user?.id;
        const prevMsg = messages[index + 1]; // Older
        const nextMsg = messages[index - 1]; // Newer

        const isPrevSameSender = prevMsg?.sender_id === item.sender_id;
        const isNextSameSender = nextMsg?.sender_id === item.sender_id;

        const timeDiff = prevMsg ? (new Date(item.created_at).getTime() - new Date(prevMsg.created_at).getTime()) : 0;
        const showTime = !prevMsg || timeDiff > 300000; // 5 minutes

        const showName = !isMine && (!isPrevSameSender || showTime);
        const isLastInGroup = !isNextSameSender;
        const showAvatar = !isMine && isLastInGroup;

        return (
            <MessageBubble
                message={item}
                isMine={isMine}
                showName={showName}
                showTime={showTime}
                showAvatar={showAvatar}
                isLastInGroup={isLastInGroup}
                onLongPress={handleLongPress}
                onReplyPress={setReplyTo}
            />
        );
    };

    // Correct presence check
    const isOnline = otherUserId ? isUserOnline(otherUserId) : false;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={28} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.headerInfo}
                    onPress={() => {
                        if (displayRoomName !== 'Direct Chat' && !otherUserId) {
                            navigation.navigate('GroupDetails', { roomId, roomName: displayRoomName });
                        }
                    }}
                >
                    <Text style={styles.roomName}>{displayRoomName || 'Room'}</Text>
                    <View style={styles.statusRow}>
                        <View style={[styles.statusDot, { backgroundColor: isOnline ? '#4CD964' : '#8E8E93' }]} />
                        <Text style={[styles.onlineStatus, { color: isOnline ? '#4CD964' : '#8E8E93' }]}>
                            {isOnline ? 'Online' : 'Offline'}
                        </Text>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { }} style={styles.menuBtn}>
                    <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={headerHeight}
                style={styles.keyboardAvoidingView}
            >
                <View style={styles.chatArea}>
                    <FlatList
                        data={messages}
                        keyExtractor={(item) => item.id}
                        renderItem={renderMessage}
                        contentContainerStyle={styles.listContent}
                        inverted
                        onEndReached={() => hasMore && fetchMore()}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={loadingMore ? <ActivityIndicator color="#FF2D55" style={{ margin: 20 }} /> : null}
                        showsVerticalScrollIndicator={false}
                    />

                    {typingUsers.length > 0 && (
                        <View style={styles.typingContainer}>
                            <Text style={styles.typingText}>
                                {typingUsers.map(u => u.name).join(', ')} typing...
                            </Text>
                        </View>
                    )}
                </View>

                {replyTo && (
                    <View style={styles.replyBar}>
                        <View style={styles.replyBarInner}>
                            <View style={styles.replyBarIndicator} />
                            <View style={styles.replyBarContent}>
                                <Text style={styles.replyBarUser}>{replyTo.profiles?.name || 'Member'}</Text>
                                <Text style={styles.replyBarText} numberOfLines={1}>{replyTo.content || 'Image'}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setReplyTo(null)}>
                                <Ionicons name="close-circle" size={20} color="#888" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                <View style={[styles.inputWrapper, { paddingBottom: Math.max(insets.bottom, 10) }]}>
                    <View style={styles.inputContainer}>
                        <TouchableOpacity style={styles.attachBtn} onPress={() => { }} disabled={uploading}>
                            <Ionicons name="add" size={28} color="#FF2D55" />
                        </TouchableOpacity>
                        <TextInput
                            style={[styles.input, { maxHeight: 120 }]}
                            placeholder="Type a message..."
                            placeholderTextColor="#888"
                            value={newMessage}
                            onChangeText={(text) => {
                                setNewMessage(text);
                                setTyping(text.length > 0);
                            }}
                            multiline
                        />
                        <TouchableOpacity
                            style={[styles.sendButton, !newMessage.trim() && !uploading && styles.sendDisabled]}
                            onPress={handleSend}
                            disabled={!newMessage.trim() && !uploading}
                        >
                            <LinearGradient colors={['#FF2D55', '#D40035']} style={styles.sendGradient}>
                                <Ionicons name="send" size={18} color="#fff" />
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>

            <Modal visible={menuVisible} transparent={true} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
                    <View style={styles.menuContainer}>
                        <View style={styles.reactionRow}>
                            {['❤️', '👍', '😂', '😮', '😢', '🙏'].map(emoji => (
                                <TouchableOpacity key={emoji} onPress={() => handleReaction(emoji)} style={styles.reactionBtn}>
                                    <Text style={styles.reactionOption}>{emoji}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TouchableOpacity style={styles.menuItem} onPress={() => { setReplyTo(selectedMessage); setMenuVisible(false); }}>
                            <View style={styles.menuItemIcon}>
                                <Ionicons name="arrow-undo-outline" size={22} color="#fff" />
                            </View>
                            <Text style={styles.menuItemText}>Reply</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.menuItem, styles.deleteItem]} onPress={() => setMenuVisible(false)}>
                            <View style={styles.menuItemIcon}>
                                <Ionicons name="trash-outline" size={22} color="#FF2D55" />
                            </View>
                            <Text style={[styles.menuItemText, { color: '#FF2D55' }]}>Delete Message</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F0F0F' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingBottom: 15,
        backgroundColor: '#1C1C1E',
        borderBottomWidth: 1,
        borderBottomColor: '#2C2C2E',
    },
    backBtn: { marginRight: 15 },
    headerInfo: { flex: 1 },
    roomName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
    onlineStatus: { fontSize: 13, fontWeight: '500' },
    menuBtn: { padding: 5 },
    keyboardAvoidingView: { flex: 1 },
    chatArea: { flex: 1, backgroundColor: '#0F0F0F' },
    listContent: {
        paddingHorizontal: 12,
        paddingBottom: 10,
        paddingTop: 10,
    },
    inputWrapper: {
        backgroundColor: '#1C1C1E',
        borderTopWidth: 1,
        borderTopColor: '#2C2C2E',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 8,
        paddingVertical: 10,
    },
    attachBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        backgroundColor: '#2C2C2E',
        borderRadius: 22,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginHorizontal: 8,
        color: '#fff',
        fontSize: 16,
        lineHeight: 20,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: 'hidden',
    },
    sendDisabled: {
        opacity: 0.5,
    },
    sendGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuContainer: {
        backgroundColor: '#1C1C1E',
        borderRadius: 24,
        width: '85%',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#2C2C2E',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
    },
    menuItemIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    menuItemText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '500',
    },
    deleteItem: {
        borderTopWidth: 1,
        borderTopColor: '#2C2C2E',
    },
    typingContainer: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        backgroundColor: 'rgba(15,15,15,0.8)',
    },
    typingText: {
        fontSize: 13,
        color: '#4CD964',
        fontWeight: '500',
    },
    replyBar: {
        backgroundColor: '#1C1C1E',
        paddingHorizontal: 15,
        paddingTop: 10,
    },
    replyBarInner: {
        flexDirection: 'row',
        backgroundColor: '#2C2C2E',
        borderRadius: 12,
        overflow: 'hidden',
        alignItems: 'center',
        paddingRight: 10,
    },
    replyBarIndicator: {
        width: 4,
        height: '100%',
        backgroundColor: '#FF2D55',
    },
    replyBarContent: {
        flex: 1,
        padding: 10,
    },
    replyBarUser: {
        color: '#FF2D55',
        fontSize: 13,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    replyBarText: {
        color: '#8E8E93',
        fontSize: 13,
    },
    reactionRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingVertical: 20,
        backgroundColor: '#2C2C2E',
    },
    reactionBtn: {
        padding: 5,
    },
    reactionOption: {
        fontSize: 28,
    }
});

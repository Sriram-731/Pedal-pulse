// MessageBubble.tsx - Optimized premium chat bubble with grouping and avatars
import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '../../types/chat';

interface Props {
    message: Message;
    isMine: boolean;
    showName: boolean;
    showTime: boolean;
    showAvatar: boolean;
    isLastInGroup: boolean;
    onLongPress: (message: Message) => void;
    onReplyPress?: (message: Message) => void;
}

const MessageBubble = ({
    message, isMine, showName, showTime, showAvatar, isLastInGroup,
    onLongPress, onReplyPress
}: Props) => {
    const profileName = message.profiles?.name || 'Member';
    const avatarUrl = message.profiles?.avatar_url;

    const renderStatus = () => {
        if (!isMine) return null;

        let iconName: any = 'checkmark';
        let color = 'rgba(255,255,255,0.6)';

        if (message.status === 'delivered') {
            iconName = 'checkmark-done';
        } else if (message.status === 'seen') {
            iconName = 'checkmark-done';
            color = '#4FC3F7'; // Blue ticks
        } else if (message.status === 'sending') {
            iconName = 'time-outline';
        } else if (message.status === 'error') {
            iconName = 'alert-circle';
            color = '#FF3B30';
        }

        return <Ionicons name={iconName} size={14} color={color} style={styles.statusIcon} />;
    };

    const renderReactions = () => {
        if (!message.reactions || message.reactions.length === 0) return null;

        const counts = message.reactions.reduce((acc: any, r) => {
            acc[r.emoji] = (acc[r.emoji] || 0) + 1;
            return acc;
        }, {});

        return (
            <View style={[styles.reactionsContainer, isMine ? styles.myReactions : styles.theirReactions]}>
                {Object.keys(counts).map(emoji => (
                    <View key={emoji} style={styles.reactionBadge}>
                        <Text style={styles.reactionEmoji}>{emoji}</Text>
                        {counts[emoji] > 1 && <Text style={styles.reactionCount}>{counts[emoji]}</Text>}
                    </View>
                ))}
            </View>
        );
    };

    const renderReply = () => {
        if (!message.reply_to) return null;

        return (
            <View style={styles.replyPreview}>
                <View style={styles.replyBar} />
                <View style={styles.replyContent}>
                    <Text style={styles.replySender} numberOfLines={1}>
                        {message.reply_to.profiles?.name || 'Member'}
                    </Text>
                    <Text style={styles.replyText} numberOfLines={1}>
                        {message.reply_to.content || (message.reply_to.media_url ? '📷 Image' : 'Message')}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <View style={[
            styles.wrapper,
            showTime && styles.wrapperWithTime,
            !isLastInGroup && styles.groupedWrapper
        ]}>
            {showTime && (
                <View style={styles.timeContainer}>
                    <Text style={styles.timestamp}>
                        {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            )}

            <View style={[styles.contentRow, isMine ? styles.myContentRow : styles.theirContentRow]}>
                {!isMine && (
                    <View style={styles.avatarSpace}>
                        {showAvatar ? (
                            <Image source={{ uri: avatarUrl || 'https://via.placeholder.com/150' }} style={styles.avatar} />
                        ) : null}
                    </View>
                )}

                <View style={[styles.bubbleContainer, isMine ? styles.myContainer : styles.theirContainer]}>
                    {showName && !isMine && (
                        <Text style={styles.senderName}>{profileName}</Text>
                    )}

                    <TouchableOpacity
                        activeOpacity={0.9}
                        onLongPress={() => onLongPress(message)}
                        style={[
                            styles.bubble,
                            isMine ? styles.myBubble : styles.theirBubble,
                            !isLastInGroup && (isMine ? styles.myBubbleTail : styles.theirBubbleTail),
                            message.media_url && styles.imageBubble
                        ]}
                    >
                        <LinearGradient
                            colors={isMine ? ['#FF2D55', '#D40035'] : ['#2C2C2E', '#1C1C1E']}
                            style={StyleSheet.absoluteFill}
                        />

                        {renderReply()}

                        {message.media_url && (
                            <Image source={{ uri: message.media_url }} style={styles.image} />
                        )}

                        {message.content ? (
                            <View style={styles.messageRow}>
                                <Text style={styles.text}>
                                    {message.content}
                                </Text>
                                <View style={styles.statusContainer}>
                                    {isMine && renderStatus()}
                                </View>
                            </View>
                        ) : (
                            isMine && <View style={styles.imageStatus}>{renderStatus()}</View>
                        )}
                    </TouchableOpacity>
                    {renderReactions()}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        width: '100%',
        marginBottom: 8,
    },
    groupedWrapper: {
        marginBottom: 2,
    },
    wrapperWithTime: {
        marginTop: 16,
    },
    contentRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    myContentRow: {
        justifyContent: 'flex-end',
    },
    theirContentRow: {
        justifyContent: 'flex-start',
    },
    avatarSpace: {
        width: 35,
        alignItems: 'center',
        marginRight: 8,
    },
    avatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#2C2C2E',
    },
    bubbleContainer: {
        maxWidth: '80%',
    },
    myContainer: {
        alignItems: 'flex-end',
    },
    theirContainer: {
        alignItems: 'flex-start',
    },
    bubble: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 20,
        overflow: 'hidden',
        minWidth: 60,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
    },
    myBubble: {
        borderBottomRightRadius: 20,
    },
    theirBubble: {
        borderBottomLeftRadius: 20,
    },
    myBubbleTail: {
        borderBottomRightRadius: 4,
    },
    theirBubbleTail: {
        borderBottomLeftRadius: 4,
    },
    imageBubble: {
        padding: 4,
    },
    text: {
        fontSize: 16,
        color: '#fff',
        lineHeight: 22,
    },
    senderName: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#FF2D55',
        marginLeft: 4,
        marginBottom: 4,
    },
    timeContainer: {
        alignItems: 'center',
        marginVertical: 12,
    },
    timestamp: {
        fontSize: 11,
        color: '#666',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        overflow: 'hidden',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    messageRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        flexWrap: 'wrap',
    },
    statusContainer: {
        marginLeft: 6,
        marginBottom: -2,
    },
    statusIcon: {
        marginLeft: 2,
    },
    image: {
        width: 260,
        height: 180,
        borderRadius: 16,
        marginBottom: 4,
    },
    imageStatus: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 10,
        paddingHorizontal: 4,
        paddingVertical: 2,
    },
    reactionsContainer: {
        flexDirection: 'row',
        marginTop: -10,
        backgroundColor: '#1C1C1E',
        borderRadius: 14,
        padding: 2,
        borderWidth: 1.5,
        borderColor: '#0F0F0F',
    },
    myReactions: {
        marginRight: 4,
    },
    theirReactions: {
        marginLeft: 4,
    },
    reactionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    reactionEmoji: {
        fontSize: 13,
    },
    reactionCount: {
        fontSize: 11,
        color: '#8E8E93',
        marginLeft: 3,
        fontWeight: '500',
    },
    replyPreview: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0,0,0,0.15)',
        borderRadius: 10,
        marginBottom: 8,
        overflow: 'hidden',
    },
    replyBar: {
        width: 4,
        backgroundColor: '#FF2D55',
    },
    replyContent: {
        padding: 8,
        flex: 1,
    },
    replySender: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#FF2D55',
        marginBottom: 2,
    },
    replyText: {
        fontSize: 13,
        color: '#BBB',
    }
});

export default memo(MessageBubble);

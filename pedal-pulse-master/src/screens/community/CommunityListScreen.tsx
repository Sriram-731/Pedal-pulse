import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface Community {
    id: string;
    name: string;
    description: string;
    admin_id: string;
    member_count?: number;
}

export default function CommunityListScreen({ navigation }: any) {
    const [communities, setCommunities] = useState<Community[]>([]);
    const [joinedIds, setJoinedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [joiningId, setJoiningId] = useState<string | null>(null);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteCode, setInviteCode] = useState('');
    const [joiningByCode, setJoiningByCode] = useState(false);
    const user = useAuthStore((state) => state.user);

    useEffect(() => {
        fetchData();

        // Real-time subscriptions for Communities
        const communitySub = supabase
            .channel('community_list_realtime')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'communities'
            }, () => {
                fetchCommunities();
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'community_members',
                filter: `user_id=eq.${user?.id}`
            }, () => {
                fetchUserMemberships();
            })
            .subscribe();

        return () => {
            communitySub.unsubscribe();
        };
    }, [user]);

    const fetchData = async () => {
        setLoading(true);
        await Promise.all([fetchCommunities(), fetchUserMemberships()]);
        setLoading(false);
    };

    const fetchCommunities = async () => {
        const { data, error } = await supabase
            .from('communities')
            .select('*');

        if (error) {
            console.error('Fetch communities error:', error);
        } else {
            setCommunities(data as Community[]);
        }
    };

    const fetchUserMemberships = async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from('community_members')
            .select('community_id')
            .eq('user_id', user.id);

        if (error) {
            console.error('Fetch memberships error:', error);
        } else if (data) {
            setJoinedIds(data.map(m => m.community_id));
        }
    };

    const handleJoin = async (communityId: string) => {
        if (!user) return;
        setJoiningId(communityId);

        try {
            const { error } = await supabase
                .from('community_members')
                .upsert({ community_id: communityId, user_id: user.id });

            if (error) {
                if (error.code === '23505') {
                    Alert.alert('Already a member', 'You are already in this community.');
                    setJoinedIds(prev => [...new Set([...prev, communityId])]);
                } else {
                    console.error('Join error:', error);
                    Alert.alert('Error', error.message);
                }
            } else {
                // Find community chats and add participant
                const { data: rooms } = await supabase
                    .from('chat_rooms')
                    .select('id')
                    .eq('community_id', communityId);

                if (rooms && rooms.length > 0) {
                    const participants = rooms.map(r => ({ room_id: r.id, user_id: user.id }));
                    await supabase.from('chat_participants').upsert(participants);
                }

                setJoinedIds(prev => [...prev, communityId]);
                Alert.alert('Joined!', 'You are now a member. Check your chats for the community hub.');
            }
        } catch (err: any) {
            console.error('Unexpected join error:', err);
            Alert.alert('Error', 'An unexpected error occurred. Please try again.');
        } finally {
            setJoiningId(null);
        }
    };

    const handleJoinByCode = async () => {
        if (!user || !inviteCode.trim()) return;
        setJoiningByCode(true);

        try {
            // 1. Find the community by invite code
            const { data: community, error: fetchError } = await supabase
                .from('communities')
                .select('id, name, is_invite_active')
                .eq('invite_code', inviteCode.trim())
                .single();

            if (fetchError || !community) {
                Alert.alert('Invalid Code', 'No active community found with this invite code.');
                setJoiningByCode(false);
                return;
            }

            if (!community.is_invite_active) {
                Alert.alert('Invite Inactive', 'The invites for this community have been disabled.');
                setJoiningByCode(false);
                return;
            }

            // 2. Perform the join
            await handleJoin(community.id);

            setShowInviteModal(false);
            setInviteCode('');
        } catch (error: any) {
            Alert.alert('Error', 'Could not process invite code.');
        } finally {
            setJoiningByCode(false);
        }
    };

    const openCommunityDashboard = (communityId: string) => {
        navigation.navigate('CommunityDashboard', { communityId });
    };

    const renderItem = ({ item }: { item: Community }) => {
        const isAdmin = item.admin_id === user?.id;
        const isJoined = joinedIds.includes(item.id);
        const isJoining = joiningId === item.id;

        return (
            <TouchableOpacity
                style={styles.communityCard}
                activeOpacity={0.9}
                onPress={() => {
                    if (isJoined) {
                        openCommunityDashboard(item.id);
                    } else {
                        navigation.navigate('CommunityPreview', { communityId: item.id });
                    }
                }}
            >
                <View style={styles.cardHeader}>
                    <LinearGradient
                        colors={['#FF2D55', '#D40035']}
                        style={styles.communityAvatar}
                    >
                        <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                    </LinearGradient>
                    <View style={styles.headerInfo}>
                        <View style={styles.titleRow}>
                            <Text style={styles.communityName}>{item.name}</Text>
                            {isAdmin && (
                                <View style={styles.adminBadge}>
                                    <Text style={styles.adminText}>ADMIN</Text>
                                </View>
                            )}
                            {isJoined && !isAdmin && (
                                <View style={styles.memberBadge}>
                                    <Text style={styles.memberBadgeText}>MEMBER</Text>
                                </View>
                            )}
                        </View>
                        <Text style={styles.communityDesc} numberOfLines={2}>
                            {item.description || 'No description provided.'}
                        </Text>
                    </View>
                </View>

                <View style={styles.actionRow}>
                    {!isJoined ? (
                        <TouchableOpacity
                            style={[styles.joinButton, isJoining && { opacity: 0.7 }]}
                            onPress={() => handleJoin(item.id)}
                            activeOpacity={0.8}
                            disabled={isJoining}
                        >
                            <LinearGradient
                                colors={['#FF2D55', '#D40035']}
                                style={styles.joinGradient}
                            >
                                <Text style={styles.joinText}>{isJoining ? 'Joining...' : 'Join Club'}</Text>
                                {isJoining ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Ionicons name="add" size={20} color="#fff" />
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.viewChatBtn}
                            onPress={() => openCommunityDashboard(item.id)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.viewChatContent}>
                                <Text style={styles.viewChatText}>Open Dashboard</Text>
                                <Ionicons name="apps" size={20} color="#FF2D55" />
                            </View>
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0F0F' }}>
            <View style={styles.container}>
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color="#FF2D55" />
                    </TouchableOpacity>
                    <Text style={styles.header}>Clubs</Text>
                    <TouchableOpacity onPress={() => setShowInviteModal(true)} style={styles.addBtn}>
                        <Ionicons name="qr-code-outline" size={24} color="#FF2D55" />
                    </TouchableOpacity>
                </View>

                {/* Invite Modal */}
                <Modal visible={showInviteModal} transparent animationType="fade">
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Have an Invite Code?</Text>
                            <Text style={styles.modalSub}>Enter the 12-character hex code to join a private club.</Text>

                            <TextInput
                                style={styles.inviteInput}
                                placeholder="Paste code here..."
                                placeholderTextColor="#8E8E93"
                                value={inviteCode}
                                onChangeText={setInviteCode}
                                autoCapitalize="none"
                            />

                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={[styles.modalBtn, { backgroundColor: '#2C2C2E' }]}
                                    onPress={() => setShowInviteModal(false)}
                                >
                                    <Text style={styles.modalBtnText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalBtn, { backgroundColor: '#FF2D55' }, (!inviteCode.trim() || joiningByCode) && { opacity: 0.5 }]}
                                    onPress={handleJoinByCode}
                                    disabled={!inviteCode.trim() || joiningByCode}
                                >
                                    {joiningByCode ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.modalBtnText}>Join</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {loading ? (
                    <ActivityIndicator size="large" color="#FF2D55" style={{ marginTop: 100 }} />
                ) : (
                    <FlatList
                        data={communities}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        extraData={joinedIds}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
                        refreshing={loading}
                        onRefresh={fetchData}
                    />
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F0F0F',
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        marginBottom: 20,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#1C1C1E',
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff'
    },
    addBtn: {
        padding: 5,
    },
    communityCard: {
        backgroundColor: '#1C1C1E',
        borderRadius: 24,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#2C2C2E',
    },
    cardHeader: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    communityAvatar: {
        width: 60,
        height: 60,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    avatarText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff'
    },
    headerInfo: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        marginBottom: 4,
    },
    communityName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginRight: 8,
    },
    adminBadge: {
        backgroundColor: 'rgba(255, 45, 85, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginRight: 5,
    },
    adminText: {
        color: '#FF2D55',
        fontSize: 10,
        fontWeight: 'bold',
    },
    memberBadge: {
        backgroundColor: 'rgba(76, 217, 100, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    memberBadgeText: {
        color: '#4CD964',
        fontSize: 10,
        fontWeight: 'bold',
    },
    communityDesc: {
        fontSize: 14,
        color: '#888',
        lineHeight: 20,
    },
    actionRow: {
        marginTop: 5,
    },
    joinButton: {
        borderRadius: 14,
        overflow: 'hidden',
    },
    joinGradient: {
        flexDirection: 'row',
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    joinText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
        marginRight: 8,
    },
    viewChatBtn: {
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#2C2C2E',
        backgroundColor: '#0F0F0F',
        overflow: 'hidden',
    },
    viewChatContent: {
        flexDirection: 'row',
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    viewChatText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
        marginRight: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1C1C1E',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 25,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 25,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    inputLabel: {
        fontSize: 12,
        color: '#666',
        fontWeight: '700',
        marginBottom: 8,
        letterSpacing: 1,
    },
    input: {
        backgroundColor: '#0F0F0F',
        borderRadius: 15,
        padding: 15,
        fontSize: 16,
        color: '#fff',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#2C2C2E',
    },
    modalSub: {
        color: '#8E8E93',
        fontSize: 14,
        marginBottom: 20,
        lineHeight: 20
    },
    inviteInput: {
        backgroundColor: '#0F0F0F',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#fff',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#2C2C2E',
        textAlign: 'center',
        letterSpacing: 2,
        fontWeight: 'bold'
    },
    modalActions: {
        flexDirection: 'row',
        gap: 15
    },
    modalBtn: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center'
    },
    modalBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold'
    },
    createBtn: {
        borderRadius: 15,
        height: 55,
        overflow: 'hidden',
        marginTop: 10,
    },
    createGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    createBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    }
});

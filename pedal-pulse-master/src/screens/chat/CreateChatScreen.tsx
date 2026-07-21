import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../store/useAuthStore';

type ChatType = 'direct' | 'group' | 'community';

export default function CreateChatScreen({ navigation }: any) {
    const user = useAuthStore(state => state.user);
    const [name, setName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<{ id: string, name: string }[]>([]);
    const [description, setDescription] = useState('');
    const [type, setType] = useState<ChatType>('group');
    const [loading, setLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);

    const searchUser = async () => {
        if (!searchQuery.trim()) return;
        setSearchLoading(true);

        const { data: profiles, error: profileErr } = await supabase
            .from('profiles')
            .select('id, name, email')
            .ilike('email', `%${searchQuery.trim()}%`)
            .limit(5);

        setSearchLoading(false);

        if (profileErr || !profiles || profiles.length === 0) {
            Alert.alert('Not Found', 'Could not find a user matching that email.');
            return;
        }

        const foundUser = profiles[0];

        if (foundUser.id === user?.id) {
            Alert.alert('Error', 'You cannot add yourself.');
            return;
        }

        if (selectedUsers.find(u => u.id === foundUser.id)) {
            Alert.alert('Duplicate', 'User is already added.');
            return;
        }

        if (type === 'direct' && selectedUsers.length >= 1) {
            Alert.alert('Limit Reached', 'Direct chats can only have one other person.');
            return;
        }

        setSelectedUsers(prev => [...prev, { id: foundUser.id, name: foundUser.name }]);
        setSearchQuery('');
    };

    const removeUser = (id: string) => {
        setSelectedUsers(prev => prev.filter(u => u.id !== id));
    };

    const generateUUID = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            let r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };

    const handleCreate = async () => {
        if (!user) return;
        setLoading(true);

        try {
            let communityId = null;

            // 1. Validation for Direct Chat (Friend)
            if (type === 'direct') {
                if (selectedUsers.length === 0) {
                    Alert.alert('Error', 'Please add a friend to start a chat.');
                    setLoading(false);
                    return;
                }
            }

            // 2. Logic for Club Chat (Create Community first)
            if (type === 'community') {
                if (!name.trim()) {
                    Alert.alert('Error', 'Please provide a name for the Club.');
                    setLoading(false);
                    return;
                }

                const { data: community, error: commErr } = await supabase
                    .from('communities')
                    .insert({
                        name: name.trim(),
                        description: description.trim() || 'Official club chat',
                        admin_id: user.id
                    })
                    .select()
                    .single();

                if (commErr || !community) {
                    throw new Error(commErr?.message || 'Failed to create Club');
                }
                communityId = community.id;

                // Auto-join community (Use upsert to prevent conflict with triggers)
                await supabase.from('community_members').upsert({
                    community_id: communityId,
                    user_id: user.id
                });
            }

            // 3. Validation for Group Chat
            if (type === 'group' && !name.trim()) {
                Alert.alert('Error', 'Please provide a name for the group.');
                setLoading(false);
                return;
            }

            // 4. Create Chat Room
            const finalRoomName = type === 'direct' ? null : name.trim();
            const roomId = generateUUID();

            const { error: roomError } = await supabase
                .from('chat_rooms')
                .insert({
                    id: roomId,
                    type,
                    name: finalRoomName,
                    community_id: communityId,
                    created_by: user.id
                });

            if (roomError) {
                throw new Error(roomError.message || 'Failed to create room');
            }

            // 5. Add Participants
            // Note: For 'community' type, database triggers automatically add the admin and existing members.
            // We use upsert here to ensure no "duplicate key" error if the trigger beats the frontend.
            const participantsPayload: any[] = [{ room_id: roomId, user_id: user.id, role: 'owner' }];

            if (type === 'direct' || type === 'group') {
                selectedUsers.forEach(u => {
                    participantsPayload.push({ room_id: roomId, user_id: u.id, role: 'member' });
                });
            } else if (type === 'community' && selectedUsers.length > 0) {
                // For communities, we add selected users as community members
                // The database trigger will then auto-add them to the chat
                const membersPayload = selectedUsers.map(u => ({
                    community_id: communityId,
                    user_id: u.id
                }));
                await supabase.from('community_members').upsert(membersPayload);
            }

            if (type === 'direct' || type === 'group') {
                const { error: partError } = await supabase
                    .from('chat_participants')
                    .insert(participantsPayload);

                if (partError) {
                    throw new Error(partError.message);
                }
            } else {
                // For communities, we already added them to community_members,
                // and the backend trigger automatically provisions chat_participants.
                // However, we should explicitly update the creator to 'owner' if needed via a separate call,
                // but since they just created it, the trigger might make them a 'member'. 
                // We'll let the community_members trigger handle it for now to avoid RLS Upsert clashes.
            }

            navigation.goBack();
        } catch (err: any) {
            Alert.alert('Creation Failed', err.message);
        } finally {
            setLoading(false);
        }
    };

    const TypeTile = ({ t, icon, label }: { t: ChatType, icon: any, label: string }) => (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setType(t)}
            style={[styles.tile, type === t && styles.tileActive]}
        >
            <LinearGradient
                colors={type === t ? ['#FF2D55', '#D40035'] : ['#1C1C1E', '#1C1C1E']}
                style={styles.tileGradient}
            >
                <Ionicons name={icon} size={28} color={type === t ? '#fff' : '#888'} />
                <Text style={[styles.tileText, type === t && styles.tileTextActive]}>{label}</Text>
            </LinearGradient>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0F0F' }}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <ScrollView contentContainerStyle={styles.container}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                            <Ionicons name="chevron-back" size={24} color="#FF2D55" />
                        </TouchableOpacity>
                        <Text style={styles.header}>New Session</Text>
                        <View style={{ width: 44 }} />
                    </View>

                    <View style={styles.tileContainer}>
                        <TypeTile t="direct" icon="person" label="Friend" />
                        <TypeTile t="group" icon="people" label="Group" />
                        <TypeTile t="community" icon="shield-checkmark" label="Club" />
                    </View>

                    <View style={styles.card}>
                        {(type === 'direct' || type === 'group') && (
                            <>
                                <Text style={styles.label}>FIND FRIENDS (BY EMAIL)</Text>
                                <View style={styles.searchContainer}>
                                    <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                                    <TextInput
                                        style={styles.searchInput}
                                        placeholder="friend@example.com"
                                        placeholderTextColor="#444"
                                        value={searchQuery}
                                        onChangeText={setSearchQuery}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                        onSubmitEditing={searchUser}
                                        returnKeyType="search"
                                    />
                                    {searchLoading ? (
                                        <ActivityIndicator size="small" color="#FF2D55" />
                                    ) : (
                                        <TouchableOpacity style={styles.addBtn} onPress={searchUser}>
                                            <Ionicons name="add" size={24} color="#FF2D55" />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {selectedUsers.length > 0 && (
                                    <View style={styles.selectedContainer}>
                                        {selectedUsers.map(u => (
                                            <View key={u.id} style={styles.userPill}>
                                                <Text style={styles.userPillText}>{u.name}</Text>
                                                <TouchableOpacity onPress={() => removeUser(u.id)}>
                                                    <Ionicons name="close-circle" size={18} color="#888" style={{ marginLeft: 6 }} />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {type === 'direct' && <Text style={styles.hint}>Start a private conversation with a friend.</Text>}
                            </>
                        )}

                        {type === 'group' && (
                            <>
                                <Text style={styles.label}>GROUP NAME</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. Weekend Crew"
                                    placeholderTextColor="#444"
                                    value={name}
                                    onChangeText={setName}
                                    autoFocus
                                />
                                <Text style={styles.hint}>Create a private group for multiple riders.</Text>
                            </>
                        )}

                        {type === 'community' && (
                            <>
                                <Text style={styles.label}>CLUB NAME</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. Pedal Masters"
                                    placeholderTextColor="#444"
                                    value={name}
                                    onChangeText={setName}
                                    autoFocus
                                />
                                <Text style={styles.label}>DESCRIPTION</Text>
                                <TextInput
                                    style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                    placeholder="What is this club about?"
                                    placeholderTextColor="#444"
                                    multiline
                                    value={description}
                                    onChangeText={setDescription}
                                />
                                <Text style={styles.hint}>Creating a club session will launch a new public community chat.</Text>
                            </>
                        )}
                    </View>

                    <TouchableOpacity
                        activeOpacity={0.9}
                        style={[styles.createBtn, loading && { opacity: 0.7 }]}
                        onPress={handleCreate}
                        disabled={loading}
                    >
                        <LinearGradient
                            colors={['#FF2D55', '#D40035']}
                            style={styles.createGradient}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.createBtnText}>Launch Session</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 25,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#1C1C1E',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2C2C2E',
    },
    header: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff'
    },
    tileContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
    },
    tile: {
        flex: 1,
        height: 100,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#2C2C2E',
    },
    tileActive: {
        borderColor: '#FF2D55',
    },
    tileGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tileText: {
        color: '#666',
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    tileTextActive: {
        color: '#fff',
    },
    card: {
        backgroundColor: '#1C1C1E',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: '#2C2C2E',
        marginBottom: 30,
    },
    label: {
        fontSize: 12,
        color: '#666',
        fontWeight: '700',
        marginBottom: 15,
        letterSpacing: 1,
    },
    input: {
        backgroundColor: '#0F0F0F',
        borderRadius: 14,
        padding: 15,
        fontSize: 18,
        color: '#fff',
        borderWidth: 1,
        borderColor: '#2C2C2E',
        marginBottom: 20,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F0F0F',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#2C2C2E',
        paddingHorizontal: 15,
        marginBottom: 15,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        height: 55,
        fontSize: 18,
        color: '#fff',
    },
    hint: {
        color: '#555',
        fontSize: 13,
        lineHeight: 18,
    },
    addBtn: {
        padding: 5,
    },
    selectedContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 20,
    },
    userPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2C2C2E',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#444',
    },
    userPillText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    createBtn: {
        borderRadius: 20,
        height: 65,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#FF2D55',
        shadowOpacity: 0.4,
        shadowRadius: 15,
    },
    createGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    createBtnText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        letterSpacing: 1,
    }
});

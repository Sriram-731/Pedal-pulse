// MembersListScreen.tsx - Searchable paginated list of all member participants
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';

interface Member {
    user_id: string;
    role: string;
    profiles: { name: string; avatar_url: string; };
}

export default function MembersListScreen({ route, navigation }: any) {
    const { roomId, roomName } = route.params;
    const insets = useSafeAreaInsets();

    const [members, setMembers] = useState<Member[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMembers();
    }, [search]);

    const fetchMembers = async () => {
        setLoading(true);
        let query = supabase
            .from('chat_participants')
            .select('user_id, role, profiles!inner(name, avatar_url)')
            .eq('room_id', roomId)
            .limit(50);

        if (search.trim()) {
            // Text search on the joined profile name (requires inner join)
            query = query.ilike('profiles.name', `%${search.trim()}%`);
        }

        const { data, error } = await query;
        if (!error && data) {
            setMembers(data as any);
        }
        setLoading(false);
    };

    const renderItem = ({ item }: { item: Member }) => (
        <View style={styles.memberRow}>
            <View style={styles.memberAvatar}>
                {item.profiles?.avatar_url ? (
                    <Image source={{ uri: item.profiles.avatar_url }} style={styles.memberAvatarImg} />
                ) : (
                    <Ionicons name="person" size={20} color="#fff" />
                )}
            </View>
            <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{item.profiles?.name || 'Member'}</Text>
            </View>
            {item.role !== 'member' && (
                <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>{item.role === 'owner' ? 'Owner' : 'Admin'}</Text>
                </View>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={28} color="#FF2D55" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{roomName} Members</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search participants..."
                    placeholderTextColor="#8E8E93"
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            {loading && !members.length ? (
                <ActivityIndicator color="#FF2D55" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={members}
                    keyExtractor={item => item.user_id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={<Text style={styles.emptyText}>No members found</Text>}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 15, backgroundColor: '#111' },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
    backBtn: { padding: 5, marginLeft: -5 },

    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1c1c1e', margin: 15, borderRadius: 10, paddingHorizontal: 15 },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, color: '#fff', paddingVertical: 12, fontSize: 16 },

    listContent: { paddingBottom: 30 },
    memberRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#111' },
    memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    memberAvatarImg: { width: '100%', height: '100%', borderRadius: 20 },
    memberInfo: { flex: 1 },
    memberName: { color: '#fff', fontSize: 16 },
    roleBadge: { backgroundColor: '#FF2D5520', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    roleText: { color: '#FF2D55', fontSize: 11, fontWeight: '600' },
    emptyText: { color: '#888', textAlign: 'center', marginTop: 40, fontSize: 16 },
});

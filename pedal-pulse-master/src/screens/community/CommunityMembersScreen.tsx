import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCommunityStore } from '../../store/useCommunityStore';
import { useAuthStore } from '../../store/useAuthStore';

export default function CommunityMembersScreen({ route, navigation }: any) {
    const { communityId } = route.params;
    const user = useAuthStore(state => state.user);
    const { members, fetchMembers } = useCommunityStore();

    const [searchQuery, setSearchQuery] = useState('');

    const communityMembers = members[communityId] || [];
    const myRole = communityMembers.find(m => m.user_id === user?.id)?.role || 'member';

    useEffect(() => {
        fetchMembers(communityId);
    }, [communityId]);

    const filteredMembers = communityMembers.filter(m =>
        (m.profiles?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getRoleBorderColor = (role: string) => {
        switch (role) {
            case 'owner': return '#FFD60A'; // Yellow/Gold
            case 'admin': return '#FF375F'; // Red
            case 'moderator': return '#5E5CE6'; // Purple
            default: return 'transparent'; // Regular Members don't get a strict border
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={styles.memberRow}
            activeOpacity={0.8}
            onPress={() => {
                // If I have higher rank, potentially open bottom sheet for moderation options
                if (['owner', 'admin'].includes(myRole) && item.user_id !== user?.id) {
                    console.log('Open moderation for user', item.profiles?.name);
                }
            }}
        >
            <View style={[styles.avatarWrapper, { borderColor: getRoleBorderColor(item.role), borderWidth: item.role !== 'member' ? 2 : 0 }]}>
                <Image
                    source={{ uri: item.profiles?.avatar_url || 'https://images.unsplash.com/photo-1541625602330-2277a4c4b282?w=100' }}
                    style={styles.avatar}
                />
            </View>
            <View style={styles.infoCol}>
                <View style={styles.nameRow}>
                    <Text style={styles.name}>{item.profiles?.name}</Text>
                    {item.role !== 'member' && (
                        <View style={[styles.roleBadge, { backgroundColor: getRoleBorderColor(item.role) + '20' }]}>
                            <Text style={[styles.roleText, { color: getRoleBorderColor(item.role) }]}>
                                {item.role.toUpperCase()}
                            </Text>
                        </View>
                    )}
                </View>
                <Text style={styles.joinedText}>Joined {new Date(item.joined_at).toLocaleDateString()}</Text>
            </View>

            {/* Moderation icon visible strictly to high-ranks targeting lower ranks */}
            {['owner', 'admin'].includes(myRole) && item.user_id !== user?.id && item.role !== 'owner' && (
                <Ionicons name="ellipsis-vertical" size={20} color="#8E8E93" />
            )}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Members</Text>
                <View style={styles.backBtn} />
            </View>

            <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name..."
                    placeholderTextColor="#8E8E93"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            <FlatList
                data={filteredMembers}
                keyExtractor={(item) => item.user_id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                initialNumToRender={20}
                maxToRenderPerBatch={20}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F0F0F' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#1C1C1E' },
    backBtn: { width: 40 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', margin: 20, borderRadius: 12, paddingHorizontal: 15, height: 44 },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, color: '#fff', fontSize: 16 },
    listContent: { paddingHorizontal: 20, paddingBottom: 40 },
    memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1C1C1E' },
    avatarWrapper: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    avatar: { width: '100%', height: '100%', borderRadius: 25 },
    infoCol: { flex: 1, justifyContent: 'center' },
    nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    name: { fontSize: 16, fontWeight: '600', color: '#fff', marginRight: 8 },
    roleBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    roleText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
    joinedText: { fontSize: 12, color: '#8E8E93' }
});

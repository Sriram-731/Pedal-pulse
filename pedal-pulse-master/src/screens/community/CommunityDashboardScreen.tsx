import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { useCommunityStore } from '../../store/useCommunityStore';

export default function CommunityDashboardScreen({ route, navigation }: any) {
    const { communityId } = route.params;
    const user = useAuthStore(state => state.user);
    const { communities, members, fetchMembers } = useCommunityStore();

    const [loading, setLoading] = useState(true);

    const community = communities[communityId];
    const communityMembers = members[communityId] || [];
    const myRole = communityMembers.find(m => m.user_id === user?.id)?.role || 'member';

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await fetchMembers(communityId);
            setLoading(false);
        };
        load();
    }, [communityId]);

    if (!user || loading || !community) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#FF2D55" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header Area */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={28} color="#fff" />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={styles.title} numberOfLines={1}>{community.name}</Text>
                    {community.is_verified && (
                        <View style={styles.verifiedPill}>
                            <Ionicons name="checkmark-circle" size={12} color="#4CD964" />
                            <Text style={styles.verifiedText}>Official</Text>
                        </View>
                    )}
                </View>
                <TouchableOpacity onPress={() => { }} style={styles.menuBtn}>
                    <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

                {/* Stats / Info Row */}
                <View style={styles.statsCard}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{communityMembers.length}</Text>
                        <Text style={styles.statLabel}>Members</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{community.visibility === 'public' ? 'Public' : 'Private'}</Text>
                        <Text style={styles.statLabel}>Visibility</Text>
                    </View>
                </View>

                {/* Quick Actions */}
                <Text style={styles.sectionTitle}>Dashboard</Text>
                <View style={styles.actionGrid}>
                    <TouchableOpacity style={styles.actionCard} onPress={() => { }}>
                        <LinearGradient colors={['#2C2C2E', '#1C1C1E']} style={styles.actionGradient}>
                            <Ionicons name="chatbubbles" size={32} color="#FF2D55" />
                            <Text style={styles.actionText}>Group Chat</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('CommunityMembers', { communityId })}>
                        <LinearGradient colors={['#2C2C2E', '#1C1C1E']} style={styles.actionGradient}>
                            <Ionicons name="people" size={32} color="#5E5CE6" />
                            <Text style={styles.actionText}>Members</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionCard} onPress={() => { }}>
                        <LinearGradient colors={['#2C2C2E', '#1C1C1E']} style={styles.actionGradient}>
                            <Ionicons name="calendar" size={32} color="#FF9F0A" />
                            <Text style={styles.actionText}>Events</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    {['owner', 'admin'].includes(myRole) && (
                        <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('CommunitySettings', { communityId })}>
                            <LinearGradient colors={['#2C2C2E', '#1C1C1E']} style={styles.actionGradient}>
                                <Ionicons name="settings" size={32} color="#8E8E93" />
                                <Text style={styles.actionText}>Settings</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Recent Members Preview */}
                <View style={styles.rowHeader}>
                    <Text style={styles.sectionTitle}>Recent Joins</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('CommunityMembers', { communityId })}>
                        <Text style={styles.linkText}>See All</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.memberPreviewList}>
                    {communityMembers.slice(0, 5).map(m => (
                        <View key={m.user_id} style={styles.memberAvatarWrapper}>
                            <Image
                                source={{ uri: m.profiles?.avatar_url || 'https://images.unsplash.com/photo-1541625602330-2277a4c4b282?w=100' }}
                                style={styles.memberAvatar}
                            />
                        </View>
                    ))}
                    {communityMembers.length > 5 && (
                        <View style={[styles.memberAvatarWrapper, styles.memberAvatarMore]}>
                            <Text style={styles.memberMoreText}>+{communityMembers.length - 5}</Text>
                        </View>
                    )}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F0F0F' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#1C1C1E'
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
    menuBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
    title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    verifiedPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4CD96420', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginTop: 4, gap: 4 },
    verifiedText: { color: '#4CD964', fontSize: 10, fontWeight: 'bold' },
    content: { padding: 20 },
    statsCard: { flexDirection: 'row', backgroundColor: '#1C1C1E', borderRadius: 16, padding: 20, marginBottom: 30, borderWidth: 1, borderColor: '#2C2C2E' },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
    statLabel: { fontSize: 12, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: 1 },
    divider: { width: 1, backgroundColor: '#2C2C2E', marginHorizontal: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 15 },
    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginBottom: 30 },
    actionCard: { width: '47%', aspectRatio: 1, borderRadius: 16, overflow: 'hidden' },
    actionGradient: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, borderWidth: 1, borderColor: '#2C2C2E', borderRadius: 16 },
    actionText: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 15 },
    rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    linkText: { color: '#FF2D55', fontSize: 14, fontWeight: '600' },
    memberPreviewList: { flexDirection: 'row', marginTop: 10 },
    memberAvatarWrapper: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#0F0F0F', marginLeft: -10 },
    memberAvatar: { width: '100%', height: '100%', borderRadius: 22 },
    memberAvatarMore: { backgroundColor: '#2C2C2E', justifyContent: 'center', alignItems: 'center' },
    memberMoreText: { color: '#fff', fontSize: 12, fontWeight: 'bold' }
});

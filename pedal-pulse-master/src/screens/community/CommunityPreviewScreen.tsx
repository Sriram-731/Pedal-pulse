// CommunityPreviewScreen.tsx - Public landing page before joining
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { useCommunityStore } from '../../store/useCommunityStore';
import { useAuthStore } from '../../store/useAuthStore';

export default function CommunityPreviewScreen({ route, navigation }: any) {
    const { communityId } = route.params;
    const insets = useSafeAreaInsets();

    const user = useAuthStore(state => state.user);
    const joinCommunity = useCommunityStore(state => state.joinCommunity);
    const joinedCommunities = useCommunityStore(state => state.joinedCommunities);

    const [community, setCommunity] = useState<any>(null);
    const [admins, setAdmins] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);

    const isMember = joinedCommunities.some(c => c.id === communityId);

    useEffect(() => {
        if (isMember) {
            // Already a member? Automatically redirect to dashboard.
            navigation.replace('CommunityDashboard', { communityId });
            return;
        }
        fetchPreviewData();
    }, [communityId, isMember]);

    const fetchPreviewData = async () => {
        setLoading(true);
        // 1. Fetch public community data (requires RLS to allow select for authenticated users)
        const { data: commData } = await supabase
            .from('communities')
            .select('id, name, description, is_verified, visibility, image_url')
            .eq('id', communityId)
            .single();

        if (commData) setCommunity(commData);

        // 2. Fetch admins for public display
        const { data: adminsData } = await supabase
            .from('community_members')
            .select('role, profiles(name, avatar_url)')
            .eq('community_id', communityId)
            .in('role', ['admin', 'owner'])
            .limit(5);

        if (adminsData) setAdmins(adminsData);
        setLoading(false);
    };

    const handleJoin = async () => {
        if (!user) return;
        setJoining(true);

        try {
            await joinCommunity(communityId);
            // Redirection logic handled by useEffect on next render
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Could not join community.');
            setJoining(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center' }]}>
                <ActivityIndicator color="#FF2D55" size="large" />
            </View>
        );
    }

    if (!community) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: '#888' }}>Community not found or private.</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
                    <Text style={{ color: '#FF2D55' }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView bounces={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
                {/* 1. Hero Banner */}
                <View style={styles.bannerContainer}>
                    {community.image_url ? (
                        <Image source={{ uri: community.image_url }} style={styles.bannerImage} />
                    ) : (
                        <View style={styles.bannerPlaceholder}>
                            <Ionicons name="business" size={60} color="#fff" />
                        </View>
                    )}
                    <View style={styles.bannerOverlay} />

                    <TouchableOpacity
                        style={[styles.backBtn, { top: insets.top + 10 }]}
                        onPress={() => navigation.goBack()}
                    >
                        <View style={styles.backBtnBg}>
                            <Ionicons name="chevron-back" size={24} color="#fff" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* 2. Community Info */}
                <View style={styles.infoSection}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title}>{community.name}</Text>
                        {community.is_verified && (
                            <Ionicons name="checkmark-circle" size={24} color="#4FC3F7" style={{ marginLeft: 8 }} />
                        )}
                    </View>
                    <Text style={styles.visibilityText}>
                        <Ionicons name={community.visibility === 'public' ? 'globe-outline' : 'lock-closed'} size={14} />
                        {' '}{community.visibility === 'public' ? 'Public Community' : 'Private Community'}
                    </Text>

                    {community.description ? (
                        <Text style={styles.description}>{community.description}</Text>
                    ) : (
                        <Text style={[styles.description, { fontStyle: 'italic', color: '#666' }]}>
                            No description provided.
                        </Text>
                    )}
                </View>

                {/* 3. Admins List */}
                <View style={styles.adminsSection}>
                    <Text style={styles.sectionTitle}>Community Leaders</Text>
                    <View style={styles.adminList}>
                        {admins.map((admin, idx) => (
                            <View key={idx} style={styles.adminBadge}>
                                <Image
                                    source={{ uri: admin.profiles.avatar_url || 'https://via.placeholder.com/150' }}
                                    style={styles.adminAvatar}
                                />
                                <Text style={styles.adminName} numberOfLines={1}>{admin.profiles.name}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* 4. Rules */}
                <View style={styles.rulesSection}>
                    <Text style={styles.sectionTitle}>Community Guidelines</Text>
                    <View style={styles.ruleItem}>
                        <Ionicons name="shield-checkmark" size={20} color="#888" />
                        <Text style={styles.ruleText}>Be respectful to all members.</Text>
                    </View>
                    <View style={styles.ruleItem}>
                        <Ionicons name="bicycle" size={20} color="#888" />
                        <Text style={styles.ruleText}>Keep discussions cycling-related.</Text>
                    </View>
                    <View style={styles.ruleItem}>
                        <Ionicons name="warning" size={20} color="#888" />
                        <Text style={styles.ruleText}>No spam or self-promotion.</Text>
                    </View>
                </View>

            </ScrollView>

            {/* Sticky Join Button */}
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                <TouchableOpacity
                    style={[styles.joinBtn, joining && { opacity: 0.7 }]}
                    onPress={handleJoin}
                    disabled={joining}
                >
                    {joining ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.joinBtnText}>Join Community</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },

    bannerContainer: { width: '100%', height: 250, position: 'relative' },
    bannerImage: { width: '100%', height: '100%' },
    bannerPlaceholder: { width: '100%', height: '100%', backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' },
    bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
    backBtn: { position: 'absolute', left: 15, zIndex: 10 },
    backBtnBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },

    infoSection: { padding: 20, backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, marginTop: -20 },
    titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    title: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
    visibilityText: { color: '#888', fontSize: 14, marginBottom: 15, fontWeight: '500' },
    description: { color: '#bbb', fontSize: 16, lineHeight: 24 },

    adminsSection: { padding: 20, backgroundColor: '#111', marginTop: 10 },
    sectionTitle: { color: '#FF2D55', fontSize: 14, fontWeight: '700', textTransform: 'uppercase', marginBottom: 15 },
    adminList: { flexDirection: 'row', flexWrap: 'wrap' },
    adminBadge: { alignItems: 'center', marginRight: 20, width: 60 },
    adminAvatar: { width: 50, height: 50, borderRadius: 25, marginBottom: 5, borderWidth: 2, borderColor: '#333' },
    adminName: { color: '#fff', fontSize: 12, textAlign: 'center' },

    rulesSection: { padding: 20, backgroundColor: '#111', marginTop: 10 },
    ruleItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, backgroundColor: '#1c1c1e', padding: 15, borderRadius: 12 },
    ruleText: { color: '#ccc', fontSize: 15, marginLeft: 15, flex: 1 },

    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.8)', padding: 20, borderTopWidth: 1, borderTopColor: '#222' },
    joinBtn: { backgroundColor: '#FF2D55', borderRadius: 15, paddingVertical: 18, alignItems: 'center', shadowColor: '#FF2D55', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
    joinBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});

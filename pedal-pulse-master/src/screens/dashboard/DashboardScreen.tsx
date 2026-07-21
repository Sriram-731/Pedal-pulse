import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { supabase } from '../../config/supabase';

interface RideStats {
    weeklyDistance: number; // meters
    totalRides: number;
}

export default function DashboardScreen({ navigation }: any) {
    const user = useAuthStore((state) => state.user);
    const profile = useAuthStore((state) => state.profile);
    const unreadNotifs = useNotificationStore(s => s.unreadCount);

    const [stats, setStats] = useState<RideStats>({ weeklyDistance: 0, totalRides: 0 });
    const [refreshing, setRefreshing] = useState(false);
    const [featuredCommunities, setFeaturedCommunities] = useState<any[]>([]);
    const [joinedIds, setJoinedIds] = useState<string[]>([]);
    const [joiningId, setJoiningId] = useState<string | null>(null);

    const fetchStats = async () => {
        if (!user) return;

        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);

        const { data: recentRides, error } = await supabase
            .from('rides')
            .select('total_distance')
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .gte('start_time', lastWeek.toISOString());

        if (!error && recentRides) {
            const weeklyDist = recentRides.reduce((acc, ride) => acc + (ride.total_distance || 0), 0);
            const { count } = await supabase
                .from('rides')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('status', 'completed');

            setStats({
                weeklyDistance: weeklyDist,
                totalRides: count || 0
            });
        }
    };

    const fetchFeatured = async () => {
        if (!user) return;

        // Fetch user memberships first to filter
        const { data: memberships } = await supabase
            .from('community_members')
            .select('community_id')
            .eq('user_id', user.id);

        const joined = memberships?.map(m => m.community_id) || [];
        setJoinedIds(joined);

        // Fetch communities and filter out joined ones
        const { data } = await supabase.from('communities').select('*').limit(10);
        if (data) {
            const filtered = data.filter(c => !joined.includes(c.id)).slice(0, 3);
            setFeaturedCommunities(filtered);
        }
    };

    const handleJoin = async (communityId: string) => {
        if (!user) return;
        setJoiningId(communityId);

        try {
            const { error } = await supabase
                .from('community_members')
                .upsert({ community_id: communityId, user_id: user.id });

            if (!error) {
                Alert.alert('Joined!', 'You are now a member of this club.');
                setJoinedIds(prev => [...prev, communityId]);
                setFeaturedCommunities(prev => prev.filter(c => c.id !== communityId));
            } else {
                if (error.code === '23505') {
                    setFeaturedCommunities(prev => prev.filter(c => c.id !== communityId));
                    setJoinedIds(prev => [...prev, communityId]);
                } else {
                    console.error('Join error:', error);
                    Alert.alert('Error', error.message);
                }
            }
        } catch (err) {
            console.error('Unexpected join error:', err);
        } finally {
            setJoiningId(null);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([fetchStats(), fetchFeatured()]);
        setRefreshing(false);
    };

    useEffect(() => {
        fetchStats();
        fetchFeatured();

        // Real-time subscriptions for Dashboard
        const statsSub = supabase
            .channel('dashboard_stats')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'rides',
                filter: `user_id=eq.${user?.id}`
            }, () => {
                fetchStats();
            })
            .subscribe();

        const communitySub = supabase
            .channel('dashboard_communities')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'communities'
            }, () => {
                fetchFeatured();
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'community_members',
                filter: `user_id=eq.${user?.id}`
            }, () => {
                fetchFeatured();
            })
            .subscribe();

        return () => {
            statsSub.unsubscribe();
            communitySub.unsubscribe();
        };
    }, [user]);

    const distanceKm = (stats.weeklyDistance / 1000).toFixed(1);

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0F0F0F' }}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF2D55" />}
            >
                <View style={styles.header}>
                    <View>
                        <Text style={styles.welcomeText}>Welcome back,</Text>
                        <Text style={styles.userName}>{profile?.name?.split(' ')[0] || 'Cyclist'}</Text>
                    </View>
                    <View style={styles.headerRight}>
                        <TouchableOpacity
                            style={styles.notifButton}
                            onPress={() => navigation.navigate('Notifications')}
                        >
                            <Ionicons name="notifications-outline" size={24} color="#fff" />
                            {unreadNotifs > 0 && (
                                <View style={styles.notifBadge}>
                                    <Text style={styles.notifBadgeText}>
                                        {unreadNotifs > 9 ? '9+' : unreadNotifs}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.profileButton} onPress={() => navigation.navigate('Profile')}>
                            {profile?.avatar_url ? (
                                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                            ) : (
                                <LinearGradient
                                    colors={['#FF2D55', '#D40035']}
                                    style={styles.avatarGradient}
                                >
                                    <Text style={styles.avatarText}>{profile?.name?.charAt(0).toUpperCase() || 'U'}</Text>
                                </LinearGradient>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.statsContainer}>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>THIS WEEK</Text>
                        <Text style={styles.statValue}>{distanceKm}<Text style={styles.statUnit}> km</Text></Text>
                        <View style={styles.progressBarBg}>
                            <View style={[styles.progressBarFill, { width: `${Math.min(100, (parseFloat(distanceKm) / 50) * 100)}%` as any }]} />
                        </View>
                    </View>

                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>TOTAL RIDES</Text>
                        <Text style={styles.statValue}>{stats.totalRides}</Text>
                        <Text style={styles.statSubValue}>All time</Text>
                    </View>
                </View>

                {featuredCommunities.length > 0 && (
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Featured Clubs</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('CommunityList')}>
                                <Text style={styles.seeAllText}>See All</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredList}>
                            {featuredCommunities.map((c) => (
                                <View key={c.id} style={styles.featuredCard}>
                                    <LinearGradient
                                        colors={['#FF2D55', '#D40035']}
                                        style={styles.featuredAvatar}
                                    >
                                        <Text style={styles.featuredAvatarText}>{c.name.charAt(0)}</Text>
                                    </LinearGradient>
                                    <Text style={styles.featuredName} numberOfLines={1}>{c.name}</Text>
                                    <TouchableOpacity
                                        style={[styles.featuredJoinBtn, joiningId === c.id && { opacity: 0.7 }]}
                                        onPress={() => handleJoin(c.id)}
                                        disabled={joiningId === c.id}
                                    >
                                        <Text style={styles.featuredJoinText}>
                                            {joiningId === c.id ? '...' : 'Join'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                )}

                <TouchableOpacity activeOpacity={0.9}>
                    <LinearGradient
                        colors={['#1C1C1E', '#121212']}
                        style={styles.heroCard}
                    >
                        <View style={styles.heroContent}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.heroTitle}>Your Next Event</Text>
                                <Text style={styles.heroSubtitle}>Join a community to see upcoming races.</Text>
                            </View>
                            <View style={styles.eventIconContainer}>
                                <Ionicons name="calendar" size={32} color="#FF2D55" />
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => navigation.navigate('EventList')}>
                            <LinearGradient
                                colors={['#FF2D55', '#D40035']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.heroActionBtn}
                            >
                                <Text style={styles.heroActionText}>Explore Events</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.discoveryCard}
                    onPress={() => navigation.navigate('CommunityList')}
                >
                    <View style={styles.discoveryTextContainer}>
                        <Text style={styles.discoveryTitle}>Explore Clubs</Text>
                        <Text style={styles.discoverySubtitle}>Find communities near you and join the conversation.</Text>
                    </View>
                    <View style={styles.arrowContainer}>
                        <Ionicons name="chevron-forward" size={24} color="#FF2D55" />
                    </View>
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F0F0F',
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 40,
        paddingTop: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
        marginTop: 10,
    },
    welcomeText: {
        fontSize: 16,
        color: '#888',
        fontWeight: '500',
    },
    userName: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 4,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    notifButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#1C1C1E',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    notifBadge: {
        position: 'absolute',
        top: 2,
        right: 2,
        backgroundColor: '#FF3B30',
        borderRadius: 9,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    notifBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '800',
    },
    profileButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        overflow: 'hidden',
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    avatarGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 25,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 25,
    },
    statCard: {
        backgroundColor: '#1C1C1E',
        borderRadius: 20,
        padding: 20,
        width: '48%',
        borderWidth: 1,
        borderColor: '#2C2C2E',
    },
    statLabel: {
        fontSize: 12,
        color: '#888',
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 10,
    },
    statValue: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
    },
    statUnit: {
        fontSize: 16,
        color: '#888',
    },
    statSubValue: {
        fontSize: 14,
        color: '#666',
        marginTop: 10,
    },
    progressBarBg: {
        height: 6,
        backgroundColor: '#2C2C2E',
        borderRadius: 3,
        marginTop: 15,
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#FF2D55',
        borderRadius: 3,
    },
    section: {
        marginBottom: 25,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    seeAllText: {
        color: '#FF2D55',
        fontSize: 14,
        fontWeight: '600',
    },
    featuredList: {
        paddingRight: 20,
    },
    featuredCard: {
        backgroundColor: '#1C1C1E',
        borderRadius: 20,
        padding: 15,
        width: 140,
        marginRight: 15,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2C2C2E',
    },
    featuredAvatar: {
        width: 50,
        height: 50,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    featuredAvatarText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    featuredName: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
        marginBottom: 12,
    },
    featuredJoinBtn: {
        backgroundColor: 'rgba(255, 45, 85, 0.1)',
        paddingVertical: 6,
        paddingHorizontal: 20,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 45, 85, 0.2)',
    },
    featuredJoinBtnActive: {
        backgroundColor: '#FF2D55',
    },
    featuredJoinText: {
        color: '#FF2D55',
        fontSize: 12,
        fontWeight: 'bold',
    },
    heroCard: {
        borderRadius: 24,
        padding: 25,
        marginBottom: 25,
        borderWidth: 1,
        borderColor: '#2C2C2E',
        overflow: 'hidden',
    },
    heroContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    heroTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    heroSubtitle: {
        fontSize: 15,
        color: '#aaa',
        lineHeight: 20,
    },
    eventIconContainer: {
        width: 50,
        height: 50,
        borderRadius: 15,
        backgroundColor: 'rgba(255, 45, 85, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 10,
    },
    heroActionBtn: {
        paddingVertical: 12,
        borderRadius: 15,
        alignItems: 'center',
    },
    heroActionText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
    discoveryCard: {
        backgroundColor: '#1C1C1E',
        padding: 20,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 40,
        borderWidth: 1,
        borderColor: '#2C2C2E',
    },
    discoveryTextContainer: {
        flex: 1,
    },
    discoveryTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    discoverySubtitle: {
        fontSize: 14,
        color: '#888',
        lineHeight: 18,
    },
    arrowContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 45, 85, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 15,
    }
});

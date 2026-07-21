import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    ActivityIndicator, Dimensions, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../store/useAuthStore';

const { width } = Dimensions.get('window');

interface ActivitySummary {
    total_distance: number;
    total_time: number;
    total_rides: number;
    avg_speed: number;
}

type FilterType = 'all' | 'personal' | 'group';

export default function DailyActivitiesScreen({ navigation }: any) {
    const user = useAuthStore(state => state.user);
    const [summary, setSummary] = useState<ActivitySummary>({
        total_distance: 0,
        total_time: 0,
        total_rides: 0,
        avg_speed: 0
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [rides, setRides] = useState<any[]>([]);
    const [filter, setFilter] = useState<FilterType>('all');

    const fetchActivities = async () => {
        if (!user) return;
        const { data, error } = await supabase
            .from('rides')
            .select('*, ride_groups(name)')
            .eq('user_id', user.id)
            .eq('status', 'completed')
            .order('start_time', { ascending: false });

        if (error) {
            console.error(error);
        } else if (data) {
            setRides(data);
            calculateSummary(data);
        }
        setLoading(false);
        setRefreshing(false);
    };

    useEffect(() => {
        fetchActivities();
    }, [user]);

    const handleRefresh = useCallback(() => {
        setRefreshing(true);
        fetchActivities();
    }, [user]);

    // Calculate Summary stats from ALL data
    const calculateSummary = (data: any[]) => {
        const totalDist = data.reduce((acc, ride) => acc + (ride.total_distance || 0), 0);
        const totalRides = data.length;
        const avgSpeed = totalRides > 0 ? data.reduce((acc, ride) => acc + (ride.average_speed || 0), 0) / totalRides : 0;

        const totalTime = data.reduce((acc, ride) => {
            const start = new Date(ride.start_time).getTime();
            const end = ride.end_time ? new Date(ride.end_time).getTime() : start;
            return acc + (end - start);
        }, 0) / 1000 / 60;

        setSummary({
            total_distance: totalDist / 1000,
            total_time: Math.round(totalTime),
            total_rides: totalRides,
            avg_speed: Math.round(avgSpeed * 3.6 * 10) / 10
        });
    };

    // Filtered Rides (used for list and charts)
    const filteredRides = useMemo(() => {
        return rides.filter(ride => {
            if (filter === 'personal') return !ride.group_id;
            if (filter === 'group') return !!ride.group_id;
            return true;
        });
    }, [rides, filter]);

    // Chart Data Generation (Last 7 Days)
    const chartData = useMemo(() => {
        // Create last 7 days array
        const days = [];
        const distances = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dayStr = date.toLocaleDateString('en-US', { weekday: 'short' });

            // sum distance for this day using filtered rides
            let sum = 0;
            filteredRides.forEach(r => {
                const rDate = new Date(r.start_time);
                if (
                    rDate.getDate() === date.getDate() &&
                    rDate.getMonth() === date.getMonth() &&
                    rDate.getFullYear() === date.getFullYear()
                ) {
                    sum += (r.total_distance || 0);
                }
            });

            days.push(dayStr);
            distances.push(sum / 1000); // km
        }

        // Return chart kit object
        return {
            labels: days,
            datasets: [{ data: distances }]
        };
    }, [filteredRides]);

    const StatCard = ({ title, value, unit, icon, colors }: any) => (
        <LinearGradient colors={colors} style={styles.statCard}>
            <View style={styles.statIconContainer}>
                <Ionicons name={icon} size={20} color="#fff" />
            </View>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statUnit}>{unit}</Text>
            <Text style={styles.statTitle}>{title}</Text>
        </LinearGradient>
    );

    const FilterTabs = () => (
        <View style={styles.tabContainer}>
            {['all', 'personal', 'group'].map((t) => {
                const isActive = filter === t;
                return (
                    <TouchableOpacity
                        key={t}
                        style={[styles.tabBtn, isActive && styles.tabActive]}
                        onPress={() => setFilter(t as FilterType)}
                    >
                        <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    function formatDuration(startStr: string, endStr?: string) {
        if (!endStr) return '';
        const ms = new Date(endStr).getTime() - new Date(startStr).getTime();
        const mins = Math.floor(ms / 60000);
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        const rem = mins % 60;
        return `${hrs}h ${rem}m`;
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
            <View style={styles.headerRow}>
                <Text style={styles.header}>Activity</Text>
            </View>

            {/* Filter Tabs Sticky */}
            <View style={styles.tabsWrapper}>
                <FilterTabs />
            </View>

            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FF2D55" />
                }
            >
                {loading && !refreshing ? (
                    <ActivityIndicator size="large" color="#FF2D55" style={{ marginTop: 100 }} />
                ) : (
                    <>
                        <View style={styles.statsGrid}>
                            <StatCard
                                title="Distance"
                                value={summary.total_distance.toFixed(1)}
                                unit="km"
                                icon="bicycle"
                                colors={['#FF2D55', '#D40035']}
                            />
                            <StatCard
                                title="Time"
                                value={summary.total_time}
                                unit="min"
                                icon="time"
                                colors={['#5856D6', '#3E3C96']}
                            />
                            <StatCard
                                title="Rides"
                                value={summary.total_rides}
                                unit="total"
                                icon="list"
                                colors={['#FF9500', '#D67E00']}
                            />
                            <StatCard
                                title="Speed"
                                value={summary.avg_speed}
                                unit="km/h"
                                icon="speedometer"
                                colors={['#4CD964', '#28B141']}
                            />
                        </View>

                        {/* Chart Section */}
                        <Text style={styles.sectionTitle}>Past 7 Days</Text>
                        <View style={styles.chartContainer}>
                            <BarChart
                                data={chartData}
                                width={width - 40}
                                height={220}
                                yAxisLabel=""
                                yAxisSuffix="k"
                                showValuesOnTopOfBars={true}
                                fromZero
                                chartConfig={{
                                    backgroundColor: '#1C1C1E',
                                    backgroundGradientFrom: '#1C1C1E',
                                    backgroundGradientTo: '#1C1C1E',
                                    decimalPlaces: 1,
                                    color: (opacity = 1) => `rgba(255, 45, 85, ${opacity})`,
                                    labelColor: (opacity = 1) => `rgba(255, 255, 255, 0.6)`,
                                    barPercentage: 0.6,
                                    barRadius: 6,
                                    propsForBackgroundLines: {
                                        stroke: '#2C2C2E',
                                        strokeDasharray: '0', // solid lines
                                    },
                                    formatTopBarValue: (val) => val === 0 ? '' : Math.round(val).toString()
                                }}
                                style={{
                                    marginVertical: 8,
                                    borderRadius: 16,
                                }}
                            />
                        </View>

                        <Text style={styles.sectionTitle}>
                            {filter === 'all' ? 'Recent Rides' : filter === 'personal' ? 'Personal Rides' : 'Group Rides'}
                        </Text>

                        {filteredRides.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="bicycle-outline" size={60} color="#333" />
                                <Text style={styles.emptyText}>No rides found</Text>
                                <Text style={styles.emptySubtext}>Hit the map and start cycling!</Text>
                            </View>
                        ) : (
                            filteredRides.map((ride) => {
                                const isGroup = !!ride.group_id;
                                const duration = formatDuration(ride.start_time, ride.end_time);
                                return (
                                    <TouchableOpacity
                                        key={ride.id}
                                        style={styles.rideItem}
                                        activeOpacity={0.7}
                                        onPress={() => navigation.navigate('RideDetail', { rideId: ride.id })}
                                    >
                                        <View style={[styles.rideIcon, isGroup && { backgroundColor: 'rgba(88, 86, 214, 0.1)' }]}>
                                            <Ionicons
                                                name={isGroup ? "people" : "bicycle"}
                                                size={20}
                                                color={isGroup ? "#5856D6" : "#FF2D55"}
                                            />
                                        </View>
                                        <View style={styles.rideInfo}>
                                            <Text style={styles.rideTitle}>
                                                {ride.ride_groups?.name || 'Personal Ride'}
                                            </Text>
                                            <View style={styles.rideMetaRow}>
                                                <Ionicons name="calendar-outline" size={12} color="#666" />
                                                <Text style={styles.rideDate}>
                                                    {new Date(ride.start_time).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </Text>
                                                {duration && (
                                                    <>
                                                        <Text style={styles.metaDot}>•</Text>
                                                        <Ionicons name="time-outline" size={12} color="#666" />
                                                        <Text style={styles.rideDate}>{duration}</Text>
                                                    </>
                                                )}
                                            </View>
                                        </View>
                                        <View style={styles.rideStats}>
                                            <Text style={styles.rideValue}>{(ride.total_distance / 1000).toFixed(1)} km</Text>
                                            <Text style={styles.rideSubvalue}>{Math.round(ride.average_speed * 3.6)} km/h</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color="#333" style={{ marginLeft: 8 }} />
                                    </TouchableOpacity>
                                );
                            })
                        )}
                        <View style={{ height: 40 }} />
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0A0A',
    },
    content: {
        padding: 20,
        paddingTop: 10,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 5,
        backgroundColor: '#0A0A0A'
    },
    header: {
        fontSize: 32,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: -0.5,
    },
    tabsWrapper: {
        paddingHorizontal: 20,
        paddingBottom: 10,
        backgroundColor: '#0A0A0A',
        borderBottomWidth: 1,
        borderBottomColor: '#1C1C1E',
        zIndex: 10,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#1C1C1E',
        borderRadius: 12,
        padding: 4,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
    },
    tabActive: {
        backgroundColor: '#333',
    },
    tabText: {
        color: '#888',
        fontWeight: '600',
        fontSize: 14,
    },
    tabTextActive: {
        color: '#fff',
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 25,
    },
    statCard: {
        width: '48%',
        padding: 16,
        borderRadius: 20,
        marginBottom: 15,
    },
    statIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '800',
        color: '#fff',
    },
    statUnit: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.7)',
        fontWeight: '600',
        textTransform: 'uppercase',
        marginTop: 2,
    },
    statTitle: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.9)',
        fontWeight: '500',
        marginTop: 6,
    },
    chartContainer: {
        alignItems: 'center',
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#1C1C1E',
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#fff',
        marginBottom: 15,
    },
    emptyContainer: {
        paddingVertical: 50,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#141414',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#1C1C1E',
    },
    emptyText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginTop: 12,
    },
    emptySubtext: {
        color: '#666',
        fontSize: 14,
        marginTop: 4,
    },
    rideItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#141414',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#202022',
    },
    rideIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 45, 85, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    rideInfo: {
        flex: 1,
    },
    rideTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    rideMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rideDate: {
        color: '#888',
        fontSize: 13,
        marginHorizontal: 4,
    },
    metaDot: {
        color: '#444',
        marginHorizontal: 4,
    },
    rideStats: {
        alignItems: 'flex-end',
    },
    rideValue: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },
    rideSubvalue: {
        color: '#888',
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    }
});

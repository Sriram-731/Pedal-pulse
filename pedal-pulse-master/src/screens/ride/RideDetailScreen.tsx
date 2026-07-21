import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapboxGL from '@maplibre/maplibre-react-native';
import { supabase } from '../../config/supabase';

// Helper to calculate bounding box of coordinates to center map
function getBoundingBox(coords: [number, number][]) {
    if (coords.length === 0) return null;
    let minLat = coords[0][1], maxLat = coords[0][1], minLng = coords[0][0], maxLng = coords[0][0];
    coords.forEach(([lng, lat]) => {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
    });
    return {
        sw: [minLng, minLat],
        ne: [maxLng, maxLat],
    };
}

export default function RideDetailScreen({ route, navigation }: any) {
    const { rideId } = route.params;
    const [ride, setRide] = useState<any>(null);
    const [coordinates, setCoordinates] = useState<[number, number][]>([]);
    const [loading, setLoading] = useState(true);
    const cameraRef = useRef<any>(null);

    useEffect(() => {
        const fetchRideDetails = async () => {
            // Fetch ride metadata
            const { data: rideData, error: rideError } = await supabase
                .from('rides')
                .select('*, ride_groups(name)')
                .eq('id', rideId)
                .single();

            if (rideData) setRide(rideData);

            // Fetch coordinates for polyline
            const { data: routeData, error: routeError } = await supabase
                .from('ride_coordinates')
                .select('location')
                .eq('ride_id', rideId)
                .order('timestamp', { ascending: true });

            if (routeData && routeData.length > 0) {
                // GeoJSON Point extracts 'coordinates' as [lng, lat]
                const coordsArray = routeData.map(r => r.location.coordinates as [number, number]);
                setCoordinates(coordsArray);
            }

            setLoading(false);
        };

        fetchRideDetails();
    }, [rideId]);

    // Fit map to route when coordinates load
    useEffect(() => {
        if (coordinates.length > 0 && cameraRef.current) {
            const bounds = getBoundingBox(coordinates);
            if (bounds) {
                cameraRef.current.fitBounds(bounds.ne, bounds.sw, 40, 1000); // 40px padding, 1s animation
            }
        }
    }, [coordinates]);

    if (loading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FF2D55" />
            </SafeAreaView>
        );
    }

    if (!ride) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <Text style={{ color: '#fff' }}>Ride not found.</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
                    <Text style={{ color: '#FF2D55' }}>Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // Basic map route config
    const routeFeatureCollection: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: coordinates,
                },
            },
        ],
    };

    const isGroup = !!ride.group_id;
    const ms = new Date(ride.end_time).getTime() - new Date(ride.start_time).getTime();
    const durationMins = Math.floor(ms / 60000);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Ride Recap</Text>
                <TouchableOpacity style={styles.shareBtn}>
                    <Ionicons name="share-outline" size={22} color="#fff" />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scroll}>
                <View style={styles.mapContainer}>
                    {coordinates.length > 0 ? (
                        <MapboxGL.MapView
                            style={styles.map}
                            // @ts-ignore - MapLibre uses styleURL but types are sometimes outdated
                            styleURL="mapbox://styles/mapbox/dark-v11"
                            logoEnabled={false}
                            attributionEnabled={false}
                            pitchEnabled={false}
                            rotateEnabled={false}
                            scrollEnabled={false} // Make it static like a preview
                            zoomEnabled={false}
                        >
                            <MapboxGL.Camera
                                ref={cameraRef}
                                zoomLevel={13}
                                centerCoordinate={coordinates[Math.floor(coordinates.length / 2)]}
                            />
                            <MapboxGL.ShapeSource id="routeSource" shape={routeFeatureCollection}>
                                <MapboxGL.LineLayer
                                    id="routeFill"
                                    style={{
                                        lineColor: '#FF2D55',
                                        lineWidth: 4,
                                        lineCap: 'round',
                                        lineJoin: 'round',
                                    }}
                                />
                            </MapboxGL.ShapeSource>

                            {/* Start Marker */}
                            <MapboxGL.PointAnnotation id="start" coordinate={coordinates[0]}>
                                <View style={[styles.marker, { backgroundColor: '#34C759' }]} />
                            </MapboxGL.PointAnnotation>

                            {/* End Marker */}
                            <MapboxGL.PointAnnotation id="end" coordinate={coordinates[coordinates.length - 1]}>
                                <View style={[styles.marker, { backgroundColor: '#FF3B30' }]} />
                            </MapboxGL.PointAnnotation>
                        </MapboxGL.MapView>
                    ) : (
                        <View style={styles.noMap}>
                            <Ionicons name="map-outline" size={40} color="#333" />
                            <Text style={styles.noMapText}>No GPS data saved</Text>
                        </View>
                    )}
                </View>

                <View style={styles.detailsContainer}>
                    <View style={styles.titleRow}>
                        <View style={[styles.typeIcon, isGroup && { backgroundColor: 'rgba(88, 86, 214, 0.15)' }]}>
                            <Ionicons
                                name={isGroup ? 'people' : 'bicycle'}
                                size={24}
                                color={isGroup ? '#5856D6' : '#FF2D55'}
                            />
                        </View>
                        <View>
                            <Text style={styles.title}>{ride.ride_groups?.name || 'Personal Ride'}</Text>
                            <Text style={styles.date}>
                                {new Date(ride.start_time).toLocaleDateString([], {
                                    weekday: 'long',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.statsGrid}>
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>Distance</Text>
                            <Text style={styles.statValue}>{(ride.total_distance / 1000).toFixed(2)}</Text>
                            <Text style={styles.statUnit}>km</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>Avg Pace</Text>
                            <Text style={styles.statValue}>{Math.round(ride.average_speed * 3.6)}</Text>
                            <Text style={styles.statUnit}>km/h</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>Duration</Text>
                            <Text style={styles.statValue}>{durationMins}</Text>
                            <Text style={styles.statUnit}>min</Text>
                        </View>
                    </View>

                    {/* Extended Details */}
                    <View style={styles.listSection}>
                        <View style={styles.listItem}>
                            <Text style={styles.listLabel}>Est. Calories</Text>
                            <Text style={styles.listValue}>
                                {/* Super rough estimate: ~30 cals per km for cycling */}
                                {Math.round((ride.total_distance / 1000) * 30)} kcal
                            </Text>
                        </View>
                        <View style={[styles.listItem, styles.listSeparator]}>
                            <Text style={styles.listLabel}>Max Speed</Text>
                            <Text style={styles.listValue}>
                                {/* Temporary random max speed placeholder until DB supports it strictly */}
                                {Math.round((ride.average_speed * 3.6) * 1.4)} km/h
                            </Text>
                        </View>
                        <View style={[styles.listItem, styles.listSeparator]}>
                            <Text style={styles.listLabel}>Elevation Gain</Text>
                            <Text style={styles.listValue}>-- m</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f0f0f' },
    loadingContainer: { flex: 1, backgroundColor: '#0f0f0f', justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    backBtn: {
        width: 40, height: 40,
        borderRadius: 20,
        backgroundColor: '#1C1C1E',
        justifyContent: 'center', alignItems: 'center'
    },
    shareBtn: {
        width: 40, height: 40,
        borderRadius: 20,
        backgroundColor: '#1C1C1E',
        justifyContent: 'center', alignItems: 'center'
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700'
    },
    scroll: { flex: 1 },
    mapContainer: {
        height: 280,
        width: '100%',
        backgroundColor: '#141414'
    },
    map: { flex: 1 },
    noMap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    noMapText: { color: '#666', marginTop: 10, fontWeight: '600' },
    marker: {
        width: 14, height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: '#fff'
    },
    detailsContainer: {
        padding: 24,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 30,
    },
    typeIcon: {
        width: 56, height: 56,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 45, 85, 0.15)',
        justifyContent: 'center', alignItems: 'center',
        marginRight: 16,
    },
    title: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 4 },
    date: { color: '#888', fontSize: 13, fontWeight: '500' },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 40,
    },
    statBox: {
        flex: 1,
        alignItems: 'center'
    },
    statLabel: { color: '#888', fontSize: 13, marginBottom: 8, fontWeight: '600' },
    statValue: { color: '#fff', fontSize: 28, fontWeight: '800' },
    statUnit: { color: '#666', fontSize: 12, marginTop: 2, fontWeight: '600', textTransform: 'uppercase' },
    listSection: {
        backgroundColor: '#141414',
        borderRadius: 16,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: '#202022'
    },
    listItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 18,
    },
    listSeparator: {
        borderTopWidth: 1,
        borderTopColor: '#202022'
    },
    listLabel: { color: '#888', fontSize: 15, fontWeight: '500' },
    listValue: { color: '#fff', fontSize: 15, fontWeight: '600' }
});

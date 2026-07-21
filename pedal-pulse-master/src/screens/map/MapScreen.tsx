import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, Platform, ActivityIndicator } from 'react-native';
import * as SMS from 'expo-sms';
import MapboxGL from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { useRideStore } from '../../store/useRideStore';
import { useGroupStore } from '../../store/useGroupStore';

import { useAuthStore } from '../../store/useAuthStore';
import { useAccidentDetection } from '../../hooks/useAccidentDetection';
import { useGroupLocationSync } from '../../hooks/useGroupLocationSync';
import EmergencyOverlay from '../../components/safety/EmergencyOverlay';
import { useNavigation } from '@react-navigation/native';

interface Hazard {
    id: string;
    location: {
        type: string;
        coordinates: [number, number];
    };
    hazard_type: 'pothole' | 'accident' | 'road_closure' | 'other';
    description?: string;
}

const TILE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

export default function MapScreen() {
    const navigation = useNavigation<any>();
    const [userLocation, setUserLocation] = useState<Location.LocationObjectCoords | null>(null);
    const [permissionGranted, setPermissionGranted] = useState(false);

    const rideStatus = useRideStore(state => state.status);
    const coordinates = useRideStore(state => state.coordinates);
    const totalDistance = useRideStore(state => state.totalDistance);
    const startRide = useRideStore(state => state.startRide);
    const stopRide = useRideStore(state => state.stopRide);
    const pauseRide = useRideStore(state => state.pauseRide);
    const resumeRide = useRideStore(state => state.resumeRide);
    const resetRide = useRideStore(state => state.resetRide);
    const addCoordinate = useRideStore(state => state.addCoordinate);
    const { groupId, setGroupId } = useRideStore();
    const [isEmergency, setEmergency] = useState(false);
    const isRiding = rideStatus === 'active' && !!groupId;
    const { riders, isConnected, error: locationError } = useGroupLocationSync(groupId, isRiding);
    const { myGroups } = useGroupStore();
    const profile = useAuthStore(state => state.profile);

    const [emergencyVisible, setEmergencyVisible] = useState(false);
    const [followUser, setFollowUser] = useState(true);
    const [zoomLevel, setZoomLevel] = useState(15);
    const [now, setNow] = useState<number>(new Date().getTime());
    const [hazards, setHazards] = useState<Hazard[]>([]);
    const mapRef = useRef<any>(null);
    const cameraRef = useRef<any>(null);
    const alertSentRef = useRef<boolean>(false); // 🚨 Deduplication guard
    const watchSubRef = useRef<Location.LocationSubscription | null>(null);
    const isMountedRef = useRef(true);

    const zoomIn = async () => {
        const nextZoom = Math.min(zoomLevel + 1, 20);
        setZoomLevel(nextZoom);
        cameraRef.current?.setCamera({
            zoomLevel: nextZoom,
            animationDuration: 300,
        });
    };

    const zoomOut = async () => {
        const nextZoom = Math.max(zoomLevel - 1, 2);
        setZoomLevel(nextZoom);
        cameraRef.current?.setCamera({
            zoomLevel: nextZoom,
            animationDuration: 300,
        });
    };

    const fetchHazards = async () => {
        const { data, error } = await supabase
            .from('hazard_reports')
            .select('*')
            .gt('reported_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (error) {
            console.error('[MapScreen] Fetch hazards error:', error);
        } else if (isMountedRef.current) {
            setHazards(data || []);
        }
    };

    // Accident Detection
    useAccidentDetection({
        isActive: rideStatus === 'active' && !emergencyVisible,
        currentSpeed: userLocation?.speed || 0,
        onDetection: () => {
            setEmergencyVisible(true);
            setEmergency(true);
            alertSentRef.current = false; // Reset guard on new emergency
        }
    });

    // Live Tracking Sync (Handled directly in watchPositionAsync now to avoid React state delays)

    // Hazards Fetch & Real-time subscription
    useEffect(() => {
        fetchHazards();

        const hazardSub = supabase
            .channel('public:hazard_reports')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'hazard_reports'
            }, (payload) => {
                if (!isMountedRef.current) return;

                if (payload.eventType === 'INSERT') {
                    setHazards(prev => [...prev, payload.new as Hazard]);
                } else if (payload.eventType === 'UPDATE') {
                    setHazards(prev => prev.map(h => h.id === payload.new.id ? payload.new as Hazard : h));
                } else if (payload.eventType === 'DELETE') {
                    setHazards(prev => prev.filter(h => h.id !== payload.old.id));
                }
            })
            .subscribe();

        return () => {
            hazardSub.unsubscribe();
        };
    }, []);

    // Location watcher for UI updates & ride coordinate tracking
    // NOTE: Location sharing uses useGroupLocationSync (separate, throttled watcher)
    // This watcher ONLY updates the map UI and records ride coordinates
    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission to access location was denied');
                return;
            }
            setPermissionGranted(true);

            const loc = await Location.getCurrentPositionAsync({});
            if (isMountedRef.current) {
                setUserLocation(loc.coords);
            }

            // Watch position for map UI updates
            // Reduced frequency: 500ms instead of 100ms (still responsive for map)
            watchSubRef.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 500, // Update map every 500ms (sufficient for UI responsiveness)
                    distanceInterval: 5, // Update if user moved 5 meters
                },
                (loc) => {
                    if (!isMountedRef.current) return;

                    setUserLocation(loc.coords);

                    // Record ride coordinates (only if ride is active)
                    const state = useRideStore.getState();
                    if (state.status === 'active') {
                        addCoordinate({
                            latitude: loc.coords.latitude,
                            longitude: loc.coords.longitude,
                            speed: loc.coords.speed || 0,
                            altitude: loc.coords.altitude || 0,
                            timestamp: loc.timestamp,
                        });
                    }
                }
            );
        })();

        return () => {
            if (watchSubRef.current) {
                watchSubRef.current.remove();
                watchSubRef.current = null;
            }
        };
    }, [addCoordinate]);

    // Heartbeat to force re-render for staleness checks
    useEffect(() => {
        const interval = setInterval(() => {
            if (isMountedRef.current) {
                setNow(new Date().getTime());
            }
        }, 5000); // Check staleness every 5 seconds
        return () => clearInterval(interval);
    }, []);

    // Cleanup on component unmount
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const routeGeoJSON = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                properties: {},
                geometry: {
                    type: 'LineString',
                    coordinates: coordinates.map(c => [c.longitude, c.latitude])
                }
            }
        ]
    };

    // Construct GeoJSON for Name Tags
    const buildLabelsGeoJSON = () => {
        const features: any[] = [];

        // Add Local User Label
        if (groupId && userLocation && useRideStore.getState().status === 'active') {
            features.push({
                type: 'Feature',
                properties: {
                    id: 'local-user',
                    name: profile?.name ? profile.name.substring(0, 10).toUpperCase() : 'YOU',
                    speed: `${currentSpeed} KM/H`,
                    isEmergency: isEmergency
                },
                geometry: {
                    type: 'Point',
                    coordinates: [userLocation.longitude, userLocation.latitude]
                }
            });
        }

        // Add Member Labels
        riders.forEach(member => {
            features.push({
                type: 'Feature',
                properties: {
                    id: member.user_id,
                    name: member.name.toUpperCase(),
                    speed: '',
                },
                geometry: {
                    type: 'Point',
                    coordinates: [member.longitude, member.latitude]
                }
            });
        });

        return {
            type: 'FeatureCollection',
            features
        };
    };

    const currentSpeed = userLocation?.speed ? (userLocation.speed * 3.6).toFixed(1) : '0.0';

    return (
        <View style={styles.container}>
            {permissionGranted ? (
                <MapboxGL.MapView
                    style={styles.map}
                    mapStyle={TILE_URL}
                    logoEnabled={false}
                    attributionEnabled={false}
                    rotateEnabled={true}
                    pitchEnabled={true}
                >
                    <MapboxGL.Camera
                        ref={cameraRef}
                        followUserLocation={followUser}
                        followUserMode={MapboxGL.UserTrackingMode.Follow}
                        animationDuration={300}
                    />

                    <MapboxGL.UserLocation
                        visible={!groupId} // Hide native blue dot if in a group ride, as we show custom pin
                        renderMode={"native"}
                        showsUserHeadingIndicator
                    />

                    {/* Local User Custom Marker (Pin Only) */}
                    {groupId && userLocation && useRideStore.getState().status === 'active' && (
                        <MapboxGL.PointAnnotation
                            key="marker-local-user"
                            id="marker-local-user"
                            coordinate={[userLocation.longitude, userLocation.latitude]}
                            anchor={{ x: 0.5, y: 1 }}
                        >
                            <View style={styles.pinpointMarkerContainer}>
                                <View style={[styles.pinPoint, isEmergency && styles.emergencyPin]}>
                                    <View style={styles.pinInnerCircle}>
                                        <Ionicons
                                            name="navigate"
                                            size={12}
                                            color={isEmergency ? "#FF3B30" : "#FF2D55"}
                                            style={{ transform: [{ rotate: `${userLocation.heading || 0}deg` }] }}
                                        />
                                    </View>
                                </View>
                            </View>
                        </MapboxGL.PointAnnotation>
                    )}

                    {/* Group Member Markers (Active riders only) */}
                    {riders.map((member) => (
                        <MapboxGL.PointAnnotation
                            key={`marker-${member.user_id}`}
                            id={`marker-${member.user_id}`}
                            coordinate={[member.longitude, member.latitude]}
                            anchor={{ x: 0.5, y: 1 }}
                        >
                            <View style={styles.pinpointMarkerContainer}>
                                <View style={styles.pinPoint}>
                                    <View style={styles.pinInnerCircle}>
                                        <Ionicons
                                            name="navigate"
                                            size={12}
                                            color={"#FF2D55"}
                                        />
                                    </View>
                                </View>
                            </View>
                        </MapboxGL.PointAnnotation>
                    ))}

                    {/* Hazard Markers */}
                    {hazards.map((hazard) => (
                        <MapboxGL.PointAnnotation
                            key={`hazard-${hazard.id}`}
                            id={`hazard-${hazard.id}`}
                            coordinate={[
                                (hazard.location as any).coordinates[0],
                                (hazard.location as any).coordinates[1]
                            ]}
                            anchor={{ x: 0.5, y: 0.5 }}
                        >
                            <View style={styles.hazardMarker}>
                                <Ionicons
                                    name={hazard.hazard_type === 'pothole' ? 'warning' : 'alert-circle'}
                                    size={24}
                                    color="#FF9500"
                                />
                            </View>
                        </MapboxGL.PointAnnotation>
                    ))}

                    {/* Native Text Labels via SymbolLayer (Bypasses UI clipping) */}
                    {groupId && (
                        <MapboxGL.ShapeSource id="labelsSource" shape={buildLabelsGeoJSON() as any}>
                            <MapboxGL.SymbolLayer
                                id="nameLabels"
                                style={{
                                    textField: ['get', 'name'],
                                    textSize: 12,
                                    textColor: '#ffffff',
                                    textHaloColor: 'rgba(12, 12, 12, 0.95)',
                                    textHaloWidth: 2,
                                    textAnchor: 'bottom',
                                    textOffset: [0, -3.5], // Offset above the pin
                                    textOpacity: 1,
                                    textPitchAlignment: 'map',
                                    textAllowOverlap: true,
                                    textIgnorePlacement: true,
                                }}
                            />
                            <MapboxGL.SymbolLayer
                                id="speedLabels"
                                style={{
                                    textField: ['get', 'speed'],
                                    textSize: 10,
                                    textColor: '#FF2D55',
                                    textHaloColor: 'rgba(12, 12, 12, 0.95)',
                                    textHaloWidth: 2,
                                    textAnchor: 'bottom',
                                    textOffset: [0, -2.2], // Offset below the name, above pin
                                    textOpacity: 1,
                                    textPitchAlignment: 'map',
                                    textAllowOverlap: true,
                                    textIgnorePlacement: true,
                                }}
                            />
                        </MapboxGL.ShapeSource>
                    )}
                </MapboxGL.MapView>
            ) : (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FF2D55" />
                    <Text style={styles.loadingText}>Locating your pulse...</Text>
                </View>
            )}

            {/* Ride Telemetry Overlay - Glass Effect */}
            <View style={styles.topContainer}>
                <View style={styles.glassDashboard}>
                    <View style={styles.statContainer}>
                        <Text style={styles.statValue}>{(totalDistance / 1000).toFixed(2)}</Text>
                        <Text style={styles.statLabel}>KM</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statContainer}>
                        <Text style={styles.statValue}>{currentSpeed}</Text>
                        <Text style={styles.statLabel}>KM/H</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statContainer}>
                        <Text style={styles.statValue}>
                            {userLocation?.altitude ? Math.round(userLocation.altitude) : '--'}
                        </Text>
                        <Text style={styles.statLabel}>M (ALT)</Text>
                    </View>
                </View>
            </View>

            {/* Map Controls - Vertical Stack */}
            <View style={styles.mapControlsStack}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.floatingControl, followUser && styles.controlActive]}
                    onPress={() => setFollowUser(!followUser)}
                >
                    <Ionicons
                        name={followUser ? "locate" : "locate-outline"}
                        size={22}
                        color={followUser ? "#fff" : "#888"}
                    />
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.8} style={styles.floatingControl} onPress={zoomIn}>
                    <Ionicons name="add" size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.8} style={styles.floatingControl} onPress={zoomOut}>
                    <Ionicons name="remove" size={22} color="#fff" />
                </TouchableOpacity>
            </View>

            {/* Controls Overlay */}
            <View style={styles.controlsOverlay}>
                {rideStatus === 'idle' ? (
                    <TouchableOpacity activeOpacity={0.9} onPress={startRide} style={styles.mainActionBtn}>
                        <LinearGradient
                            colors={['#FF2D55', '#D40035']}
                            style={styles.actionGradient}
                        >
                            <Ionicons name="play" size={30} color="#fff" />
                            <Text style={styles.actionText}>START RIDE</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                ) : rideStatus === 'completed' ? (
                    <TouchableOpacity activeOpacity={0.9} onPress={resetRide} style={styles.mainActionBtn}>
                        <LinearGradient
                            colors={['#333333', '#000000']}
                            style={styles.actionGradient}
                        >
                            <Ionicons name="close" size={30} color="#fff" />
                            <Text style={styles.actionText}>EXIT RIDE</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.activeControls}>
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={rideStatus === 'paused' ? resumeRide : pauseRide}
                            style={styles.circleBtn}
                        >
                            <LinearGradient
                                colors={rideStatus === 'paused' ? ['#4CD964', '#28B141'] : ['#FF9500', '#D67E00']}
                                style={styles.circleGradient}
                            >
                                <Ionicons name={rideStatus === 'paused' ? "play" : "pause"} size={28} color="#fff" />
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => {
                                Alert.alert(
                                    "End Ride?",
                                    "Are you sure you want to finish your session?",
                                    [
                                        { text: "Cancel", style: "cancel" },
                                        {
                                            text: "End Ride", style: "destructive", onPress: () => {
                                                stopRide();
                                            }
                                        }
                                    ]
                                );
                            }}
                            style={styles.circleBtn}
                        >
                            <LinearGradient
                                colors={['#FF3B30', '#C41C16']}
                                style={styles.circleGradient}
                            >
                                <Ionicons name="square" size={24} color="#fff" />
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Group Selection */}
                {rideStatus === 'idle' && (
                    <View style={styles.groupSelector}>
                        <TouchableOpacity
                            style={[styles.groupToggle, !groupId && styles.groupToggleActive]}
                            onPress={() => setGroupId(null)}
                        >
                            <Text style={styles.groupToggleText}>PERSONAL</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.groupToggle, groupId && styles.groupToggleActive]}
                            onPress={() => navigation.navigate('RideGroups')}
                        >
                            <Text style={styles.groupToggleText}>
                                {groupId ? myGroups.find(g => g.id === groupId)?.name.toUpperCase() : 'SELECT GROUP'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            <EmergencyOverlay
                visible={emergencyVisible}
                onCancel={() => {
                    setEmergencyVisible(false);
                    setEmergency(false);
                }}
                onConfirmed={() => {
                    if (alertSentRef.current) return;
                    alertSentRef.current = true; // ✅ Mark as sent

                    setEmergencyVisible(false);

                    const locationUrl = userLocation
                        ? `https://maps.google.com/?q=${userLocation.latitude},${userLocation.longitude}`
                        : 'Location unavailable';

                    const riderName = profile?.name || 'A rider';
                    const emergencyPhone = profile?.emergency_contact_phone;

                    // ── 1. SOS SMS to emergency contact (BOTH personal & group)
                    if (emergencyPhone) {
                        (async () => {
                            try {
                                const isAvailable = await SMS.isAvailableAsync();
                                if (isAvailable) {
                                    await SMS.sendSMSAsync(
                                        [emergencyPhone],
                                        `🚨 SOS: ${riderName} may have had a cycling accident! Speed: ${currentSpeed} KM/H. Location: ${locationUrl}`
                                    );
                                }
                            } catch (err) {
                                console.error('[Emergency] SMS failed:', err);
                            }
                        })();
                    }

                    // ── 2. ALERT CO-RIDERS (group ride only)
                    if (groupId && profile) {
                        (async () => {
                            try {
                                // a) Get all group members (except self)
                                const { data: members } = await supabase
                                    .from('ride_group_members')
                                    .select('user_id')
                                    .eq('group_id', groupId)
                                    .neq('user_id', profile.id);

                                // b) Insert emergency notification for each co-rider (deduplicate user_ids just in case)
                                if (members && members.length > 0) {
                                    const uniqueUserIds = Array.from(new Set(members.map(m => m.user_id)));
                                    const notifications = uniqueUserIds.map(uid => ({
                                        user_id: uid,
                                        type: 'emergency',
                                        title: '🚨 Rider Emergency',
                                        body: `${riderName} may have crashed! Speed: ${currentSpeed} KM/H.`,
                                        data: {
                                            location_url: locationUrl,
                                            sender_id: profile.id,
                                            sender_name: riderName,
                                            group_id: groupId,
                                        },
                                    }));

                                    await supabase.from('notifications').insert(notifications);
                                    console.log('[Emergency] Notifications sent to', uniqueUserIds.length, 'co-riders');
                                }

                                // c) Also send message to group chat
                                const { data: groupData } = await supabase
                                    .from('ride_groups')
                                    .select('name')
                                    .eq('id', groupId)
                                    .single();

                                if (groupData) {
                                    const { data: roomData } = await supabase
                                        .from('chat_rooms')
                                        .select('id')
                                        .eq('type', 'community')
                                        .eq('name', groupData.name)
                                        .single();

                                    if (roomData) {
                                        await supabase.from('messages').insert({
                                            room_id: roomData.id,
                                            sender_id: profile.id,
                                            content: `🚨 EMERGENCY: ${riderName} may have crashed! Speed: ${currentSpeed} KM/H. Location: ${locationUrl}`,
                                            status: 'sent'
                                        });
                                    }
                                }
                            } catch (e) {
                                console.error('[Emergency] Alert failed:', e);
                            }
                        })();
                    }

                    // ── 3. Confirmation
                    Alert.alert(
                        "🚨 Emergency Alert Sent",
                        groupId
                            ? (emergencyPhone
                                ? "SOS SMS sent to your emergency contact. All co-riders have been alerted with alarm."
                                : "All co-riders have been alerted with alarm. Add emergency contact in Profile for SMS.")
                            : (emergencyPhone
                                ? "SOS SMS sent to your emergency contact with your location."
                                : "No emergency contact set. Go to Profile to add one.")
                    );
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F0F0F',
    },
    map: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0F0F0F',
    },
    loadingText: {
        marginTop: 15,
        color: '#888',
        fontSize: 16,
        fontWeight: '500',
    },
    topContainer: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        left: 20,
        right: 20,
        pointerEvents: 'box-none',
        zIndex: 10,
    },
    glassDashboard: {
        backgroundColor: 'rgba(12, 12, 12, 0.9)',
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        shadowColor: '#000',
        shadowOpacity: 0.6,
        shadowRadius: 15,
        elevation: 15,
    },
    statContainer: {
        alignItems: 'center',
        flex: 1,
    },
    statDivider: {
        width: 1,
        height: 28,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    statValue: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: -0.5,
    },
    statLabel: {
        fontSize: 10,
        color: '#FF2D55',
        fontWeight: '800',
        marginTop: 2,
        letterSpacing: 0.5,
    },
    mapControlsStack: {
        position: 'absolute',
        right: 20,
        top: Platform.OS === 'ios' ? 160 : 140,
        gap: 12,
        zIndex: 5,
    },
    floatingControl: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(12, 12, 12, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
    },
    controlActive: {
        backgroundColor: '#FF2D55',
        borderColor: '#FF2D55',
    },
    controlsOverlay: {
        position: 'absolute',
        bottom: 50,
        left: 0,
        right: 0,
        alignItems: 'center',
        pointerEvents: 'box-none',
        zIndex: 10,
    },
    mainActionBtn: {
        width: 220,
        height: 60,
        borderRadius: 30,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#FF2D55',
        shadowOpacity: 0.4,
        shadowRadius: 12,
    },
    actionGradient: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    actionText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 10,
        letterSpacing: 1,
    },
    activeControls: {
        flexDirection: 'row',
        gap: 30,
    },
    circleBtn: {
        width: 70,
        height: 70,
        borderRadius: 35,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    circleGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sideControls: {
        position: 'absolute',
        top: 100,
        right: 0,
        gap: 12,
    },
    pinpointMarkerContainer: {
        alignItems: 'center',
        justifyContent: 'flex-end',
        width: 40,
        height: 40,
    },
    pinPoint: {
        width: 24,
        height: 30,
        backgroundColor: '#fff',
        borderTopLeftRadius: 15,
        borderTopRightRadius: 15,
        borderBottomLeftRadius: 15,
        borderBottomRightRadius: 2,
        transform: [{ rotate: '45deg' }],
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 3,
        borderWidth: 1.5,
        borderColor: '#FF2D55',
    },
    pinInnerCircle: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#fff',
        transform: [{ rotate: '-45deg' }],
        justifyContent: 'center',
        alignItems: 'center',
    },
    emergencyPin: {
        backgroundColor: '#FF3B30',
        borderColor: '#fff',
    },
    groupSelector: {
        flexDirection: 'row',
        backgroundColor: 'rgba(18, 18, 18, 0.9)',
        borderRadius: 25,
        padding: 4,
        marginTop: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 5,
    },
    groupToggle: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 22,
    },
    groupToggleActive: {
        backgroundColor: '#FF2D55',
    },
    groupToggleText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    hazardMarker: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 15,
        padding: 4,
        borderWidth: 1,
        borderColor: '#FF9500',
    }
});

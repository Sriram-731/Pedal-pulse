import React, { useEffect, useState, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
    ActivityIndicator, Alert, RefreshControl, Modal, TextInput,
    ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../config/supabase';
import { useAuthStore } from '../../store/useAuthStore';

interface Event {
    id: string;
    name: string;
    description: string;
    start_time: string;
    location_name: string;
    poster_url: string;
    community_id: string;
    creator_id: string;
    participant_count?: number;
}

interface Community {
    id: string;
    name: string;
}

export default function EventListScreen({ navigation }: any) {
    const user = useAuthStore(state => state.user);
    const [events, setEvents] = useState<Event[]>([]);
    const [joinedEventIds, setJoinedEventIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [joiningId, setJoiningId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'available' | 'joined'>('available');

    // Creation State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [myCommunities, setMyCommunities] = useState<Community[]>([]);
    const [newEvent, setNewEvent] = useState({
        name: '',
        description: '',
        start_time: '',
        location_name: '',
        poster_url: 'https://images.unsplash.com/photo-1541625602330-2277a4c4b282?auto=format&fit=crop&q=80&w=1000',
        community_id: ''
    });

    // Admin State
    const [showParticipantsModal, setShowParticipantsModal] = useState(false);
    const [selectedEventParticipants, setSelectedEventParticipants] = useState<any[]>([]);
    const [viewingParticipantsFor, setViewingParticipantsFor] = useState<string | null>(null);

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
    const [eventDate, setEventDate] = useState(new Date());

    const showPicker = () => {
        setPickerMode('date');
        setShowDatePicker(true);
    };

    const onDateChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
            if (event.type === 'set' && selectedDate) {
                if (pickerMode === 'date') {
                    setEventDate(selectedDate);
                    setPickerMode('time');
                    setShowDatePicker(true); // Open time picker next
                } else {
                    setEventDate(selectedDate);
                    const formatted = selectedDate.toISOString().slice(0, 16).replace('T', ' ');
                    setNewEvent(prev => ({ ...prev, start_time: formatted }));
                }
            }
        } else {
            // iOS
            const currentDate = selectedDate || eventDate;
            setEventDate(currentDate);
            const formatted = currentDate.toISOString().slice(0, 16).replace('T', ' ');
            setNewEvent(prev => ({ ...prev, start_time: formatted }));
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch events with participant counts
            const { data: eventsData, error: eventsError } = await supabase
                .from('events')
                .select('*, event_participants(count)')
                .order('start_time', { ascending: true });

            if (eventsError) throw eventsError;

            const eventsWithCounts = eventsData?.map(e => ({
                ...e,
                participant_count: e.event_participants?.[0]?.count || 0
            })) || [];

            setEvents(eventsWithCounts);

            // Fetch user's joined events
            if (user) {
                const { data: joinedData, error: joinedError } = await supabase
                    .from('event_participants')
                    .select('event_id')
                    .eq('user_id', user.id);

                if (joinedError) throw joinedError;
                setJoinedEventIds(joinedData.map(j => j.event_id));

                // Fetch communities where user is admin for event creation
                const { data: adminComm } = await supabase
                    .from('communities')
                    .select('id, name')
                    .eq('admin_id', user.id);

                setMyCommunities(adminComm || []);
                if (adminComm && adminComm.length > 0 && !newEvent.community_id) {
                    setNewEvent(prev => ({ ...prev, community_id: adminComm[0].id }));
                }
            }
        } catch (error: any) {
            console.error('FetchData Error:', error);
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        const eventSub = supabase
            .channel('event_list_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'event_participants' }, () => fetchData())
            .subscribe();

        return () => {
            eventSub.unsubscribe();
        };
    }, [user]);

    const filteredEvents = useMemo(() => {
        if (activeTab === 'available') {
            return events.filter(e => !joinedEventIds.includes(e.id));
        }
        return events.filter(e => joinedEventIds.includes(e.id));
    }, [events, joinedEventIds, activeTab]);

    const handleJoin = async (eventId: string) => {
        if (!user) return;
        setJoiningId(eventId);

        try {
            const { error } = await supabase
                .from('event_participants')
                .upsert({ event_id: eventId, user_id: user.id, status: 'approved' });

            if (error) {
                if (error.code === '23505') {
                    setJoinedEventIds(prev => [...new Set([...prev, eventId])]);
                } else {
                    throw error;
                }
            } else {
                setJoinedEventIds(prev => [...prev, eventId]);

                // Auto-join Event Chat Room
                const { data: room } = await supabase
                    .from('chat_rooms')
                    .select('id')
                    .eq('event_id', eventId)
                    .single();

                if (room) {
                    await supabase.from('chat_participants').upsert({
                        room_id: room.id,
                        user_id: user.id
                    });
                }

                Alert.alert('Success', 'Joined! Check your Chat tab for the event room.');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setJoiningId(null);
        }
    };

    const handleCreateEvent = async () => {
        if (!user) return;
        if (!newEvent.name || !newEvent.start_time || !newEvent.community_id) {
            Alert.alert('Required', 'Please fill in name, date, and select a club.');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('events')
                .insert({
                    ...newEvent,
                    creator_id: user.id
                })
                .select()
                .single();

            if (error) throw error;

            // Auto-join as creator
            await supabase.from('event_participants').insert({
                event_id: data.id,
                user_id: user.id,
                status: 'approved'
            });

            // Create actual Event Chat Room
            const { data: roomData, error: roomError } = await supabase
                .from('chat_rooms')
                .insert({
                    type: 'event',
                    name: `${newEvent.name} Chat`,
                    event_id: data.id,
                    created_by: user.id
                })
                .select()
                .single();

            if (!roomError && roomData) {
                await supabase.from('chat_participants').insert({
                    room_id: roomData.id,
                    user_id: user.id,
                    role: 'admin'
                });
            }

            Alert.alert('Success', 'Event launched and chat room created!');
            setShowCreateModal(false);
            fetchData();
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const viewParticipants = async (eventId: string) => {
        setViewingParticipantsFor(eventId);
        setShowParticipantsModal(true);
        try {
            const { data, error } = await supabase
                .from('event_participants')
                .select(`
                    user_id,
                    profiles (
                        name,
                        avatar_url
                    )
                `)
                .eq('event_id', eventId);

            if (error) throw error;
            setSelectedEventParticipants(data || []);
        } catch (error: any) {
            console.error('Participants fetch error:', error);
        }
    };

    const renderItem = ({ item }: { item: Event }) => {
        const isJoined = joinedEventIds.includes(item.id);
        const isAdmin = item.creator_id === user?.id;
        const eventDate = new Date(item.start_time).toLocaleDateString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        return (
            <View style={styles.eventCard}>
                <Image source={{ uri: item.poster_url }} style={styles.poster} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.95)']} style={styles.posterOverlay} />

                <View style={styles.cardContent}>
                    <View style={styles.topRow}>
                        <View style={styles.dateBadge}>
                            <Text style={styles.dateText}>{eventDate}</Text>
                        </View>
                        {isAdmin && (
                            <TouchableOpacity style={styles.adminTag} onPress={() => viewParticipants(item.id)}>
                                <Ionicons name="people" size={12} color="#fff" />
                                <Text style={styles.adminTagText}>{item.participant_count} Riders</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text style={styles.eventName}>{item.name}</Text>
                    <View style={styles.infoRow}>
                        <Ionicons name="location" size={16} color="#FF2D55" />
                        <Text style={styles.infoText}>{item.location_name}</Text>
                    </View>

                    <Text style={styles.description} numberOfLines={2}>{item.description}</Text>

                    <View style={styles.actionRow}>
                        {isAdmin ? (
                            <TouchableOpacity style={styles.manageBtn} onPress={() => viewParticipants(item.id)}>
                                <Text style={styles.manageBtnText}>Manage Riders</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[styles.joinBtn, isJoined && styles.joinedBtn]}
                                onPress={() => !isJoined && handleJoin(item.id)}
                                disabled={joiningId === item.id || isJoined}
                            >
                                <LinearGradient
                                    colors={isJoined ? ['#2C2C2E', '#1C1C1E'] : ['#FF2D55', '#D40035']}
                                    style={styles.btnGradient}
                                >
                                    <Ionicons name={isJoined ? "checkmark-circle" : "flash"} size={18} color="#fff" />
                                    <Text style={styles.joinBtnText}>{isJoined ? 'Joined' : 'Get Pulse'}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color="#FF2D55" />
                </TouchableOpacity>
                <Text style={styles.title}>Races & Rides</Text>
                {myCommunities.length > 0 ? (
                    <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
                        <Ionicons name="add" size={28} color="#FF2D55" />
                    </TouchableOpacity>
                ) : <View style={{ width: 44 }} />}
            </View>

            <View style={styles.tabBar}>
                {['available', 'joined'].map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.activeTab]}
                        onPress={() => setActiveTab(tab as any)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading && events.length === 0 ? (
                <ActivityIndicator size="large" color="#FF2D55" style={styles.centered} />
            ) : (
                <FlatList
                    data={filteredEvents}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} tintColor="#FF2D55" />}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="bicycle-outline" size={64} color="#333" />
                            <Text style={styles.emptyText}>No events in this category.</Text>
                        </View>
                    }
                />
            )}

            {/* Create Event Modal */}
            <Modal visible={showCreateModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Launch Event</Text>
                            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                                <Ionicons name="close" size={28} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}>
                            <Text style={styles.inputLabel}>SELECT CLUB</Text>
                            <View style={styles.clubPicker}>
                                {myCommunities.map(c => (
                                    <TouchableOpacity
                                        key={c.id}
                                        style={[styles.clubPill, newEvent.community_id === c.id && styles.clubPillActive]}
                                        onPress={() => setNewEvent(prev => ({ ...prev, community_id: c.id }))}
                                    >
                                        <Text style={[styles.clubPillText, newEvent.community_id === c.id && styles.clubPillTextActive]}>{c.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.inputLabel}>EVENT NAME</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Moonlight Sprint"
                                placeholderTextColor="#444"
                                value={newEvent.name}
                                onChangeText={v => setNewEvent(prev => ({ ...prev, name: v }))}
                            />
                            <Text style={styles.inputLabel}>LOCATION</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Meeting point"
                                placeholderTextColor="#444"
                                value={newEvent.location_name}
                                onChangeText={v => setNewEvent(prev => ({ ...prev, location_name: v }))}
                            />
                            <Text style={styles.inputLabel}>START TIME</Text>
                            <TouchableOpacity style={styles.input} onPress={showPicker}>
                                <Text style={{ color: newEvent.start_time ? '#fff' : '#444', fontSize: 16 }}>
                                    {newEvent.start_time ? eventDate.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : "Select date & time"}
                                </Text>
                            </TouchableOpacity>

                            {showDatePicker && (
                                <DateTimePicker
                                    value={eventDate}
                                    mode={Platform.OS === 'ios' ? 'datetime' : pickerMode}
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    themeVariant="dark"
                                    onChange={onDateChange}
                                />
                            )}
                            <Text style={styles.inputLabel}>DESCRIPTION</Text>
                            <TextInput
                                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                placeholder="Tell us about the ride..."
                                placeholderTextColor="#444"
                                multiline
                                value={newEvent.description}
                                onChangeText={v => setNewEvent(prev => ({ ...prev, description: v }))}
                            />

                            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateEvent} disabled={loading}>
                                <LinearGradient colors={['#FF2D55', '#D40035']} style={styles.submitGradient}>
                                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Create Event</Text>}
                                </LinearGradient>
                            </TouchableOpacity>
                        </ScrollView>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            {/* Participants Modal */}
            <Modal visible={showParticipantsModal} animationType="fade" transparent>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowParticipantsModal(false)}>
                    <View style={[styles.modalContent, { height: '60%' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Participants</Text>
                            <TouchableOpacity onPress={() => setShowParticipantsModal(false)}>
                                <Ionicons name="close" size={28} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={selectedEventParticipants}
                            keyExtractor={(item, index) => index.toString()}
                            renderItem={({ item }) => (
                                <View style={styles.riderRow}>
                                    <Image source={{ uri: item.profiles?.avatar_url || 'https://images.unsplash.com/photo-1541625602330-2277a4c4b282?w=100' }} style={styles.riderAvatar} />
                                    <Text style={styles.riderName}>{item.profiles?.name || 'Rider'}</Text>
                                    <Ionicons name="checkmark-circle" size={18} color="#4CD964" />
                                </View>
                            )}
                            ListEmptyComponent={<Text style={styles.emptyText}>No one has joined yet.</Text>}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F0F0F',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#1C1C1E',
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1, borderColor: '#2C2C2E',
    },
    title: {
        fontSize: 20, fontWeight: 'bold', color: '#fff',
    },
    createBtn: {
        width: 44, height: 44, borderRadius: 12, backgroundColor: '#1C1C1E',
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2C2C2E',
    },
    tabBar: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 20,
        gap: 15,
    },
    tab: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        backgroundColor: '#1C1C1E',
        borderWidth: 1, borderColor: '#2C2C2E',
    },
    activeTab: {
        backgroundColor: 'rgba(255, 45, 85, 0.1)',
        borderColor: '#FF2D55',
    },
    tabText: {
        color: '#666', fontSize: 14, fontWeight: '600',
    },
    activeTabText: {
        color: '#FF2D55',
    },
    listContent: {
        paddingHorizontal: 20, paddingBottom: 40,
    },
    eventCard: {
        height: 400, borderRadius: 32, overflow: 'hidden',
        backgroundColor: '#1C1C1E', marginBottom: 25,
        borderWidth: 1, borderColor: '#2C2C2E',
    },
    poster: {
        width: '100%', height: '100%', position: 'absolute',
    },
    posterOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    cardContent: {
        flex: 1, justifyContent: 'flex-end', padding: 25,
    },
    topRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
    },
    dateBadge: {
        backgroundColor: 'rgba(255, 45, 85, 0.2)', paddingVertical: 6, paddingHorizontal: 12,
        borderRadius: 10, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(255, 45, 85, 0.3)',
    },
    dateText: {
        color: '#FF2D55', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase',
    },
    adminTag: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)',
        paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, gap: 4,
    },
    adminTagText: {
        color: '#fff', fontSize: 10, fontWeight: 'bold',
    },
    eventName: {
        fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 8,
    },
    infoRow: {
        flexDirection: 'row', alignItems: 'center', marginBottom: 10,
    },
    infoText: {
        color: '#aaa', fontSize: 14, marginLeft: 6,
    },
    description: {
        color: '#888', fontSize: 14, lineHeight: 20, marginBottom: 20,
    },
    actionRow: {
        flexDirection: 'row', gap: 10,
    },
    joinBtn: {
        flex: 1, borderRadius: 18, height: 55, overflow: 'hidden',
    },
    joinedBtn: {
        opacity: 0.8,
    },
    manageBtn: {
        flex: 1, height: 55, borderRadius: 18, backgroundColor: '#2C2C2E',
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#444',
    },
    manageBtnText: {
        color: '#fff', fontSize: 16, fontWeight: 'bold',
    },
    btnGradient: {
        flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    },
    joinBtnText: {
        color: '#fff', fontSize: 16, fontWeight: 'bold',
    },
    centered: {
        flex: 1, justifyContent: 'center', alignItems: 'center',
    },
    emptyContainer: {
        flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100,
    },
    emptyText: {
        color: '#666', fontSize: 16, marginTop: 20,
    },
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#1C1C1E', borderTopLeftRadius: 30, borderTopRightRadius: 30,
        padding: 25, paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25,
    },
    modalTitle: {
        fontSize: 24, fontWeight: 'bold', color: '#fff',
    },
    inputLabel: {
        fontSize: 10, color: '#666', fontWeight: '700', marginBottom: 8, letterSpacing: 1,
    },
    input: {
        backgroundColor: '#0F0F0F', borderRadius: 14, padding: 15,
        fontSize: 16, color: '#fff', marginBottom: 20, borderWidth: 1, borderColor: '#2C2C2E',
    },
    submitBtn: {
        borderRadius: 18, height: 60, overflow: 'hidden', marginTop: 10,
    },
    submitGradient: {
        flex: 1, justifyContent: 'center', alignItems: 'center',
    },
    submitText: {
        color: '#fff', fontSize: 18, fontWeight: 'bold',
    },
    clubPicker: {
        flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20,
    },
    clubPill: {
        paddingVertical: 8, paddingHorizontal: 15, borderRadius: 12,
        backgroundColor: '#0F0F0F', borderWidth: 1, borderColor: '#2C2C2E',
    },
    clubPillActive: {
        backgroundColor: 'rgba(255, 45, 85, 0.1)', borderColor: '#FF2D55',
    },
    clubPillText: {
        color: '#888', fontSize: 12, fontWeight: '600',
    },
    clubPillTextActive: {
        color: '#FF2D55',
    },
    riderRow: {
        flexDirection: 'row', alignItems: 'center', marginBottom: 15,
        backgroundColor: '#0F0F0F', padding: 12, borderRadius: 15,
    },
    riderAvatar: {
        width: 40, height: 40, borderRadius: 20, marginRight: 15,
    },
    riderName: {
        flex: 1, color: '#fff', fontSize: 16, fontWeight: '500',
    }
});

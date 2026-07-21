import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Alert,
    ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useGroupStore, RideGroup } from '../../store/useGroupStore';
import { useRideStore } from '../../store/useRideStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../config/supabase';

export default function GroupDetailScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { groupId } = route.params;

    const { myGroups, leaveGroup, deleteGroup, isLoading } = useGroupStore();
    const { setGroupId } = useRideStore();
    const user = useAuthStore(state => state.user);

    const [members, setMembers] = useState<any[]>([]);
    const [loadingMembers, setLoadingMembers] = useState(true);

    const group = myGroups.find(g => g.id === groupId);
    const isCreator = group?.creator_id === user?.id;

    useEffect(() => {
        fetchMembers();
    }, [groupId]);

    const fetchMembers = async () => {
        setLoadingMembers(true);
        const { data, error } = await supabase
            .from('ride_group_members')
            .select('*, profiles(name, avatar_url)')
            .eq('group_id', groupId);

        if (!error && data) {
            setMembers(data);
        }
        setLoadingMembers(false);
    };

    const handleStartRide = () => {
        setGroupId(groupId);
        navigation.navigate('MainTabs', { screen: 'Map' }); // Navigate back to Map tab
    };

    const handleLeave = () => {
        Alert.alert(
            'Leave Group',
            'Are you sure you want to leave this group?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Leave',
                    style: 'destructive',
                    onPress: async () => {
                        const success = await leaveGroup(groupId);
                        if (success) navigation.goBack();
                    }
                }
            ]
        );
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Group',
            'This action cannot be undone. All ride history for this group will remain, but the group itself will be gone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const success = await deleteGroup(groupId);
                        if (success) navigation.goBack();
                    }
                }
            ]
        );
    };

    if (!group) return null;

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#121212', '#000000']}
                style={styles.background}
            />

            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Group Details</Text>
                {isCreator ? (
                    <TouchableOpacity onPress={handleDelete} style={styles.deleteButtonHeader}>
                        <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 40 }} />
                )}
            </View>

            <View style={styles.heroSection}>
                <View style={styles.groupIconLarge}>
                    <Ionicons name="people" size={40} color="#FF2D55" />
                </View>
                <Text style={styles.groupName}>{group.name}</Text>
                <Text style={styles.groupDesc}>{group.description || 'No description provided.'}</Text>
            </View>

            <View style={styles.actionRow}>
                <TouchableOpacity style={styles.startRideButton} onPress={handleStartRide}>
                    <LinearGradient
                        colors={['#FF2D55', '#D00036']}
                        style={styles.buttonGradient}
                    >
                        <Ionicons name="play" size={20} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.buttonText}>START GROUP RIDE</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            <View style={styles.membersHeader}>
                <Text style={styles.sectionTitle}>Members ({members.length})</Text>
                {!isCreator && (
                    <TouchableOpacity onPress={handleLeave}>
                        <Text style={styles.leaveText}>Leave Group</Text>
                    </TouchableOpacity>
                )}
            </View>

            {loadingMembers ? (
                <ActivityIndicator color="#FF2D55" style={{ marginTop: 20 }} />
            ) : (
                <FlatList
                    data={members}
                    keyExtractor={(item) => item.user_id}
                    contentContainerStyle={styles.memberList}
                    renderItem={({ item }) => (
                        <View style={styles.memberItem}>
                            <View style={styles.memberAvatar}>
                                <Ionicons name="person" size={20} color="#666" />
                            </View>
                            <View style={styles.memberInfo}>
                                <Text style={styles.memberName}>{item.profiles?.name || 'Cyclist'}</Text>
                                <Text style={styles.memberRole}>{item.user_id === group.creator_id ? 'Admin' : 'Member'}</Text>
                            </View>
                            {isCreator && item.user_id !== user?.id && (
                                <TouchableOpacity>
                                    <Ionicons name="ellipsis-horizontal" size={20} color="#666" />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    background: {
        ...StyleSheet.absoluteFillObject,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteButtonHeader: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroSection: {
        alignItems: 'center',
        padding: 20,
    },
    groupIconLarge: {
        width: 80,
        height: 80,
        borderRadius: 25,
        backgroundColor: 'rgba(255, 45, 85, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
    },
    groupName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
    },
    groupDesc: {
        fontSize: 16,
        color: '#999',
        textAlign: 'center',
        marginTop: 8,
        paddingHorizontal: 20,
    },
    actionRow: {
        paddingHorizontal: 20,
        marginVertical: 20,
    },
    startRideButton: {
        height: 56,
        borderRadius: 28,
        overflow: 'hidden',
    },
    buttonGradient: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    membersHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    leaveText: {
        color: '#FF3B30',
        fontWeight: '600',
    },
    memberList: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    memberItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 12,
        borderRadius: 16,
        marginBottom: 10,
    },
    memberAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    memberInfo: {
        flex: 1,
    },
    memberName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    memberRole: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    }
});

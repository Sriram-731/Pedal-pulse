import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useCommunityStore } from '../../store/useCommunityStore';

export default function CommunityAuditLogScreen({ route, navigation }: any) {
    const { communityId } = route.params;
    const { auditLogs, fetchAuditLogs } = useCommunityStore();
    const [loading, setLoading] = useState(true);

    const logs = auditLogs[communityId] || [];

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await fetchAuditLogs(communityId);
            setLoading(false);
        };
        load();
    }, [communityId]);

    const formatActionText = (item: any) => {
        const actor = item.profiles?.name || 'Unknown Admin';
        const target = item.target?.name;

        switch (item.action) {
            case 'changed_role':
                return `${actor} changed role for ${target || 'User'}`;
            case 'banned_user':
                return `${actor} banned ${target || 'User'}`;
            case 'muted_user':
                return `${actor} muted ${target || 'User'}`;
            case 'updated_settings':
                return `${actor} updated community settings`;
            default:
                return `${actor} performed: ${item.action}`;
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.logRow}>
            <View style={styles.iconWrapper}>
                <Ionicons name="shield-checkmark" size={20} color="#8E8E93" />
            </View>
            <View style={styles.infoCol}>
                <Text style={styles.actionText}>{formatActionText(item)}</Text>
                <Text style={styles.timeText}>{new Date(item.created_at).toLocaleString()}</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Audit Logs</Text>
                <View style={styles.backBtn} />
            </View>

            {loading && logs.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator color="#FF2D55" size="large" />
                </View>
            ) : (
                <FlatList
                    data={logs}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={<Text style={styles.emptyText}>No moderation actions recorded yet.</Text>}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F0F0F' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#1C1C1E' },
    backBtn: { width: 40 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
    listContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
    logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#1C1C1E' },
    iconWrapper: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1C1C1E', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    infoCol: { flex: 1 },
    actionText: { fontSize: 15, fontWeight: '500', color: '#fff', marginBottom: 4 },
    timeText: { fontSize: 12, color: '#8E8E93' },
    emptyText: { color: '#8E8E93', textAlign: 'center', marginTop: 40 }
});

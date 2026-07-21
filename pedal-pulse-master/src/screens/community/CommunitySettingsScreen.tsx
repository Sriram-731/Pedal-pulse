import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useCommunityStore } from '../../store/useCommunityStore';
import { supabase } from '../../config/supabase';

export default function CommunitySettingsScreen({ route, navigation }: any) {
    const { communityId } = route.params;
    const { communities, fetchCommunities } = useCommunityStore();

    const community = communities[communityId];

    const [saving, setSaving] = useState(false);
    const [isInviteActive, setIsInviteActive] = useState(community?.is_invite_active ?? true);
    const [isAnnouncementMode, setIsAnnouncementMode] = useState(community?.announcement_mode ?? false);
    const [visibility, setVisibility] = useState(community?.visibility ?? 'public');

    if (!community) return null;

    const copyInviteCode = async () => {
        if (community.invite_code) {
            await Clipboard.setStringAsync(community.invite_code);
            Alert.alert('Copied!', 'Invite code copied to clipboard.', [{ text: 'OK' }]);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('communities')
                .update({
                    is_invite_active: isInviteActive,
                    announcement_mode: isAnnouncementMode,
                    visibility
                })
                .eq('id', communityId);

            if (error) throw error;
            Alert.alert('Success', 'Community settings updated!');
            await fetchCommunities(community.admin_id); // Re-fetch to sync state
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={styles.backBtn} />
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Invite Controls */}
                <Text style={styles.sectionHeader}>Invite System</Text>
                <View style={styles.card}>
                    <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.rowTitle}>Active Invite Code</Text>
                            <Text style={styles.rowDesc}>Allow users to join via code mapping</Text>
                        </View>
                        <Switch
                            value={isInviteActive}
                            onValueChange={setIsInviteActive}
                            trackColor={{ false: '#2C2C2E', true: '#FF2D55' }}
                        />
                    </View>

                    {isInviteActive && (
                        <>
                            <View style={styles.divider} />
                            <View style={styles.row}>
                                <Text style={styles.codeText}>{community.invite_code}</Text>
                                <TouchableOpacity onPress={copyInviteCode} style={styles.copyBtn}>
                                    <Ionicons name="copy-outline" size={20} color="#FF2D55" />
                                    <Text style={styles.copyText}>Copy</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>

                {/* Permissions & Discoverability */}
                <Text style={styles.sectionHeader}>Permissions & Privacy</Text>
                <View style={styles.card}>
                    <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.rowTitle}>Announcement Mode</Text>
                            <Text style={styles.rowDesc}>Only Owners and Admins can send messages in the group chat.</Text>
                        </View>
                        <Switch
                            value={isAnnouncementMode}
                            onValueChange={setIsAnnouncementMode}
                            trackColor={{ false: '#2C2C2E', true: '#5E5CE6' }}
                        />
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.row}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.rowTitle}>Visibility</Text>
                            <Text style={styles.rowDesc}>Public directories vs Invite-Only.</Text>
                        </View>
                        <TouchableOpacity style={styles.badgeBtn} onPress={() => setVisibility((v: any) => v === 'public' ? 'private' : 'public')}>
                            <Text style={styles.badgeText}>{visibility.toUpperCase()}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Actions */}
                <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSave}
                    disabled={saving}
                    activeOpacity={0.8}
                >
                    {saving ? <ActivityIndicator color="#0F0F0F" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F0F0F' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#1C1C1E' },
    backBtn: { width: 40 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
    content: { padding: 20 },
    sectionHeader: { fontSize: 13, fontWeight: 'bold', color: '#8E8E93', textTransform: 'uppercase', marginBottom: 10, marginTop: 20, letterSpacing: 1 },
    card: { backgroundColor: '#1C1C1E', borderRadius: 12, padding: 15 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rowTitle: { fontSize: 16, color: '#fff', fontWeight: '500', marginBottom: 4 },
    rowDesc: { fontSize: 13, color: '#8E8E93', paddingRight: 20 },
    divider: { height: 1, backgroundColor: '#2C2C2E', marginVertical: 15 },
    codeText: { fontSize: 28, fontWeight: 'bold', color: '#fff', letterSpacing: 3 },
    copyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF2D5520', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 6 },
    copyText: { color: '#FF2D55', fontWeight: 'bold', fontSize: 14 },
    badgeBtn: { backgroundColor: '#2C2C2E', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    saveBtn: { backgroundColor: '#FF2D55', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 40 },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});

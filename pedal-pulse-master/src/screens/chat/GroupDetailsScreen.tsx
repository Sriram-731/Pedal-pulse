// GroupDetailsScreen.tsx - WhatsApp-style Group Info Page
import React, { useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Image, Switch, Alert, Modal, TextInput
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGroupDetails, GroupMember } from '../../hooks/useGroupDetails';

export default function GroupDetailsScreen({ route, navigation }: any) {
    const { roomId, roomName } = route.params;
    const insets = useSafeAreaInsets();

    const {
        members, loading, isAdmin, groupName, groupSettings,
        updateGroupName, updateGroupSettings, changeRole, removeMember, leaveGroup
    } = useGroupDetails(roomId);

    const [editNameVisible, setEditNameVisible] = useState(false);
    const [tempName, setTempName] = useState('');
    const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null);

    const handleSaveName = async () => {
        if (!tempName.trim()) return;
        setEditNameVisible(false);
        const { error } = await updateGroupName(tempName.trim());
        if (error) setTempName(groupName); // revert locally
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
                        await leaveGroup();
                        navigation.navigate('MainTabs'); // Go back to chat list
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={28} color="#FF2D55" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Group Info</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* 1. Group Header Section */}
                <View style={styles.heroSection}>
                    <View style={styles.avatarPlaceholder}>
                        <Ionicons name="people" size={60} color="#fff" />
                    </View>

                    <View style={styles.nameRow}>
                        <Text style={styles.heroName}>{groupName || roomName}</Text>
                        {isAdmin && (
                            <TouchableOpacity onPress={() => { setTempName(groupName || roomName); setEditNameVisible(true); }}>
                                <Ionicons name="pencil" size={20} color="#FF2D55" style={{ marginLeft: 10 }} />
                            </TouchableOpacity>
                        )}
                    </View>
                    <Text style={styles.heroMeta}>Group · {members.length} participants</Text>
                </View>

                {/* 2. Admin Settings */}
                {isAdmin && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Group Settings</Text>

                        <View style={styles.settingRow}>
                            <View>
                                <Text style={styles.settingLabel}>Only Admins Can Send Messages</Text>
                                <Text style={styles.settingSub}>Restrict who can chat</Text>
                            </View>
                            <Switch
                                trackColor={{ false: '#333', true: '#FF2D55' }}
                                value={groupSettings?.announcement_mode || false}
                                onValueChange={(val) => { updateGroupSettings({ announcement_mode: val }).catch(console.error); }}
                            />
                        </View>

                        <View style={[styles.settingRow, styles.noBorder]}>
                            <View>
                                <Text style={styles.settingLabel}>Only Admins Can Add Members</Text>
                            </View>
                            <Switch
                                trackColor={{ false: '#333', true: '#FF2D55' }}
                                value={groupSettings?.restrict_invites || false}
                                onValueChange={(val) => { updateGroupSettings({ restrict_invites: val }).catch(console.error); }}
                            />
                        </View>
                    </View>
                )}

                {/* 3. Members List */}
                <View style={styles.section}>
                    <View style={styles.membersHeader}>
                        <Text style={styles.membersCount}>{members.length} participants</Text>
                        <TouchableOpacity onPress={/* TODO: Implement native sharing */ () => { }}>
                            <Ionicons name="search" size={20} color="#FF2D55" />
                        </TouchableOpacity>
                    </View>

                    {isAdmin && (
                        <TouchableOpacity style={styles.addMemberBtn}>
                            <View style={styles.addIconBg}>
                                <Ionicons name="person-add" size={18} color="#fff" />
                            </View>
                            <Text style={styles.addMemberText}>Add participants</Text>
                        </TouchableOpacity>
                    )}

                    {members.slice(0, 10).map((member) => (
                        <TouchableOpacity
                            key={member.user_id}
                            style={styles.memberRow}
                            onPress={() => isAdmin ? setSelectedMember(member) : null}
                            disabled={!isAdmin || member.role === 'owner'}
                        >
                            <View style={styles.memberAvatar}>
                                {member.profiles.avatar_url ? (
                                    <Image source={{ uri: member.profiles.avatar_url }} style={styles.memberAvatarImg} />
                                ) : (
                                    <Ionicons name="person" size={20} color="#fff" />
                                )}
                            </View>
                            <View style={styles.memberInfo}>
                                <Text style={styles.memberName}>{member.profiles.name || 'Member'}</Text>
                            </View>
                            {member.role !== 'member' && (
                                <View style={styles.roleBadge}>
                                    <Text style={styles.roleText}>{member.role === 'owner' ? 'Owner' : 'Admin'}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}

                    {members.length > 10 && (
                        <TouchableOpacity
                            style={styles.viewAllBtn}
                            onPress={() => navigation.navigate('MembersList', { roomId, roomName })}
                        >
                            <Text style={styles.viewAllText}>View All Members</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* 4. Danger Zone */}
                <View style={[styles.section, { marginBottom: 40 }]}>
                    <TouchableOpacity style={styles.dangerRow} onPress={handleLeave}>
                        <Ionicons name="exit-outline" size={24} color="#FF3B30" />
                        <Text style={styles.dangerText}>Exit Group</Text>
                    </TouchableOpacity>

                    {isAdmin && (
                        <TouchableOpacity style={[styles.dangerRow, styles.noBorder]}>
                            <Ionicons name="trash-outline" size={24} color="#FF3B30" />
                            <Text style={styles.dangerText}>Delete Group</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>

            {/* Modals */}
            <Modal visible={editNameVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Edit Group Name</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={tempName}
                            onChangeText={setTempName}
                            autoFocus
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity onPress={() => setEditNameVisible(false)} style={styles.modalBtn}>
                                <Text style={styles.modalBtnTextCancel}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSaveName} style={styles.modalBtn}>
                                <Text style={styles.modalBtnTextSave}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Admin Member Action Sheet */}
            <Modal visible={!!selectedMember} transparent animationType="slide">
                <TouchableOpacity style={styles.sheetOverlay} onPress={() => setSelectedMember(null)}>
                    <View style={styles.sheetContent}>
                        <Text style={styles.sheetTitle}>{selectedMember?.profiles.name}</Text>

                        {selectedMember?.role === 'member' ? (
                            <TouchableOpacity
                                style={styles.sheetBtn}
                                onPress={() => { changeRole(selectedMember.user_id, 'admin'); setSelectedMember(null); }}
                            >
                                <Text style={styles.sheetBtnText}>Make Group Admin</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={styles.sheetBtn}
                                onPress={() => { changeRole(selectedMember!.user_id, 'member'); setSelectedMember(null); }}
                            >
                                <Text style={styles.sheetBtnText}>Dismiss as Admin</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[styles.sheetBtn, { borderBottomWidth: 0 }]}
                            onPress={() => { removeMember(selectedMember!.user_id); setSelectedMember(null); }}
                        >
                            <Text style={[styles.sheetBtnText, { color: '#FF3B30' }]}>Remove from Group</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingBottom: 15, backgroundColor: '#111' },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600' },
    backBtn: { padding: 5, marginLeft: -5 },
    scrollContent: { paddingBottom: 50 },

    heroSection: { alignItems: 'center', backgroundColor: '#111', paddingVertical: 30, marginBottom: 10 },
    avatarPlaceholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
    nameRow: { flexDirection: 'row', alignItems: 'center' },
    heroName: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
    heroMeta: { color: '#888', fontSize: 14, marginTop: 5 },

    section: { backgroundColor: '#111', marginBottom: 10, paddingVertical: 10 },
    sectionTitle: { color: '#FF2D55', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', paddingHorizontal: 20, marginBottom: 10, marginTop: 5 },

    settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
    settingLabel: { color: '#fff', fontSize: 16 },
    settingSub: { color: '#888', fontSize: 13, marginTop: 2 },
    noBorder: { borderBottomWidth: 0 },

    membersHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
    membersCount: { color: '#888', fontSize: 14, fontWeight: '600' },

    addMemberBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
    addIconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF2D55', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    addMemberText: { color: '#FF2D55', fontSize: 16, fontWeight: '500' },

    memberRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
    memberAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    memberAvatarImg: { width: '100%', height: '100%', borderRadius: 20 },
    memberInfo: { flex: 1 },
    memberName: { color: '#fff', fontSize: 16 },
    roleBadge: { backgroundColor: '#FF2D5520', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    roleText: { color: '#FF2D55', fontSize: 11, fontWeight: '600' },

    viewAllBtn: { padding: 15, alignItems: 'center' },
    viewAllText: { color: '#FF2D55', fontSize: 15, fontWeight: '500' },

    dangerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
    dangerText: { color: '#FF3B30', fontSize: 16, marginLeft: 15 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#1c1c1e', width: '80%', borderRadius: 15, padding: 20 },
    modalTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 15, textAlign: 'center' },
    modalInput: { backgroundColor: '#2C2C2E', color: '#fff', padding: 12, borderRadius: 10, fontSize: 16, marginBottom: 20 },
    modalActions: { flexDirection: 'row', justifyContent: 'space-between' },
    modalBtn: { flex: 1, alignItems: 'center', padding: 10 },
    modalBtnTextCancel: { color: '#8E8E93', fontSize: 16, fontWeight: '500' },
    modalBtnTextSave: { color: '#FF2D55', fontSize: 16, fontWeight: '600' },

    sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheetContent: { backgroundColor: '#1c1c1e', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 },
    sheetTitle: { color: '#888', fontSize: 13, textAlign: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
    sheetBtn: { paddingVertical: 18, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#333' },
    sheetBtnText: { color: '#fff', fontSize: 18 },
});

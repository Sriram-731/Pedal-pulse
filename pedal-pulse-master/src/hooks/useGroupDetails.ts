// useGroupDetails.ts - Optimized state management for Group Chats
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { Alert } from 'react-native';

export interface GroupMember {
    user_id: string;
    role: 'owner' | 'admin' | 'member';
    profiles: {
        name: string;
        avatar_url: string | null;
    };
}

export const useGroupDetails = (roomId: string) => {
    const user = useAuthStore(state => state.user);
    const [members, setMembers] = useState<GroupMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    // Group metadata (if it's not a direct message)
    const [groupName, setGroupName] = useState('');
    const [groupSettings, setGroupSettings] = useState<any>({});

    const fetchDetails = useCallback(async () => {
        if (!user || !roomId) return;
        setLoading(true);

        try {
            // 1. Fetch Room Settings
            const { data: roomData, error: roomError } = await supabase
                .from('chat_rooms')
                .select('name, settings')
                .eq('id', roomId)
                .single();

            if (!roomError && roomData) {
                setGroupName(roomData.name || '');
                setGroupSettings(roomData.settings || {});
            }

            // 2. Fetch Members
            const { data: membersData, error: membersError } = await supabase
                .from('chat_participants')
                .select('user_id, role, profiles(name, avatar_url)')
                .eq('room_id', roomId);

            if (membersError) throw membersError;

            if (membersData) {
                const formattedMembers = membersData as any as GroupMember[];

                // Sort by role (Owner -> Admin -> Member)
                formattedMembers.sort((a, b) => {
                    const weight = { owner: 3, admin: 2, member: 1 };
                    return weight[b.role] - weight[a.role];
                });

                setMembers(formattedMembers);

                // Check my role
                const myRole = formattedMembers.find(m => m.user_id === user.id)?.role;
                setIsAdmin(myRole === 'admin' || myRole === 'owner');
            }
        } catch (error) {
            console.error('Failed to fetch group details:', error);
        } finally {
            setLoading(false);
        }
    }, [roomId, user]);

    // Real-time listener for changes in members (useful if someone joins or is kicked while looking at the screen)
    useEffect(() => {
        fetchDetails();

        const channel = supabase
            .channel(`group_details_${roomId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'chat_participants',
                filter: `room_id=eq.${roomId}`
            }, () => {
                // If anything changes in participants (join/leave/role change), re-fetch
                fetchDetails();
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'chat_rooms',
                filter: `id=eq.${roomId}`
            }, (payload) => {
                const newData = payload.new as any;
                if (newData.name) setGroupName(newData.name);
                if (newData.settings) setGroupSettings(newData.settings);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchDetails, roomId]);

    // ----------------------
    // Actions (Admins Only)
    // ----------------------

    const updateGroupName = async (newName: string) => {
        if (!isAdmin) return { error: 'Not authorized' };

        // Optimistic
        const oldName = groupName;
        setGroupName(newName);

        const { error } = await supabase
            .from('chat_rooms')
            .update({ name: newName })
            .eq('id', roomId);

        if (error) {
            setGroupName(oldName);
            Alert.alert('Error', 'Could not update group name.');
            return { error };
        }
        return { success: true };
    };

    const updateGroupSettings = async (newSettings: any) => {
        if (!isAdmin) return { error: 'Not authorized' };

        const updatedSettings = { ...groupSettings, ...newSettings };

        // Optimistic
        const oldSettings = groupSettings;
        setGroupSettings(updatedSettings);

        const { error } = await supabase
            .from('chat_rooms')
            .update({ settings: updatedSettings })
            .eq('id', roomId);

        if (error) {
            setGroupSettings(oldSettings);
            Alert.alert('Error', 'Could not update settings.');
            return { error };
        }
        return { success: true };
    };

    const changeRole = async (targetUserId: string, newRole: 'admin' | 'member') => {
        if (!isAdmin) return { error: 'Not authorized' };

        // Optimistic
        setMembers(prev => prev.map(m => m.user_id === targetUserId ? { ...m, role: newRole } : m));

        const { error } = await supabase
            .from('chat_participants')
            .update({ role: newRole })
            .match({ room_id: roomId, user_id: targetUserId });

        if (error) {
            fetchDetails(); // Revert
            Alert.alert('Error', 'Could not change role. Check permissions.');
            return { error };
        }
        return { success: true };
    };

    const removeMember = async (targetUserId: string) => {
        if (!isAdmin) return { error: 'Not authorized' };

        // Optimistic
        setMembers(prev => prev.filter(m => m.user_id !== targetUserId));

        const { error } = await supabase
            .from('chat_participants')
            .delete()
            .match({ room_id: roomId, user_id: targetUserId });

        if (error) {
            fetchDetails(); // Revert
            Alert.alert('Error', 'Could not remove member.');
            return { error };
        }
        return { success: true };
    };

    const leaveGroup = async () => {
        if (!user) return { error: 'No user' };

        // Real leaving (deletes your row in chat_participants)
        const { error } = await supabase
            .from('chat_participants')
            .delete()
            .match({ room_id: roomId, user_id: user.id });

        if (error) {
            Alert.alert('Error', 'Could not leave group.');
            return { error };
        }
        return { success: true };
    };

    return {
        members,
        loading,
        isAdmin,
        groupName,
        groupSettings,
        updateGroupName,
        updateGroupSettings,
        changeRole,
        removeMember,
        leaveGroup,
        refresh: fetchDetails
    };
};

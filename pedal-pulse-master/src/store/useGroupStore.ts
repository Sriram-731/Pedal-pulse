import { create } from 'zustand';
import { supabase } from '../config/supabase';
import { useAuthStore } from './useAuthStore';

export interface RideGroup {
    id: string;
    name: string;
    description: string;
    creator_id: string;
    is_private: boolean;
    passcode?: string;
    created_at: string;
}

interface GroupState {
    groups: RideGroup[];
    myGroups: RideGroup[];
    isLoading: boolean;
    
    fetchMyGroups: () => Promise<void>;
    searchGroups: (query: string) => Promise<RideGroup[]>;
    createGroup: (group: Partial<RideGroup>) => Promise<boolean>;
    updateGroup: (id: string, updates: Partial<RideGroup>) => Promise<boolean>;
    deleteGroup: (id: string) => Promise<boolean>;
    joinGroup: (groupId: string) => Promise<boolean>;
    leaveGroup: (groupId: string) => Promise<boolean>;
}

export const useGroupStore = create<GroupState>((set, get) => ({
    groups: [],
    myGroups: [],
    isLoading: false,

    fetchMyGroups: async () => {
        const user = useAuthStore.getState().user;
        if (!user) return;

        set({ isLoading: true });
        const { data, error } = await supabase
            .from('ride_groups')
            .select(`
                *,
                ride_group_members!inner(user_id)
            `)
            .eq('ride_group_members.user_id', user.id);

        if (error) {
            console.error('Error fetching my groups:', error.message);
        } else {
            set({ myGroups: data as RideGroup[] });
        }
        set({ isLoading: false });
    },

    searchGroups: async (query: string) => {
        const { data, error } = await supabase
            .from('ride_groups')
            .select('*')
            .ilike('name', `%${query}%`)
            .eq('is_private', false)
            .limit(20);

        if (error) {
            console.error('Error searching groups:', error.message);
            return [];
        }
        return data as RideGroup[];
    },

    createGroup: async (group) => {
        const user = useAuthStore.getState().user;
        if (!user) return false;

        set({ isLoading: true });
        const { data, error } = await supabase
            .from('ride_groups')
            .insert({ ...group, creator_id: user.id })
            .select()
            .single();

        set({ isLoading: false });
        if (error) {
            console.error('Error creating group:', error.message);
            return false;
        }
        
        await get().fetchMyGroups();
        return true;
    },

    updateGroup: async (id, updates) => {
        set({ isLoading: true });
        const { error } = await supabase
            .from('ride_groups')
            .update(updates)
            .eq('id', id);

        set({ isLoading: false });
        if (error) {
            console.error('Error updating group:', error.message);
            return false;
        }
        
        await get().fetchMyGroups();
        return true;
    },

    deleteGroup: async (id) => {
        set({ isLoading: true });
        const { error } = await supabase
            .from('ride_groups')
            .delete()
            .eq('id', id);

        set({ isLoading: false });
        if (error) {
            console.error('Error deleting group:', error.message);
            return false;
        }
        
        await get().fetchMyGroups();
        return true;
    },

    joinGroup: async (groupId) => {
        const user = useAuthStore.getState().user;
        if (!user) return false;

        set({ isLoading: true });
        const { error } = await supabase
            .from('ride_group_members')
            .insert({ group_id: groupId, user_id: user.id });

        set({ isLoading: false });
        if (error) {
            console.error('Error joining group:', error.message);
            return false;
        }
        
        await get().fetchMyGroups();
        return true;
    },

    leaveGroup: async (groupId) => {
        const user = useAuthStore.getState().user;
        if (!user) return false;

        set({ isLoading: true });
        const { error } = await supabase
            .from('ride_group_members')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', user.id);

        set({ isLoading: false });
        if (error) {
            console.error('Error leaving group:', error.message);
            return false;
        }
        
        await get().fetchMyGroups();
        return true;
    }
}));

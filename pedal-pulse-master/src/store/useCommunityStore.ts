import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { Community, CommunityMember, CommunityAuditLog } from '../types/community';
interface CommunityState {
    communities: Record<string, Community>;
    members: Record<string, CommunityMember[]>;
    auditLogs: Record<string, CommunityAuditLog[]>;

    joinedCommunities: Community[];

    // Actions
    fetchCommunities: (userId: string) => Promise<void>;
    fetchMembers: (communityId: string) => Promise<void>;
    fetchAuditLogs: (communityId: string) => Promise<void>;
    joinCommunity: (communityId: string) => Promise<void>;

    // Optimistic UI updates
    updateMemberRole: (communityId: string, userId: string, newRole: string) => void;
    addAuditLog: (communityId: string, log: CommunityAuditLog) => void;
}

export const useCommunityStore = create<CommunityState>()(
    persist(
        (set, get) => ({
            communities: {},
            members: {},
            auditLogs: {},
            joinedCommunities: [],

            fetchCommunities: async (userId: string) => {
                const { data } = await supabase
                    .from('communities')
                    .select('*, community_members!inner(*)')
                    .eq('community_members.user_id', userId);

                if (data) {
                    const commMap = data.reduce((acc, curr) => {
                        acc[curr.id] = curr;
                        return acc;
                    }, {} as Record<string, Community>);
                    set({ communities: commMap, joinedCommunities: data as any });
                }
            },

            joinCommunity: async (communityId: string) => {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error('Not authenticated');

                // Our schema automatically provisions `community_members` IF we insert a `chat_participants` 
                // Alternatively we insert `chat_participants` for community rooms
                // Since this is a Community type, we first need to find its associated room_id
                const { data: roomData, error: roomError } = await supabase
                    .from('chat_rooms')
                    .select('id')
                    .eq('type', 'community')
                    .eq('name', (await supabase.from('communities').select('name').eq('id', communityId).single()).data?.name)
                    .single();

                if (roomError || !roomData) throw new Error('Could not find chat room for this community.');

                const { error } = await supabase
                    .from('chat_participants')
                    .insert({ room_id: roomData.id, user_id: user.id });

                if (error) {
                    if (error.code === '23505') throw new Error('You are already a member');
                    throw error;
                }

                await get().fetchCommunities(user.id); // Refresh
            },

            fetchMembers: async (communityId: string) => {
                const { data } = await supabase
                    .from('community_members')
                    .select('*, profiles(*)')
                    .eq('community_id', communityId)
                    .order('joined_at', { ascending: false });

                if (data) {
                    set((state) => ({
                        members: {
                            ...state.members,
                            [communityId]: data as any,
                        }
                    }));
                }
            },

            fetchAuditLogs: async (communityId: string) => {
                const { data } = await supabase
                    .from('community_audit_logs')
                    .select('*, profiles!actor_id(name), target:profiles!target_id(name)')
                    .eq('community_id', communityId)
                    .order('created_at', { ascending: false })
                    .limit(50);

                if (data) {
                    set((state) => ({
                        auditLogs: {
                            ...state.auditLogs,
                            [communityId]: data as any,
                        }
                    }));
                }
            },

            updateMemberRole: (communityId: string, userId: string, newRole: string) => {
                set((state) => {
                    const communityMembers = state.members[communityId] || [];
                    const updatedMembers = communityMembers.map(m =>
                        m.user_id === userId ? { ...m, role: newRole } : m
                    );
                    return { members: { ...state.members, [communityId]: updatedMembers } };
                });
            },

            addAuditLog: (communityId: string, log: CommunityAuditLog) => {
                set((state) => {
                    const logs = state.auditLogs[communityId] || [];
                    return { auditLogs: { ...state.auditLogs, [communityId]: [log, ...logs] } };
                });
            }
        }),
        {
            name: 'community-storage',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({ communities: state.communities }), // Only persist community list offline
        }
    )
);

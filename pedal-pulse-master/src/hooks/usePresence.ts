// usePresence.ts - Senior Architect Implementation
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface PresenceState {
    user_id: string;
    online_at: string;
}

export const usePresence = (roomId: string) => {
    const user = useAuthStore(state => state.user);
    const [onlineUsers, setOnlineUsers] = useState<Record<string, PresenceState>>({});
    const channelRef = useRef<RealtimeChannel | null>(null);

    useEffect(() => {
        if (!user) return;

        // Cleanup previous channel if it exists
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }

        console.log(`[Presence] Connecting to global presence`);

        const channel = supabase.channel(`global_presence`, {
            config: {
                presence: {
                    key: user.id,
                },
            },
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const filtered: Record<string, PresenceState> = {};

                Object.keys(state).forEach(key => {
                    const presence = state[key] as any;
                    if (presence && presence.length > 0) {
                        filtered[key] = presence[0] as PresenceState;
                    }
                });

                setOnlineUsers(filtered);
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                // optional: console.log(`[Presence] ${key} came online`);
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                // optional: console.log(`[Presence] ${key} went offline`);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        user_id: user.id,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                console.log(`[Presence] Cleaning up global presence`);
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [user?.id]);

    const isUserOnline = (userId: string) => {
        return !!onlineUsers[userId];
    };

    return {
        onlineUsers,
        isUserOnline,
    };
};

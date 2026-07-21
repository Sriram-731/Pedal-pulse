// useTypingIndicator.ts - Senior Architect Implementation
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/useAuthStore';

export const useTypingIndicator = (roomId: string) => {
    const user = useAuthStore(state => state.user);
    const [typingUsers, setTypingUsers] = useState<Record<string, { name: string, timestamp: number }>>({});
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!roomId) return;

        const channel = supabase.channel(`typing:${roomId}`);

        channel
            .on('broadcast', { event: 'typing' }, ({ payload }) => {
                const { userId, name, isTyping } = payload;

                if (userId === user?.id) return;

                setTypingUsers(prev => {
                    const next = { ...prev };
                    if (isTyping) {
                        next[userId] = { name, timestamp: Date.now() };
                    } else {
                        delete next[userId];
                    }
                    return next;
                });

                // Auto-clear typing status after 3 seconds if no stop event is received
                if (isTyping) {
                    setTimeout(() => {
                        setTypingUsers(current => {
                            const updated = { ...current };
                            if (updated[userId] && Date.now() - updated[userId].timestamp >= 3000) {
                                delete updated[userId];
                            }
                            return updated;
                        });
                    }, 3500);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomId, user]);

    const setTyping = useCallback((isTyping: boolean) => {
        if (!user || !roomId) return;

        const channel = supabase.channel(`typing:${roomId}`);
        channel.send({
            type: 'broadcast',
            event: 'typing',
            payload: {
                userId: user.id,
                name: user.email?.split('@')[0] || 'Member', // Fallback if name isn't in store
                isTyping
            }
        });

        // If we started typing, set a timeout to stop it automatically
        if (isTyping) {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                setTyping(false);
            }, 3000);
        }
    }, [roomId, user]);

    return {
        typingUsers: Object.values(typingUsers),
        setTyping
    };
};

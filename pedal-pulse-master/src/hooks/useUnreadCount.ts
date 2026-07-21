import { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/useAuthStore';

export const useUnreadCount = () => {
    const user = useAuthStore(state => state.user);
    const [totalUnread, setTotalUnread] = useState(0);

    useEffect(() => {
        if (!user) return;

        fetchTotalUnread();

        // Subscribe to unread count changes for this user
        const channel = supabase
            .channel(`unread_count:${user.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'chat_participants',
                filter: `user_id=eq.${user.id}`
            }, () => {
                fetchTotalUnread();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    const fetchTotalUnread = async () => {
        if (!user) return;

        const { data, error } = await supabase
            .from('chat_participants')
            .select('unread_count')
            .eq('user_id', user.id);

        if (!error && data) {
            const total = data.reduce((sum, item) => sum + (item.unread_count || 0), 0);
            setTotalUnread(total);
        }
    };

    return totalUnread;
};

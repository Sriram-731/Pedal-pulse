/**
 * useNotificationStore - Zustand store for in-app notifications
 *
 * Features:
 * ✅ Fetches notifications from Supabase
 * ✅ Realtime subscription — new notifications appear instantly
 * ✅ Emergency notifications trigger alarm sound via expo-av
 * ✅ Unread badge count
 * ✅ Mark as read / mark all read
 */

import { create } from 'zustand';
import { supabase } from '../config/supabase';
import { Audio } from 'expo-av';

export interface Notification {
    id: string;
    user_id: string;
    type: 'info' | 'emergency' | 'ride' | 'group';
    title: string;
    body: string;
    data: Record<string, any>;
    is_read: boolean;
    created_at: string;
}

interface NotificationState {
    notifications: Notification[];
    unreadCount: number;
    isLoading: boolean;

    /** Fetch all notifications for the current user */
    fetchNotifications: () => Promise<void>;

    /** Mark a single notification as read */
    markAsRead: (id: string) => Promise<void>;

    /** Mark all notifications as read */
    markAllRead: () => Promise<void>;

    /** Start realtime listener (call once on app init) */
    startRealtimeListener: (userId: string) => void;

    /** Stop realtime listener */
    stopRealtimeListener: () => void;

    /** Delete a single notification */
    deleteNotification: (id: string) => Promise<void>;
}

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
const processedAlertIds = new Set<string>(); // Prevent duplicate alarms per notification

async function playAlarmSound() {
    try {
        await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
        });
        const { sound } = await Audio.Sound.createAsync(
            require('../../assets/sounds/alarm.wav'),
            { shouldPlay: true, isLooping: true, volume: 1.0 }
        );
        // Stop after 15 seconds
        setTimeout(async () => {
            try {
                await sound.stopAsync();
                await sound.unloadAsync();
            } catch { }
        }, 15000);
    } catch (err) {
        console.error('[Notifications] Failed to play alarm:', err);
    }
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notifications: [],
    unreadCount: 0,
    isLoading: false,

    fetchNotifications: async () => {
        set({ isLoading: true });

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            set({ isLoading: false });
            return;
        }

        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) {
            console.error('[Notifications] Fetch error:', error.message);
            set({ isLoading: false });
            return;
        }

        const notifications = (data || []) as Notification[];
        // Mark all existing IDs as processed so they don't re-trigger alarms
        notifications.forEach(n => processedAlertIds.add(n.id));
        set({
            notifications,
            unreadCount: notifications.filter(n => !n.is_read).length,
            isLoading: false,
        });
    },

    markAsRead: async (id: string) => {
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);

        if (!error) {
            set(state => {
                const updated = state.notifications.map(n =>
                    n.id === id ? { ...n, is_read: true } : n
                );
                return {
                    notifications: updated,
                    unreadCount: updated.filter(n => !n.is_read).length,
                };
            });
        }
    },

    markAllRead: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false);

        if (!error) {
            set(state => ({
                notifications: state.notifications.map(n => ({ ...n, is_read: true })),
                unreadCount: 0,
            }));
        }
    },

    deleteNotification: async (id: string) => {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', id);

        if (!error) {
            set(state => {
                const updated = state.notifications.filter(n => n.id !== id);
                return {
                    notifications: updated,
                    unreadCount: updated.filter(n => !n.is_read).length,
                };
            });
        } else {
            console.error('[Notifications] Failed to delete:', error.message);
        }
    },

    startRealtimeListener: (userId: string) => {
        // Don't create duplicate channels
        if (realtimeChannel) return;

        realtimeChannel = supabase
            .channel(`notifications_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                },
                (payload) => {
                    const newNotification = payload.new as Notification;

                    // Only process notifications for this user
                    if (newNotification.user_id !== userId) return;

                    // Deduplicate and process inside Zustand's synchronous set function
                    // This protects against Fast Refresh creating duplicate listeners
                    set(state => {
                        // 1. Check if we already have it
                        if (state.notifications.some(n => n.id === newNotification.id)) {
                            return state; // Bail out, do nothing
                        }

                        // 2. Play alarm ONLY if it's the first time we see it
                        if (newNotification.type === 'emergency') {
                            console.log('[Notifications] 🚨 EMERGENCY notification received!');
                            playAlarmSound();
                        }

                        // 3. Add to state
                        return {
                            notifications: [newNotification, ...state.notifications],
                            unreadCount: state.unreadCount + 1,
                        };
                    });
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[Notifications] Realtime listener active');
                }
            });
    },

    stopRealtimeListener: () => {
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
            realtimeChannel = null;
        }
    },
}));

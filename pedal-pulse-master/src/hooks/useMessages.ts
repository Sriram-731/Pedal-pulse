// useMessages.ts - Production-grade hook with robust deduplication
import { useReducer, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../config/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { Message, MessageStatus } from '../types/chat';

type State = {
    messages: Message[];
    loading: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    error: string | null;
};

type Action =
    | { type: 'FETCH_START' }
    | { type: 'FETCH_SUCCESS'; payload: { messages: Message[]; hasMore: boolean } }
    | { type: 'FETCH_ERROR'; payload: string }
    | { type: 'FETCH_MORE_START' }
    | { type: 'FETCH_MORE_SUCCESS'; payload: { messages: Message[]; hasMore: boolean } }
    | { type: 'UPSERT_MESSAGES'; payload: Message[] } // Handle bulk for better performance
    | { type: 'DELETE_MESSAGE'; payload: string }
    | { type: 'UPDATE_STATUS'; payload: { id: string, status: MessageStatus } }
    | { type: 'UPSERT_REACTION'; payload: { message_id: string, reaction: any } }
    | { type: 'REMOVE_REACTION'; payload: { message_id: string, reaction_id: string } };

const messageReducer = (state: State, action: Action): State => {
    switch (action.type) {
        // ... (FETCH cases remain same)
        case 'FETCH_START':
            return { ...state, loading: true, error: null };
        case 'FETCH_SUCCESS':
            return {
                ...state,
                loading: false,
                messages: action.payload.messages,
                hasMore: action.payload.hasMore
            };
        case 'FETCH_MORE_SUCCESS':
            return {
                ...state,
                loadingMore: false,
                messages: deduplicate([...state.messages, ...action.payload.messages]),
                hasMore: action.payload.hasMore
            };
        case 'UPSERT_MESSAGES':
            return {
                ...state,
                messages: deduplicate([...action.payload, ...state.messages])
            };
        case 'DELETE_MESSAGE':
            return { ...state, messages: state.messages.filter(m => m.id !== action.payload) };
        case 'UPDATE_STATUS':
            return {
                ...state,
                messages: state.messages.map(m => m.id === action.payload.id ? { ...m, status: action.payload.status } : m)
            };
        case 'UPSERT_REACTION':
            return {
                ...state,
                messages: state.messages.map(m => {
                    if (m.id !== action.payload.message_id) return m;
                    const reactions = m.reactions || [];
                    const index = reactions.findIndex(r => r.id === action.payload.reaction.id);
                    const newReactions = index !== -1
                        ? reactions.map((r, i) => i === index ? action.payload.reaction : r)
                        : [...reactions, action.payload.reaction];
                    return { ...m, reactions: newReactions };
                })
            };
        case 'REMOVE_REACTION':
            return {
                ...state,
                messages: state.messages.map(m => {
                    if (m.id !== action.payload.message_id) return m;
                    return {
                        ...m,
                        reactions: (m.reactions || []).filter(r => r.id !== action.payload.reaction_id)
                    };
                })
            };
        default:
            return state;
    }
};

// Robust deduplication logic
// 1. Prioritize real UUIDs over 'temp-' IDs.
// 2. Map by ID to ensure uniqueness.
// 3. Sort by created_at descending.
const deduplicate = (msgs: Message[]): Message[] => {
    const map = new Map<string, Message>();

    // First, map messages by content for temp IDs to find their real counterparts
    const contentMap = new Map<string, string>(); // content -> realId
    msgs.forEach(m => {
        if (!m.id.startsWith('temp-')) {
            contentMap.set(m.content, m.id);
        }
    });

    msgs.forEach(m => {
        // If this is a temp message but we already have a real message with the same content
        if (m.id.startsWith('temp-')) {
            const realId = contentMap.get(m.content);
            if (realId) return; // Skip temp message, real one exists
        }

        // If we already have this ID, don't overwrite if existing has more data (like profiles)
        const existing = map.get(m.id);
        if (existing && existing.profiles && !m.profiles) {
            map.set(m.id, { ...m, ...existing });
        } else {
            map.set(m.id, m);
        }
    });

    return Array.from(map.values()).sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
};

const PAGE_SIZE = 50;

export const useMessages = (roomId: string) => {
    const user = useAuthStore(state => state.user);
    const [state, dispatch] = useReducer(messageReducer, {
        messages: [],
        loading: false,
        loadingMore: false,
        hasMore: true,
        error: null
    });

    const roomIdRef = useRef(roomId);
    useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

    const fetchMessages = useCallback(async (isMore = false) => {
        if (!roomIdRef.current) return;

        if (isMore) dispatch({ type: 'FETCH_MORE_START' });
        else dispatch({ type: 'FETCH_START' });

        const query = supabase
            .from('messages')
            .select('*, profiles(name, avatar_url), reply_to:reply_to_id(*, profiles(name)), reactions:message_reactions(*)')
            .eq('room_id', roomIdRef.current)
            .eq('is_deleted', false)
            .order('created_at', { ascending: false })
            .limit(PAGE_SIZE);

        if (isMore && state.messages.length > 0) {
            query.lt('created_at', state.messages[state.messages.length - 1].created_at);
        }

        const { data, error } = await query;
        if (error) dispatch({ type: 'FETCH_ERROR', payload: error.message });
        else {
            const hasMore = data.length === PAGE_SIZE;
            if (isMore) dispatch({ type: 'FETCH_MORE_SUCCESS', payload: { messages: data as any, hasMore } });
            else dispatch({ type: 'FETCH_SUCCESS', payload: { messages: data as any, hasMore } });
        }
    }, [state.messages]);

    useEffect(() => {
        fetchMessages();

        const channel = supabase
            .channel(`room:${roomId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'messages',
                filter: `room_id=eq.${roomId}`
            }, async (payload) => {
                if (payload.eventType === 'INSERT') {
                    const newMsg = payload.new as Message;
                    if (newMsg.sender_id !== user?.id) {
                        const { data } = await supabase.from('profiles').select('name, avatar_url').eq('id', newMsg.sender_id).single();
                        if (data) newMsg.profiles = data as any;
                    }
                    dispatch({ type: 'UPSERT_MESSAGES', payload: [newMsg] });
                } else if (payload.eventType === 'UPDATE') {
                    dispatch({ type: 'UPSERT_MESSAGES', payload: [payload.new as Message] });
                } else if (payload.eventType === 'DELETE') {
                    dispatch({ type: 'DELETE_MESSAGE', payload: payload.old.id });
                }
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'message_reactions'
            }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    dispatch({ type: 'UPSERT_REACTION', payload: { message_id: payload.new.message_id, reaction: payload.new } });
                } else if (payload.eventType === 'DELETE') {
                    // Find the message that contains this reaction in current state
                    const reactionId = payload.old.id;
                    const message = state.messages.find(m =>
                        (m.reactions || []).some(r => r.id === reactionId)
                    );

                    if (message) {
                        dispatch({ type: 'REMOVE_REACTION', payload: { message_id: message.id, reaction_id: reactionId } });
                    }
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [roomId, user?.id]);

    const sendMessage = async (content: string, mediaUrl?: string, replyToId?: string) => {
        if (!user || (!content.trim() && !mediaUrl)) return;

        const tempId = `temp-${Date.now()}`;
        const optimisticMsg: Message = {
            id: tempId,
            room_id: roomId,
            sender_id: user.id,
            content,
            media_url: mediaUrl,
            created_at: new Date().toISOString(),
            status: 'sending',
            is_deleted: false,
            reply_to_id: replyToId,
            reactions: []
        };

        dispatch({ type: 'UPSERT_MESSAGES', payload: [optimisticMsg] });

        const { data, error } = await supabase
            .from('messages')
            .insert({
                room_id: roomId,
                sender_id: user.id,
                content,
                media_url: mediaUrl,
                reply_to_id: replyToId,
                status: 'sent'
            })
            .select('*, profiles(name, avatar_url), reply_to:reply_to_id(*, profiles(name)), reactions:message_reactions(*)')
            .single();

        if (error) {
            dispatch({ type: 'UPDATE_STATUS', payload: { id: tempId, status: 'error' } });
            return { error };
        } else {
            dispatch({ type: 'UPSERT_MESSAGES', payload: [data as any] });
            return { data };
        }
    };

    const handleReaction = async (messageId: string, emoji: string) => {
        if (!user) return;

        // Check if the user already reacted with this emoji to this message
        const message = state.messages.find(m => m.id === messageId);
        if (!message) return;

        const existingReaction = (message.reactions || []).find(r => r.user_id === user.id && r.emoji === emoji);

        if (existingReaction) {
            // Optimistic Remove
            dispatch({ type: 'REMOVE_REACTION', payload: { message_id: messageId, reaction_id: existingReaction.id } });

            const { error } = await supabase
                .from('message_reactions')
                .delete()
                .eq('id', existingReaction.id);

            if (error) {
                console.error('[Reactions] Remove failed:', error);
                // Revert
                dispatch({ type: 'UPSERT_REACTION', payload: { message_id: messageId, reaction: existingReaction } });
            }
        } else {
            // Optimistic Add
            const tempId = `temp-react-${Date.now()}`;
            const tempReaction = {
                id: tempId,
                message_id: messageId,
                user_id: user.id,
                emoji,
                created_at: new Date().toISOString()
            };
            dispatch({ type: 'UPSERT_REACTION', payload: { message_id: messageId, reaction: tempReaction } });

            const { data, error } = await supabase
                .from('message_reactions')
                .insert({ message_id: messageId, user_id: user.id, emoji })
                .select()
                .single();

            if (error) {
                console.error('[Reactions] Add failed:', error);
                // Revert
                dispatch({ type: 'REMOVE_REACTION', payload: { message_id: messageId, reaction_id: tempId } });
            } else if (data) {
                // Swap temp with real
                dispatch({ type: 'REMOVE_REACTION', payload: { message_id: messageId, reaction_id: tempId } });
                dispatch({ type: 'UPSERT_REACTION', payload: { message_id: messageId, reaction: data } });
            }
        }
    };


    const markAsSeen = async () => {
        if (!user || !roomId) return;

        // 1. Mark individual messages as seen (for read receipts)
        const unseenIds = state.messages
            .filter(m => m.sender_id !== user.id && m.status !== 'seen')
            .map(m => m.id);

        if (unseenIds.length > 0) {
            await supabase.from('message_status').upsert(
                unseenIds.map(mid => ({ message_id: mid, user_id: user.id, status: 'seen' })),
                { onConflict: 'message_id, user_id, status' }
            );
        }

        // 2. Reset global unread count for this participant
        const { error } = await supabase
            .from('chat_participants')
            .update({ unread_count: 0, last_read_at: new Date().toISOString() })
            .match({ room_id: roomId, user_id: user.id });

        if (error) {
            console.error('[markAsSeen] Failed to reset unread_count:', error);
        }
    };

    return {
        ...state,
        sendMessage,
        handleReaction,
        markAsSeen,
        fetchMore: () => fetchMessages(true),
        refresh: () => fetchMessages(false)
    };
};

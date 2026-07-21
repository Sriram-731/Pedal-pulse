// chat.ts - Production Chat Types

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'seen' | 'error';

export interface Profile {
    id: string;
    name: string;
    avatar_url?: string;
    email?: string;
}

export interface Message {
    id: string;
    room_id: string;
    sender_id: string;
    content: string;
    media_url?: string;
    created_at: string;
    status: MessageStatus;
    reply_to_id?: string;
    is_deleted: boolean;
    edited_at?: string;
    profiles?: Profile;
    reactions?: MessageReaction[];
    reply_to?: Message;
}

export interface MessageReaction {
    id: string;
    message_id: string;
    user_id: string;
    emoji: string;
}

export interface ChatParticipant {
    user_id: string;
    room_id: string;
    role: 'owner' | 'admin' | 'member';
    last_read_at: string;
    unread_count: number;
    profiles?: Profile;
}

export interface ChatRoom {
    id: string;
    name: string | null;
    type: 'direct' | 'group' | 'community';
    created_by: string;
    created_at: string;
    updated_at: string;
    last_message_preview?: string;
    chat_participants?: ChatParticipant[];
    metadata?: any;
    settings?: {
        archived?: boolean;
        pinned?: boolean;
    };
}

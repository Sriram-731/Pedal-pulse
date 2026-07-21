export interface Community {
    id: string;
    name: string;
    description: string;
    admin_id: string;
    created_at: string;
    invite_code?: string;
    is_invite_active?: boolean;
    is_verified?: boolean;
    announcement_mode?: boolean;
    visibility?: 'public' | 'private' | 'invite_only';
}

export interface CommunityMember {
    community_id: string;
    user_id: string;
    role: 'owner' | 'admin' | 'moderator' | 'member';
    status: 'pending' | 'approved' | 'rejected' | 'banned';
    is_muted: boolean;
    joined_at: string;
    profiles?: {
        name: string;
        avatar_url?: string;
    };
}

export interface CommunityAuditLog {
    id: string;
    community_id: string;
    actor_id: string;
    action: string;
    target_id?: string;
    details?: any;
    created_at: string;
    profiles?: { name: string };
    target?: { name: string };
}

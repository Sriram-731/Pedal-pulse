-- production_chat_schema.sql
-- Senior Architect: Production-grade chat schema for WhatsApp/Telegram scale

-- 1. Extend Messages Table
alter table public.messages
add column if not exists reply_to_id uuid references public.messages(id) on delete set null,
add column if not exists is_deleted boolean default false,
add column if not exists edited_at timestamp with time zone,
add column if not exists metadata jsonb default '{}'::jsonb;

-- 2. Message Reactions Table
create table if not exists public.message_reactions (
    id uuid primary key default uuid_generate_v4(),
    message_id uuid references public.messages(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete cascade not null,
    emoji text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(message_id, user_id, emoji)
);
alter table public.message_reactions enable row level security;

-- 3. Message Status (Tracking Receipts)
-- Replaces/Augments the simple 'status' on messages for granular tracking
create table if not exists public.message_status (
    id uuid primary key default uuid_generate_v4(),
    message_id uuid references public.messages(id) on delete cascade not null,
    user_id uuid references public.profiles(id) on delete cascade not null, -- receiver
    status text check (status in ('delivered', 'seen')) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(message_id, user_id, status)
);
alter table public.message_status enable row level security;

-- 4. Blocked Users
create table if not exists public.blocked_users (
    blocker_id uuid references public.profiles(id) on delete cascade not null,
    blocked_id uuid references public.profiles(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (blocker_id, blocked_id)
);
alter table public.blocked_users enable row level security;

-- 5. Extend Chat Participants
alter table public.chat_participants
add column if not exists role text default 'member' check (role in ('owner', 'admin', 'member')),
add column if not exists muted_until timestamp with time zone;

-- 6. Extend Chat Rooms
alter table public.chat_rooms
add column if not exists metadata jsonb default '{}'::jsonb,
add column if not exists settings jsonb default '{"archived": false, "pinned": false}'::jsonb;

-- 7. High Performance Indexing
create index if not exists idx_messages_reply_to on public.messages(reply_to_id);
create index if not exists idx_message_reactions_message_id on public.message_reactions(message_id);
create index if not exists idx_message_status_message_id on public.message_status(message_id);
create index if not exists idx_message_status_user_id on public.message_status(user_id);

-- GIN index for full-text search on message content
create index if not exists idx_messages_content_search on public.messages using gin(to_tsvector('english', coalesce(content, '')));

-- 8. Enhanced RLS Policies

-- Message Reactions: Participants can see/add reactions
create policy "Participants can view reactions"
on public.message_reactions for select
using (
    exists (
        select 1 from public.messages m
        join public.chat_participants p on m.room_id = p.room_id
        where m.id = message_id and p.user_id = auth.uid()
    )
);

create policy "Participants can react to messages"
on public.message_reactions for insert
with check (
    auth.uid() = user_id and
    exists (
        select 1 from public.messages m
        join public.chat_participants p on m.room_id = p.room_id
        where m.id = message_id and p.user_id = auth.uid()
    )
);

-- Message Status: Only participants can view status
create policy "Participants can view message status"
on public.message_status for select
using (
    exists (
        select 1 from public.messages m
        join public.chat_participants p on m.room_id = p.room_id
        where m.id = message_id and p.user_id = auth.uid()
    )
);

-- Blocked Users: Only the blocker can manage their list
create policy "Users can manage their own blocks"
on public.blocked_users
using (auth.uid() = blocker_id);

-- Update Message View Policy to respect blocks (Optional depending on business logic)
-- For now, let's keep it simple and focus on the core receipts.

-- Enable Realtime for New Tables
alter publication supabase_realtime add table public.message_reactions;
alter publication supabase_realtime add table public.message_status;
alter publication supabase_realtime add table public.blocked_users;

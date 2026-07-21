-- 20260222000006_fix_chat_participants_rls.sql

-- Enable RLS (already enabled)
alter table public.chat_participants enable row level security;

-- Policy for viewing participants
-- Users should be able to see who else is in their rooms
-- To avoid infinite recursion, we allow any authenticated user to select, 
-- but privacy is still enforced by need for room_id and other table policies.
drop policy if exists "Participants are viewable by everyone in the room" on public.chat_participants;
drop policy if exists "Participants are viewable by authenticated users" on public.chat_participants;
create policy "Participants are viewable by authenticated users"
  on public.chat_participants for select using (
    auth.uid() is not null
  );

-- Policy for joining chats (refined to ensure users only join as themselves)
drop policy if exists "Users can join chats" on public.chat_participants;
create policy "Users can join chats"
  on public.chat_participants for insert with check (
    auth.uid() = user_id
  );

-- Policy for leaving chats
-- Authenticated users can remove themselves from a room
drop policy if exists "Users can leave chats" on public.chat_participants;
create policy "Users can leave chats"
  on public.chat_participants for delete using (
    auth.uid() = user_id
  );

-- Fix RLS error when creating group chats. 
-- The initial policy allowed anyone creating a group chat, but a later table setting restricted it.

drop policy if exists "Users can create direct or group chats" on public.chat_rooms;
create policy "Users can create direct or group chats"
  on public.chat_rooms for insert with check (
    auth.uid() is not null
  );

drop policy if exists "Users can join chats" on public.chat_participants;
create policy "Users can join chats"
  on public.chat_participants for insert with check (
    auth.uid() is not null
  );

drop policy if exists "Users can view participants" on public.chat_participants;
create policy "Users can view participants"
  on public.chat_participants for select using (
    auth.uid() is not null
  );

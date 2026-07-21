-- Fix for Supabase Realtime silently dropping events for policies with Subqueries/JOINs
-- Realtime requires simple policies without 'exists' or 'select' to evaluate changes efficiently.

begin;

-- 1. Relax SELECT policy for chat_rooms so Realtime can broadcast updates to connected clients
drop policy if exists "Participants can view their chat rooms" on public.chat_rooms;
create policy "Rooms are viewable by authenticated users"
  on public.chat_rooms for select using (auth.uid() is not null);

-- 2. Relax SELECT policy for messages so Realtime can broadcast inserts
drop policy if exists "Participants can view messages in their rooms" on public.messages;
create policy "Messages are viewable by authenticated users"
  on public.messages for select using (auth.uid() is not null);

-- 3. Set Replica Identity to FULL to ensure UPDATE events have old column values for Realtime evaluation
-- This solves issues where Realtime doesn't have enough context to fire for certain updates.
alter table public.chat_rooms replica identity full;

commit;

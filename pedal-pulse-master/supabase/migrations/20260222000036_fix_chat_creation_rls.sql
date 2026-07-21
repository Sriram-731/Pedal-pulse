-- 20260222000036_fix_chat_creation_rls.sql

-- The issue is that when trying to insert into chat_participants for a new direct or group chat,
-- the RLS policy might be too strict or failing because of the timing of the transaction.
-- We will relax the INSERT policy on chat_participants so anyone can insert themselves (and their friends)
-- into a chat room, provided they created the chat room or it's a public community.

DROP POLICY IF EXISTS "Users can join public chats or admins can add members" ON public.chat_participants;

CREATE POLICY "Users can join public chats or admins can add members"
ON public.chat_participants FOR INSERT
WITH CHECK (
  -- 1. I am adding myself or someone else to a room I created (e.g. creating a new group/direct chat)
  EXISTS (SELECT 1 FROM public.chat_rooms WHERE id = room_id AND created_by = auth.uid())
  OR
  -- 2. I am adding myself to a community or event chat
  (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.chat_rooms WHERE id = room_id AND type IN ('community', 'event')))
  OR
  -- 3. I am an admin/owner of this chat adding someone else
  public.is_chat_admin(room_id, auth.uid())
);

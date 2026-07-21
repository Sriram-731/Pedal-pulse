-- 20260222000037_fix_chat_participants_circular_rls.sql

-- Creates a security definer function to check chat room ownership without triggering RLS loops
-- since the previous policy failed because the user couldn't SELECT the room before joining it.

CREATE OR REPLACE FUNCTION public.owns_chat_room(check_room_id uuid, check_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chat_rooms
    WHERE id = check_room_id AND created_by = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the old policy
DROP POLICY IF EXISTS "Users can join public chats or admins can add members" ON public.chat_participants;

-- Recreate it using the new bypass function
CREATE POLICY "Users can join public chats or admins can add members"
ON public.chat_participants FOR INSERT
WITH CHECK (
  -- 1. I am adding myself or someone else to a room I created (uses SECURITY DEFINER to bypass SELECT RLS)
  public.owns_chat_room(room_id, auth.uid())
  OR
  -- 2. I am adding myself to a community or event chat (these are public for SELECT via 'type', so no bypass needed)
  (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.chat_rooms WHERE id = room_id AND type IN ('community', 'event')))
  OR
  -- 3. I am an admin/owner of this chat adding someone else
  public.is_chat_admin(room_id, auth.uid())
);

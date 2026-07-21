-- 20260222000022_strict_chat_rls.sql

-- 1. Create indexes to speed up RLS checks
CREATE INDEX IF NOT EXISTS idx_chat_participants_room_user ON public.chat_participants(room_id, user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_role ON public.chat_participants(user_id, role);
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_type ON public.chat_rooms(type);

-- Drop all existing policies on chat tables to start fresh
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public' 
          AND tablename IN ('chat_rooms', 'chat_participants', 'messages')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;


-- ==========================================
-- CHAT ROOMS RLS
-- ==========================================

-- 1. View Chat Rooms
-- Users can view a chat if they are a participant OR if it's a public community/event chat
CREATE POLICY "Users can view chats they belong to or are public"
ON public.chat_rooms FOR SELECT
USING (
  type IN ('community', 'event')
  OR EXISTS (
    SELECT 1 FROM public.chat_participants 
    WHERE chat_participants.room_id = chat_rooms.id 
    AND chat_participants.user_id = auth.uid()
  )
);

-- 2. Create Chat Rooms
-- Any authenticated user can create a chat, assuming they are the creator
CREATE POLICY "Users can create chat rooms"
ON public.chat_rooms FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- 3. Update Chat Rooms
-- Only admins or owners can update chat settings
CREATE POLICY "Admins and owners can update chat rooms"
ON public.chat_rooms FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.chat_participants 
    WHERE chat_participants.room_id = chat_rooms.id 
    AND chat_participants.user_id = auth.uid() 
    AND chat_participants.role IN ('admin', 'owner')
  )
);


-- ==========================================
-- CHAT PARTICIPANTS RLS
-- ==========================================

-- Helper function to bypass RLS for role checks to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.is_chat_member(check_room_id uuid, check_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE room_id = check_room_id AND user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_chat_admin(check_room_id uuid, check_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE room_id = check_room_id AND user_id = check_user_id AND role IN ('admin', 'owner')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 1. View Participants
-- Users can see participants of a chat ONLY IF they are also a participant
CREATE POLICY "Users can view participants of their chat rooms"
ON public.chat_participants FOR SELECT
USING (
  public.is_chat_member(room_id, auth.uid()) OR user_id = auth.uid()
);

-- 2. Insert Participants (Join/Add)
-- Users can join communities/events, OR creators/admins can add members
CREATE POLICY "Users can join public chats or admins can add members"
ON public.chat_participants FOR INSERT
WITH CHECK (
  -- I am adding myself to a community or event chat
  (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.chat_rooms WHERE id = room_id AND type IN ('community', 'event')))
  OR 
  -- I am the creator inserting my own initial membership (owner/admin)
  (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.chat_rooms WHERE id = room_id AND created_by = auth.uid()))
  OR
  -- I am an admin/owner of this chat adding someone else
  public.is_chat_admin(room_id, auth.uid())
);

-- 3. Update Participants
-- Admins/owners can update roles of others, users cannot update their own role
CREATE POLICY "Admins and owners can update participant roles"
ON public.chat_participants FOR UPDATE
USING (
  public.is_chat_admin(room_id, auth.uid())
);

-- 4. Delete Participants (Leave/Remove)
-- Users can remove themselves, admins/owners can remove others
CREATE POLICY "Users can leave or admins can remove users"
ON public.chat_participants FOR DELETE
USING (
  user_id = auth.uid() -- I am leaving
  OR 
  public.is_chat_admin(room_id, auth.uid())
);


-- ==========================================
-- MESSAGES RLS
-- ==========================================

-- 1. View Messages
-- STRICTLY limited to chat participants.
CREATE POLICY "Users can view messages in their chat rooms"
ON public.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_participants.room_id = messages.room_id
    AND chat_participants.user_id = auth.uid()
  )
);

-- 2. Send Messages
-- Only chat participants can insert messages
CREATE POLICY "Users can send messages to their chat rooms"
ON public.messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_participants.room_id = messages.room_id
    AND chat_participants.user_id = auth.uid()
  )
);

-- 3. Update Messages
-- Users can only update their own messages (edit)
CREATE POLICY "Users can update their own messages"
ON public.messages FOR UPDATE
USING (sender_id = auth.uid());

-- 4. Delete Messages
-- Users can only delete their own messages
CREATE POLICY "Users can delete their own messages"
ON public.messages FOR DELETE
USING (sender_id = auth.uid());

-- Ensure Realtime listens to RLS
ALTER TABLE public.messages REPLICA IDENTITY FULL;
-- Note: Rechecking Realtime publication. Supabase already forces RLS on replication if user is authenticated

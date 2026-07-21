-- 20260222000035_fix_participant_read_rls.sql

-- 1. Restore the ability for users to update their own row (specifically for unread_count and last_read_at)
DROP POLICY IF EXISTS "Users can update their own read status" ON public.chat_participants;
CREATE POLICY "Users can update their own read status"
ON public.chat_participants FOR UPDATE
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);

-- 2. Protect the `role` and `status` columns from being modified by non-admins during self-updates
CREATE OR REPLACE FUNCTION public.protect_chat_participant_role_update()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is an UPDATE and the role is changing
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Check if the updater is an admin/owner of the room
    IF NOT public.is_chat_admin(NEW.room_id, auth.uid()) THEN
      -- Reset the role to the old value (silently reject the privilege escalation)
      NEW.role = OLD.role;
    END IF;
  END IF;
  
  -- Users cannot change their own muted_until status unless admin
  IF NEW.muted_until IS DISTINCT FROM OLD.muted_until THEN
    IF NOT public.is_chat_admin(NEW.room_id, auth.uid()) THEN
      NEW.muted_until = OLD.muted_until;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger
DROP TRIGGER IF EXISTS enforce_participant_role_protection ON public.chat_participants;
CREATE TRIGGER enforce_participant_role_protection
  BEFORE UPDATE ON public.chat_participants
  FOR EACH ROW
  EXECUTE PROCEDURE public.protect_chat_participant_role_update();

-- 3. Add Missing INSERT/UPDATE Policies for Message Status (Read Receipts)
DROP POLICY IF EXISTS "Participants can insert message status" ON public.message_status;
CREATE POLICY "Participants can insert message status"
ON public.message_status FOR INSERT
WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.messages m
        JOIN public.chat_participants p ON m.room_id = p.room_id
        WHERE m.id = message_id AND p.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Participants can update message status" ON public.message_status;
CREATE POLICY "Participants can update message status"
ON public.message_status FOR UPDATE
USING (
    user_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.messages m
        JOIN public.chat_participants p ON m.room_id = p.room_id
        WHERE m.id = message_id AND p.user_id = auth.uid()
    )
)
WITH CHECK (
    user_id = auth.uid()
);

-- 4. Add Missing DELETE Policy for Message Reactions
DROP POLICY IF EXISTS "Users can delete their own reactions" ON public.message_reactions;
CREATE POLICY "Users can delete their own reactions"
ON public.message_reactions FOR DELETE
USING (
    auth.uid() = user_id
);

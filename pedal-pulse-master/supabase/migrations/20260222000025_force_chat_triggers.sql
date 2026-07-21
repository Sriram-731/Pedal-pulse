-- 20260222000025_force_chat_triggers.sql
-- Ensure chat_rooms and chat_participants are properly updated on new messages and reactions

-- 1. Ensure columns exist
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS last_message_preview TEXT;
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
ALTER TABLE public.chat_participants ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE public.chat_participants ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;

-- 2. Create the robust trigger function
CREATE OR REPLACE FUNCTION public.handle_new_message()
RETURNS TRIGGER AS $$
DECLARE
  preview_text TEXT;
BEGIN
  -- Determine preview text
  IF NEW.content IS NOT NULL AND TRIM(NEW.content) <> '' THEN
    preview_text := LEFT(NEW.content, 50);
  ELSIF NEW.media_url IS NOT NULL THEN
    preview_text := 'Sent an image';
  ELSE
    preview_text := 'New message';
  END IF;

  -- Update the room's preview and timestamp
  UPDATE public.chat_rooms
  SET last_message_preview = preview_text,
      updated_at = NEW.created_at
  WHERE id = NEW.room_id;

  -- Increment unread count for everyone EXCEPT the sender
  UPDATE public.chat_participants
  SET unread_count = unread_count + 1
  WHERE room_id = NEW.room_id AND user_id != NEW.sender_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Bind the trigger to the messages table
DROP TRIGGER IF EXISTS on_message_created_update_room ON public.messages;
CREATE TRIGGER on_message_created_update_room
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_message();

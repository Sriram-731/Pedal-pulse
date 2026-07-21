-- Add created_by column to chat_rooms to track who created the room for deletion permissions
ALTER TABLE public.chat_rooms ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);

-- Update existing rooms to be owned by some user (e.g. the first participant or community admin)
-- For now we just set them to NULL or the first profile if needed, but for new rooms it will be set.
UPDATE public.chat_rooms cr 
SET created_by = (SELECT admin_id FROM public.communities c WHERE c.id = cr.community_id)
WHERE cr.type = 'community' AND cr.created_by IS NULL;

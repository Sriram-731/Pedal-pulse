-- 20260222000023_events_rls.sql

-- Enable RLS just in case it wasn't
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- EVENTS RLS
-- ==========================================

-- 1. View Events
DROP POLICY IF EXISTS "Events are viewable by everyone" ON public.events;
CREATE POLICY "Events are viewable by everyone"
ON public.events FOR SELECT
USING (true);

-- 2. Create Events
DROP POLICY IF EXISTS "Users can create events" ON public.events;
CREATE POLICY "Users can create events"
ON public.events FOR INSERT
WITH CHECK (auth.uid() = creator_id);

-- 3. Update Events
DROP POLICY IF EXISTS "Creators can update their events" ON public.events;
CREATE POLICY "Creators can update their events"
ON public.events FOR UPDATE
USING (auth.uid() = creator_id);

-- 4. Delete Events
DROP POLICY IF EXISTS "Creators can delete their events" ON public.events;
CREATE POLICY "Creators can delete their events"
ON public.events FOR DELETE
USING (auth.uid() = creator_id);


-- ==========================================
-- EVENT PARTICIPANTS RLS
-- ==========================================

-- 1. View Participants
DROP POLICY IF EXISTS "Event participants are viewable by everyone" ON public.event_participants;
CREATE POLICY "Event participants are viewable by everyone"
ON public.event_participants FOR SELECT
USING (true);

-- 2. Join Event
DROP POLICY IF EXISTS "Users can join events or creators can add participants" ON public.event_participants;
CREATE POLICY "Users can join events or creators can add participants"
ON public.event_participants FOR INSERT
WITH CHECK (
  user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.events 
    WHERE id = event_id AND creator_id = auth.uid()
  )
);

-- 3. Update Participant Status
DROP POLICY IF EXISTS "Users can update their participation or creators can manage" ON public.event_participants;
CREATE POLICY "Users can update their participation or creators can manage"
ON public.event_participants FOR UPDATE
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.events 
    WHERE id = event_id AND creator_id = auth.uid()
  )
);

-- 4. Remove Participant
DROP POLICY IF EXISTS "Users can leave or creators can remove participants" ON public.event_participants;
CREATE POLICY "Users can leave or creators can remove participants"
ON public.event_participants FOR DELETE
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.events 
    WHERE id = event_id AND creator_id = auth.uid()
  )
);

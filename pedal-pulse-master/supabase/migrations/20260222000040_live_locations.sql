-- 20260222000040_live_locations.sql

-- 1. Create the optimal locations table
CREATE TABLE IF NOT EXISTS public.locations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    speed double precision DEFAULT 0,
    heading double precision DEFAULT 0,
    is_emergency boolean DEFAULT false,
    is_active boolean DEFAULT true,
    last_seen timestamp with time zone DEFAULT timezone('utc'::text, now()),
    -- CRITICAL: Prevent duplicate active rows per user per group for strict UPSERT
    UNIQUE(group_id, user_id) 
);

-- Note: we use chat_rooms(id) as the group_id since Pedal Pulse represents ride groups/communities as chat rooms

-- Index for spatial & filtering speed
CREATE INDEX IF NOT EXISTS idx_locations_group_active ON public.locations(group_id, is_active);

-- 2. Turn on Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;

-- 3. RLS Policies
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Helper to check if user is in the group (using your existing chat participants logic)
CREATE OR REPLACE FUNCTION public.is_in_group(check_group_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chat_participants 
    WHERE room_id = check_group_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SELECT Policy: Only members of the group can view locations
CREATE POLICY "View group locations" ON public.locations FOR SELECT
USING (public.is_in_group(group_id));

-- INSERT Policy: You can only update your own location in groups you belong to
CREATE POLICY "Insert own location" ON public.locations FOR INSERT
WITH CHECK (user_id = auth.uid() AND public.is_in_group(group_id));

-- UPDATE Policy: You can only update your own location
CREATE POLICY "Update own location" ON public.locations FOR UPDATE
USING (user_id = auth.uid());

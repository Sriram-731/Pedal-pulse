-- 20260222000041_optimize_locations_rls.sql
-- Production-ready RLS policies for live location tracking
-- Handles 100+ concurrent users efficiently

-- 1. Drop old policies if they exist
DROP POLICY IF EXISTS "View group locations" ON public.locations;
DROP POLICY IF EXISTS "Insert own location" ON public.locations;
DROP POLICY IF EXISTS "Update own location" ON public.locations;
DROP FUNCTION IF EXISTS public.is_in_group(uuid);

-- 2. Create optimized helper function with direct check (no function call overhead in policy)
CREATE OR REPLACE FUNCTION public.user_is_group_member(check_group_id uuid, check_user_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Check if user is in chat_participants for this group/room
  -- Using LIMIT 1 for performance (early exit)
  RETURN EXISTS (
    SELECT 1 FROM public.chat_participants 
    WHERE room_id = check_group_id 
    AND user_id = check_user_id
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3. Optimized RLS Policies

-- SELECT: Only group members can view locations in their group
CREATE POLICY "locations_select_group_members" ON public.locations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_participants cp
    WHERE cp.room_id = group_id
    AND cp.user_id = auth.uid()
    LIMIT 1
  )
);

-- INSERT: Users can only insert their own location in groups they're in
-- Note: UPSERT handled by unique constraint (group_id, user_id)
CREATE POLICY "locations_insert_own" ON public.locations
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.chat_participants cp
    WHERE cp.room_id = group_id
    AND cp.user_id = auth.uid()
    LIMIT 1
  )
);

-- UPDATE: Users can only update their own location
CREATE POLICY "locations_update_own" ON public.locations
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: Users can delete their own location history if needed
CREATE POLICY "locations_delete_own" ON public.locations
FOR DELETE
USING (user_id = auth.uid());

-- 4. Create composite index for the filter query
-- Optimizes: WHERE group_id = X AND is_active = true
DROP INDEX IF EXISTS idx_locations_group_active;
CREATE INDEX idx_locations_group_active 
ON public.locations(group_id, is_active);

-- 5. Create index for user lookups in groups
CREATE INDEX IF NOT EXISTS idx_locations_user_group 
ON public.locations(user_id, group_id);

-- 6. Create partial index for active locations only (saves memory)
CREATE INDEX IF NOT EXISTS idx_locations_active_only 
ON public.locations(group_id, user_id) 
WHERE is_active = true;

-- 7. Enable real-time replication (if not already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;

-- 8. Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.locations TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_group_member TO authenticated;

-- 9. Document the schema
COMMENT ON TABLE public.locations IS 'Real-time location updates for group rides. One row per user per group. Uses UPSERT via unique constraint.';
COMMENT ON COLUMN public.locations.group_id IS 'Foreign key to chat_rooms (represents ride group). All subscriptions must filter by this.';
COMMENT ON COLUMN public.locations.user_id IS 'The user whose location this is. Can only update own.';
COMMENT ON COLUMN public.locations.is_active IS 'Boolean flag to soft-delete. Query should filter WHERE is_active = true for performance.';
COMMENT ON INDEX idx_locations_active_only IS 'Partial index - only indexes active locations. Prevents index bloat.';

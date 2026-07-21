-- 20260222000042_production_locations.sql
-- Production-ready live location tracking
-- One row per user globally, timestamp-based active detection

-- ============================================================
-- 1. DROP OLD TABLES & FUNCTIONS
-- ============================================================
DROP TABLE IF EXISTS public.locations CASCADE;
DROP TABLE IF EXISTS public.live_tracking CASCADE;
DROP FUNCTION IF EXISTS public.is_in_group(uuid);
DROP FUNCTION IF EXISTS public.user_is_group_member(uuid, uuid);

-- ============================================================
-- 2. CREATE LOCATIONS TABLE
-- ============================================================
-- user_id is the PRIMARY KEY → guarantees exactly one row per user
-- A user can only be tracked in one group at a time
CREATE TABLE public.locations (
    user_id    uuid            PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    group_id   uuid            NOT NULL    REFERENCES public.ride_groups(id) ON DELETE CASCADE,
    latitude   double precision NOT NULL,
    longitude  double precision NOT NULL,
    updated_at timestamptz     NOT NULL    DEFAULT now()
);

COMMENT ON TABLE  public.locations IS 'Real-time location tracking. One row per user (UPSERT on user_id). Activity is computed client-side from updated_at.';
COMMENT ON COLUMN public.locations.user_id    IS 'Primary key — only one location row per user globally.';
COMMENT ON COLUMN public.locations.group_id   IS 'The ride group the user is currently being tracked in.';
COMMENT ON COLUMN public.locations.updated_at IS 'Client sends new Date().toISOString() on every upsert. Used for active/inactive detection (10s threshold).';

-- ============================================================
-- 3. INDEXES
-- ============================================================
-- Primary lookup: all locations in a group (used by realtime filter + SELECT)
CREATE INDEX idx_locations_group_id ON public.locations (group_id);

-- Secondary: stale-row cleanup queries ordered by time
CREATE INDEX idx_locations_updated_at ON public.locations (updated_at);

-- ============================================================
-- 4. ENABLE REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- 5a. SELECT: Only members of the same ride group can see locations
CREATE POLICY "locations_select_group_members"
ON public.locations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.ride_group_members rgm
        WHERE rgm.group_id = locations.group_id
          AND rgm.user_id  = auth.uid()
    )
);

-- 5b. INSERT: You can only insert your own row, and only if you are a member of the group
CREATE POLICY "locations_insert_own"
ON public.locations FOR INSERT
WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
        SELECT 1 FROM public.ride_group_members rgm
        WHERE rgm.group_id = locations.group_id
          AND rgm.user_id  = auth.uid()
    )
);

-- 5c. UPDATE: You can only update your own row
CREATE POLICY "locations_update_own"
ON public.locations FOR UPDATE
USING  (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 5d. DELETE: You can only delete your own row (cleanup on leave)
CREATE POLICY "locations_delete_own"
ON public.locations FOR DELETE
USING (user_id = auth.uid());

-- ============================================================
-- 6. GRANTS
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO authenticated;

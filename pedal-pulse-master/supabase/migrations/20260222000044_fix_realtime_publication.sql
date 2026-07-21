-- 20260222000044_fix_realtime_publication.sql
-- Fix: ensure locations table is properly in the realtime publication

-- Use exception handling to safely drop then re-add
DO $$
BEGIN
    -- Try to drop from publication (may not be there)
    BEGIN
        EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.locations';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'locations not in publication, adding fresh';
    END;
END $$;

-- Add to publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;

-- Ensure replica identity
ALTER TABLE public.locations REPLICA IDENTITY FULL;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

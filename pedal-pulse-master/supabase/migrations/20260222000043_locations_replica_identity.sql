-- 20260222000043_locations_replica_identity.sql
-- Supabase Realtime requires REPLICA IDENTITY FULL for filtered subscriptions
-- Without this, subscribing with filter: "group_id=eq.X" causes CHANNEL_ERROR

ALTER TABLE public.locations REPLICA IDENTITY FULL;

-- Enable real-time replication for global app features

-- 1. Enable replication for the publication 'supabase_realtime'
-- This publication is typically already created by Supabase, but we add tables to it.

alter publication supabase_realtime add table public.communities;
alter publication supabase_realtime add table public.community_members;
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.event_participants;
alter publication supabase_realtime add table public.hazard_reports;
alter publication supabase_realtime add table public.ride_groups;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.chat_participants;

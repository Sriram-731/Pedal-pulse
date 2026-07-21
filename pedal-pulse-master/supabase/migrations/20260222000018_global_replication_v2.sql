-- global_replication_v2.sql
-- Ensure all critical chat tables are in the replication publication for real-time

-- Create or update publication to include the 'messages' table explicitly
do $$
begin
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        create publication supabase_realtime;
    end if;
end $$;

-- Explicitly add tables to ensure they are replicated
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.chat_rooms;
alter publication supabase_realtime add table public.chat_participants;
alter publication supabase_realtime add table public.message_reactions;
alter publication supabase_realtime add table public.message_status;

-- Exception handling for tables already in publication
-- (Postgres 15+ allows 'add table if not exists', but generic SQL needs care)
-- Note: Supabase UI handles this well, but for migrations we want idempotency.

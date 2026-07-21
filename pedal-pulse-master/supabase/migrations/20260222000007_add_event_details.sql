-- 20260222000007_add_event_details.sql

-- Add poster and location columns to events
alter table public.events 
  add column if not exists poster_url text,
  add column if not exists location_name text,
  add column if not exists status text default 'upcoming' check (status in ('upcoming', 'ongoing', 'completed', 'cancelled'));

-- RLS for events
alter table public.events enable row level security;

create policy "Events are viewable by everyone"
  on public.events for select using (true);

-- RLS for event participants
alter table public.event_participants enable row level security;

create policy "Participants are viewable by everyone"
  on public.event_participants for select using (true);

create policy "Users can join events"
  on public.event_participants for insert with check (auth.uid() = user_id);

create policy "Users can leave events"
  on public.event_participants for delete using (auth.uid() = user_id);

-- Seed demo events
-- First, get an admin_id (just use the first profile found)
do $$
declare
  v_admin_id uuid;
  v_community_id uuid;
begin
  select id into v_admin_id from public.profiles limit 1;
  select id into v_community_id from public.communities limit 1;

  if v_admin_id is not null and v_community_id is not null then
    insert into public.events (community_id, creator_id, name, description, start_time, location_name, poster_url)
    values 
    (
      v_community_id, 
      v_admin_id, 
      'Night Pulse Ride', 
      'A high-energy night ride through the city heart. All skill levels welcome!', 
      now() + interval '2 days', 
      'Central Park North',
      'https://images.unsplash.com/photo-1541625602330-2277a4c4b282?auto=format&fit=crop&q=80&w=1000'
    ),
    (
      v_community_id, 
      v_admin_id, 
      'Coastal Sprinters', 
      'Morning sprint session along the coastline. High intensity.', 
      now() + interval '5 days', 
      'Pacific Highway Pier',
      'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&q=80&w=1000'
    )
    on conflict do nothing;
  end if;
end $$;

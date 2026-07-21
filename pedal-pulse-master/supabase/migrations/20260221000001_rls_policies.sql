-- Enable Row Level Security (RLS) on all tables

alter table public.profiles enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.events enable row level security;
alter table public.event_participants enable row level security;
alter table public.checkpoints enable row level security;
alter table public.rides enable row level security;
alter table public.ride_coordinates enable row level security;
alter table public.safe_zones enable row level security;
alter table public.hazard_reports enable row level security;
alter table public.chat_rooms enable row level security;  
alter table public.chat_participants enable row level security;
alter table public.messages enable row level security;
alter table public.guardian_links enable row level security;

-- PROFILES
create policy "Public Profiles are viewable by everyone" 
  on public.profiles for select using (true);

create policy "Users can insert their own profile" 
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update their own profile" 
  on public.profiles for update using (auth.uid() = id);

-- COMMUNITIES
create policy "Communities are viewable by everyone"
  on public.communities for select using (true);

create policy "Authenticated users can create communities"
  on public.communities for insert with check (auth.uid() = admin_id);

create policy "Admins can update their communities"
  on public.communities for update using (auth.uid() = admin_id);

-- RIDES
create policy "Users can view their own rides"
  on public.rides for select using (auth.uid() = user_id);

create policy "Users can insert their own rides"
  on public.rides for insert with check (auth.uid() = user_id);

create policy "Users can update their own rides"
  on public.rides for update using (auth.uid() = user_id);

-- RIDE COORDINATES
-- Note: Subqueries in policies can impact performance. We'll use a direct join check.
create policy "Users can insert their own ride coordinates"
  on public.ride_coordinates for insert with check (
    exists (
      select 1 from public.rides 
      where id = ride_id and user_id = auth.uid()
    )
  );

create policy "Users can view their own ride coordinates"
  on public.ride_coordinates for select using (
    exists (
      select 1 from public.rides 
      where id = ride_id and user_id = auth.uid()
    )
  );

-- SAFE ZONES
create policy "Users can manage their own safe zones"
  on public.safe_zones using (auth.uid() = user_id);

-- HAZARD REPORTS
create policy "Hazards are viewable by everyone"
  on public.hazard_reports for select using (true);

create policy "Users can report hazards"
  on public.hazard_reports for insert with check (auth.uid() = reporter_id);

-- CHAT / MESSAGES
create policy "Participants can view their chat rooms"
  on public.chat_rooms for select using (
    exists (
      select 1 from public.chat_participants 
      where room_id = id and user_id = auth.uid()
    )
  );

create policy "Users can create direct or group chats"
  on public.chat_rooms for insert with check (
    auth.uid() is not null and type in ('direct', 'group')
  );

create policy "Community admins can create community chats"
  on public.chat_rooms for insert with check (
    type = 'community' and
    exists (
      select 1 from public.communities 
      where id = chat_rooms.community_id and admin_id = auth.uid()
    )
  );

create policy "Users can join chats"
  on public.chat_participants for insert with check (
    auth.uid() is not null
  );

create policy "Participants can view messages in their rooms"
  on public.messages for select using (
    exists (
      select 1 from public.chat_participants 
      where room_id = messages.room_id and user_id = auth.uid()
    )
  );

create policy "Participants can send messages"
  on public.messages for insert with check (
    auth.uid() = sender_id and
    exists (
      select 1 from public.chat_participants 
      where room_id = messages.room_id and user_id = auth.uid()
    )
  );

create policy "Users can delete their own messages"
  on public.messages for delete using (auth.uid() = sender_id);

-- REALTIME REPLICATION SETUP
-- Supposing supabase is used, we need to add tables to the publication
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;

alter publication supabase_realtime add table public.chat_rooms;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.rides;
alter publication supabase_realtime add table public.ride_coordinates;

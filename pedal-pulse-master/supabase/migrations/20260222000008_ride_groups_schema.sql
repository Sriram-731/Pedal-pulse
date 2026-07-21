-- 1. Ride Groups Table
create table if not exists public.ride_groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  creator_id uuid references public.profiles(id) not null,
  passcode text, -- Optional passcode for private groups
  is_private boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Ride Group Members Table
create table if not exists public.ride_group_members (
  group_id uuid references public.ride_groups(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (group_id, user_id)
);

-- 3. Add group_id to Rides
alter table public.rides add column if not exists group_id uuid references public.ride_groups(id) on delete set null;

-- 4. Live Tracking Table (Optimized for frequent updates)
drop table if exists public.live_tracking;
create table public.live_tracking (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  ride_id uuid references public.rides(id) on delete cascade,
  group_id uuid references public.ride_groups(id) on delete cascade,
  latitude float not null,
  longitude float not null,
  speed float default 0,
  heading float default 0,
  is_emergency boolean default false,
  last_updated timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Helper Function to break recursion
create or replace function public.check_is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean as $$
begin
  return exists (
    select 1
    from public.ride_group_members
    where group_id = p_group_id
    and user_id = p_user_id
  );
end;
$$ language plpgsql security definer;

-- RLS POLICIES

alter table public.ride_groups enable row level security;
alter table public.ride_group_members enable row level security;
alter table public.live_tracking enable row level security;

-- Ride Groups Policies
drop policy if exists "Anyone can view public groups" on public.ride_groups;
create policy "Anyone can view public groups"
  on public.ride_groups for select
  using (not is_private);

drop policy if exists "Members can view their private groups" on public.ride_groups;
create policy "Members can view their private groups"
  on public.ride_groups for select
  using (
    check_is_group_member(id, auth.uid())
  );

drop policy if exists "Authenticated users can create groups" on public.ride_groups;
create policy "Authenticated users can create groups"
  on public.ride_groups for insert
  with check (auth.uid() = creator_id);

drop policy if exists "Creators can update their groups" on public.ride_groups;
create policy "Creators can update their groups"
  on public.ride_groups for update
  using (auth.uid() = creator_id);

drop policy if exists "Creators can delete their groups" on public.ride_groups;
create policy "Creators can delete their groups"
  on public.ride_groups for delete
  using (auth.uid() = creator_id);

-- Ride Group Members Policies
drop policy if exists "Members can view other members" on public.ride_group_members;
create policy "Members can view other members"
  on public.ride_group_members for select
  using (
    check_is_group_member(group_id, auth.uid())
  );

drop policy if exists "Authenticated users can join public groups" on public.ride_group_members;
create policy "Authenticated users can join public groups"
  on public.ride_group_members for insert
  with check (
    exists (
      select 1 from public.ride_groups
      where id = group_id and not is_private
    )
    OR
    exists (
      select 1 from public.ride_groups
      where id = group_id and creator_id = auth.uid()
    )
  );

drop policy if exists "Users can leave groups" on public.ride_group_members;
create policy "Users can leave groups"
  on public.ride_group_members for delete
  using (auth.uid() = user_id);

-- Live Tracking Policies
drop policy if exists "Users can view live locations of group members" on public.live_tracking;
create policy "Users can view live locations of group members"
  on public.live_tracking for select
  using (
    check_is_group_member(group_id, auth.uid())
  );

drop policy if exists "Users can insert their own live location" on public.live_tracking;
create policy "Users can insert their own live location"
  on public.live_tracking for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own live location" on public.live_tracking;
create policy "Users can update their own live location"
  on public.live_tracking for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own live location" on public.live_tracking;
create policy "Users can delete their own live location"
  on public.live_tracking for delete
  using (auth.uid() = user_id);

-- Trigger to automatically add creator to members
create or replace function public.handle_new_ride_group()
returns trigger as $$
begin
  insert into public.ride_group_members (group_id, user_id)
  values (new.id, new.creator_id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_ride_group_created on public.ride_groups;
create trigger on_ride_group_created
  after insert on public.ride_groups
  for each row execute procedure public.handle_new_ride_group();

-- 5. Enable Realtime for Live Tracking
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;
alter publication supabase_realtime add table public.live_tracking;

-- Enable PostGIS extension for geospatial features
create extension if not exists postgis;

-- 1. Profiles Table (Extends auth.users)
create table public.profiles (
  id uuid references auth.users not null primary key,
  name text,
  age integer,
  height float, -- in cm
  weight float, -- in kg
  blood_group text,
  emergency_contact_phone text,
  medical_notes text,
  role text default 'user' check (role in ('user', 'admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Communities Table
create table public.communities (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  admin_id uuid references public.profiles(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Community Members Table
create table public.community_members (
  community_id uuid references public.communities(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (community_id, user_id)
);

-- 4. Events Table
create table public.events (
  id uuid primary key default uuid_generate_v4(),
  community_id uuid references public.communities(id) on delete cascade not null,
  creator_id uuid references public.profiles(id) not null,
  name text not null,
  description text,
  start_time timestamp with time zone not null,
  route_line geometry(LineString, 4326), -- Geospatial route polyline
  buffer_distance float default 50.0, -- Default 50 meters corridor buffer
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Event Participants
create table public.event_participants (
  event_id uuid references public.events(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  status text default 'applied' check (status in ('applied', 'approved', 'rejected')),
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (event_id, user_id)
);

-- 6. Checkpoints Table
create table public.checkpoints (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references public.events(id) on delete cascade not null,
  location geometry(Point, 4326) not null,
  radius_meters float default 20.0,
  order_index integer not null
);

-- 7. Rides Table
create table public.rides (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) not null,
  event_id uuid references public.events(id),
  start_time timestamp with time zone default timezone('utc'::text, now()) not null,
  end_time timestamp with time zone,
  total_distance float default 0, -- in meters
  average_speed float default 0, -- in m/s
  status text default 'active' check (status in ('active', 'paused', 'completed')),
  route_line geometry(LineString, 4326),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Ride Coordinates (High Frequency Points)
create table public.ride_coordinates (
  id uuid primary key default uuid_generate_v4(),
  ride_id uuid references public.rides(id) on delete cascade not null,
  location geometry(Point, 4326) not null,
  speed float default 0,
  altitude float default 0,
  recorded_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. Safe Zones
create table public.safe_zones (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.profiles(id) not null,
  name text,
  zone_polygon geometry(Polygon, 4326) not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 10. Hazard Reports
create table public.hazard_reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid references public.profiles(id) not null,
  location geometry(Point, 4326) not null,
  hazard_type text check (hazard_type in ('pothole', 'accident', 'road_closure', 'other')),
  description text,
  reported_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 11. Chat Rooms
create table public.chat_rooms (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('direct', 'group', 'event', 'community')),
  name text,
  event_id uuid references public.events(id) on delete cascade,
  community_id uuid references public.communities(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 12. Chat Participants
create table public.chat_participants (
  room_id uuid references public.chat_rooms(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (room_id, user_id)
);

-- 13. Messages
create table public.messages (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.chat_rooms(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) not null,
  content text,
  media_url text,
  status text default 'sent' check (status in ('sent', 'delivered', 'read')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 14. Guardian Links (For emergency contacts app-to-app coupling)
create table public.guardian_links (
  cyclist_id uuid references public.profiles(id) not null,
  guardian_id uuid references public.profiles(id) not null,
  status text default 'pending' check (status in ('pending', 'active', 'revoked')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (cyclist_id, guardian_id)
);

-- Database Indexes for Performance & Geospatial Lookups
create index idx_events_route on public.events using gist (route_line);
create index idx_rides_route on public.rides using gist (route_line);
create index idx_ride_coordinates_location on public.ride_coordinates using gist (location);
create index idx_ride_coordinates_ride_id on public.ride_coordinates(ride_id);
create index idx_safe_zones_polygon on public.safe_zones using gist (zone_polygon);
create index idx_hazard_reports_location on public.hazard_reports using gist (location);
create index idx_messages_room on public.messages(room_id, created_at);

-- Trigger to create a profile automatically when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Cyclist'));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- PostGIS Distance validation function for "Safe Zone" checks
-- Returns distance in meters
create or replace function get_distance_to_route(user_location geometry, route_line geometry)
returns float as $$
begin
  return st_distance(
    user_location::geography,
    route_line::geography
  );
end;
$$ language plpgsql IMMUTABLE;

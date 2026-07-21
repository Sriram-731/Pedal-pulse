-- Migration to sync Community Members with Community Chat Rooms

-- 1. Function to handle when a new community chat is created
-- It should add all existing community members to the chat_participants table
create or replace function public.handle_new_community_chat()
returns trigger as $$
begin
  if new.type = 'community' and new.community_id is not null then
    insert into public.chat_participants (room_id, user_id)
    select new.id, user_id
    from public.community_members
    where community_id = new.community_id
    on conflict do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_community_chat_created on public.chat_rooms;
create trigger on_community_chat_created
  after insert on public.chat_rooms
  for each row execute procedure public.handle_new_community_chat();


-- 2. Function to handle when a user joins a community
-- It should add the user to all existing 'community' type chat rooms for that community
create or replace function public.handle_new_community_member()
returns trigger as $$
begin
  insert into public.chat_participants (room_id, user_id)
  select id, new.user_id
  from public.chat_rooms
  where community_id = new.community_id and type = 'community'
  on conflict do nothing;
  
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_community_member_joined on public.community_members;
create trigger on_community_member_joined
  after insert on public.community_members
  for each row execute procedure public.handle_new_community_member();

-- 3. Function to handle when a user leaves a community
-- It should remove the user from all 'community' type chat rooms for that community
create or replace function public.handle_community_member_leave()
returns trigger as $$
begin
  delete from public.chat_participants
  where user_id = old.user_id and room_id in (
    select id from public.chat_rooms
    where community_id = old.community_id and type = 'community'
  );
  
  return old;
end;
$$ language plpgsql security definer;

drop trigger if exists on_community_member_left on public.community_members;
create trigger on_community_member_left
  after delete on public.community_members
  for each row execute procedure public.handle_community_member_leave();

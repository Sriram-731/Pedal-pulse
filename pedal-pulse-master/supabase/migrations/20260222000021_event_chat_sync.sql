-- Migration to sync Event Participants with Event Chat Rooms

-- 1. Function to handle when a new event chat is created
-- It should add all existing event participants to the chat_participants table
create or replace function public.handle_new_event_chat()
returns trigger as $$
begin
  if new.type = 'event' and new.event_id is not null then
    insert into public.chat_participants (room_id, user_id)
    select new.id, user_id
    from public.event_participants
    where event_id = new.event_id
    on conflict do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_event_chat_created on public.chat_rooms;
create trigger on_event_chat_created
  after insert on public.chat_rooms
  for each row execute procedure public.handle_new_event_chat();


-- 2. Function to handle when a user joins an event
-- It should add the user to all existing 'event' type chat rooms for that event
create or replace function public.handle_new_event_participant()
returns trigger as $$
begin
  insert into public.chat_participants (room_id, user_id)
  select id, new.user_id
  from public.chat_rooms
  where event_id = new.event_id and type = 'event'
  on conflict do nothing;
  
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_event_participant_joined on public.event_participants;
create trigger on_event_participant_joined
  after insert on public.event_participants
  for each row execute procedure public.handle_new_event_participant();

-- 3. Function to handle when a user leaves an event
-- It should remove the user from all 'event' type chat rooms for that event
create or replace function public.handle_event_participant_leave()
returns trigger as $$
begin
  delete from public.chat_participants
  where user_id = old.user_id and room_id in (
    select id from public.chat_rooms
    where event_id = old.event_id and type = 'event'
  );
  
  return old;
end;
$$ language plpgsql security definer;

drop trigger if exists on_event_participant_left on public.event_participants;
create trigger on_event_participant_left
  after delete on public.event_participants
  for each row execute procedure public.handle_event_participant_leave();

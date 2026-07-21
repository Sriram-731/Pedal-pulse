-- chat_app_logic.sql
-- Add tracking for the last message in a room and track read status for participants

-- 1. Add fields to chat_rooms to track the latest message for the UI snippet
alter table public.chat_rooms
add column if not exists last_message_preview text,
add column if not exists updated_at timestamp with time zone default timezone('utc'::text, now()) not null;

-- 2. Add field to chat_participants to track when they last read the chat
alter table public.chat_participants
add column if not exists last_read_at timestamp with time zone default timezone('utc'::text, now()) not null;

-- 3. Function to update the chat_room when a new message is inserted
create or replace function public.handle_new_message()
returns trigger as $$
declare
  preview_text text;
begin
  -- determine preview text (either the content or a media indicator)
  if new.content is not null and trim(new.content) <> '' then
    preview_text := left(new.content, 50); -- truncate preview
  elsif new.media_url is not null then
    preview_text := 'Sent an image';
  else
    preview_text := 'New message';
  end if;

  -- update the room
  update public.chat_rooms
  set last_message_preview = preview_text,
      updated_at = new.created_at
  where id = new.room_id;

  return new;
end;
$$ language plpgsql security definer;

-- Trigger to fire on new messages
drop trigger if exists on_message_created_update_room on public.messages;
create trigger on_message_created_update_room
  after insert on public.messages
  for each row execute procedure public.handle_new_message();

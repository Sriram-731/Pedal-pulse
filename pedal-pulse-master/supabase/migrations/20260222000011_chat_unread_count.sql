-- Migration to add Exact Unread Counts to Chat Participants

-- 1. Add unread_count to chat_participants
alter table public.chat_participants
add column if not exists unread_count integer default 0 not null;

-- 2. Update the handle_new_message function to ALSO increment unread_count for other participants
create or replace function public.handle_new_message()
returns trigger as $$
declare
  preview_text text;
begin
  -- determine preview text
  if new.content is not null and trim(new.content) <> '' then
    preview_text := left(new.content, 50);
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

  -- increment unread count for everyone EXCEPT the sender
  update public.chat_participants
  set unread_count = unread_count + 1
  where room_id = new.room_id and user_id != new.sender_id;

  return new;
end;
$$ language plpgsql security definer;

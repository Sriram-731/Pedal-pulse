-- Disable RLS on Chat Tables for Debugging
-- The user is unable to create chats despite being an admin and the policies being applied. 
-- We temporarily disable RLS to rule out policy issues.

alter table public.chat_rooms disable row level security;
alter table public.chat_participants disable row level security;
alter table public.messages disable row level security;

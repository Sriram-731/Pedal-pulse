-- Allow users to update their own chat participants row
-- This is required to clear unread counts

drop policy if exists "Users can update their own chat status" on public.chat_participants;
create policy "Users can update their own chat status" 
  on public.chat_participants for update using (auth.uid() = user_id);

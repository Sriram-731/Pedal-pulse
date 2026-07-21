-- 20260222000005_fix_community_members_rls.sql

-- Enable RLS (already enabled but just in case)
alter table public.community_members enable row level security;

-- Policy for viewing memberships
-- Memberships should be viewable by anyone to show member lists or community info
create policy "Community memberships are viewable by everyone"
  on public.community_members for select using (true);

-- Policy for joining a community
-- Authenticated users can join a community as themselves
create policy "Users can join communities"
  on public.community_members for insert with check (auth.uid() = user_id);

-- Policy for leaving a community
-- Users can remove their own membership
create policy "Users can leave communities"
  on public.community_members for delete using (auth.uid() = user_id);

-- Add email to public.profiles for friend searching

-- 1. Add column
alter table public.profiles
add column if not exists email text;

-- 2. Backfill existing users
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id;

-- 3. Update the handle_new_user function to grab email on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'full_name', 'Cyclist'),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

-- 4. Add index for faster email lookups
create index if not exists idx_profiles_email on public.profiles(email);

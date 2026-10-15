create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[a-z0-9_]{3,24}$'),
  created_at timestamptz not null default now()
);
create unique index user_profiles_username_ci_idx on public.user_profiles (lower(username));

alter table public.user_profiles enable row level security;
revoke all on public.user_profiles from public, anon, authenticated;
grant select on public.user_profiles to service_role;

create or replace function public.create_user_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  normalized_username text;
begin
  normalized_username := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  if normalized_username = '' then return new; end if;
  if normalized_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'username must be 3-24 letters, numbers, or underscores';
  end if;
  insert into public.user_profiles(user_id, username) values (new.id, normalized_username);
  return new;
end;
$$;

create trigger on_auth_user_created_profile after insert on auth.users
for each row execute function public.create_user_profile();

create extension if not exists postgis with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('member', 'moderator', 'admin');
create type public.report_status as enum (
  'pending_review', 'needs_more_info', 'reviewed', 'insufficient_evidence',
  'rejected', 'withdrawn', 'closed'
);

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'member',
  created_at timestamptz not null default now(),
  granted_by uuid references auth.users(id),
  constraint role_grant_not_self check (granted_by is null or granted_by <> user_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete restrict,
  description text not null check (char_length(description) between 8 and 1600),
  point extensions.geography(point, 4326) not null,
  observed_at timestamptz not null,
  status public.report_status not null default 'pending_review',
  status_reason text,
  public_summary text,
  public_consent boolean not null default false,
  verification_level text not null default 'unreviewed'
    check (verification_level in ('unreviewed', 'team_reviewed', 'official_source')),
  data_mode text not null default 'real' check (data_mode in ('real', 'simulation')),
  expires_at timestamptz not null default (now() + interval '2 hours'),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reports_point_gix on public.reports using gist(point);
create index reports_status_observed_idx on public.reports(status, observed_at desc);
create index reports_author_created_idx on public.reports(author_id, created_at desc);

create table public.report_events (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.reports(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('submitted', 'updated', 'moderated', 'withdrawn', 'deleted')),
  old_status public.report_status,
  new_status public.report_status,
  reason text,
  report_version integer not null,
  created_at timestamptz not null default now()
);

create table public.report_media (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size integer not null check (byte_size between 1 and 2097152),
  sha256 text not null,
  created_at timestamptz not null default now()
);

create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer
set search_path = ''
as $$ select role from public.user_roles where user_id = (select auth.uid()) $$;

create or replace function public.is_moderator()
returns boolean
language sql stable security definer
set search_path = ''
as $$ select coalesce(public.current_app_role() in ('moderator', 'admin'), false) $$;

create or replace function public.moderate_report(
  p_report_id uuid,
  p_expected_version integer,
  p_status public.report_status,
  p_reason text,
  p_public_summary text,
  p_verification_level text
)
returns table(id uuid, status public.report_status, version integer, updated_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  if not (select public.is_moderator()) then
    raise exception 'moderator permission required' using errcode = '42501';
  end if;
  if p_status not in ('needs_more_info', 'reviewed', 'insufficient_evidence', 'rejected', 'closed') then
    raise exception 'invalid moderation status' using errcode = '22023';
  end if;
  if p_verification_level not in ('unreviewed', 'team_reviewed') then
    raise exception 'official status requires a sourced official bulletin' using errcode = '22023';
  end if;
  if p_status = 'reviewed' and char_length(btrim(coalesce(p_public_summary, ''))) < 8 then
    raise exception 'reviewed report requires a public summary' using errcode = '22023';
  end if;
  return query update public.reports as r
    set status = p_status,
        status_reason = left(coalesce(p_reason, ''), 500),
        public_summary = case when p_status = 'reviewed' then left(coalesce(p_public_summary, ''), 280) else null end,
        verification_level = case when p_status = 'reviewed' then p_verification_level else 'unreviewed' end
    where r.id = p_report_id and r.version = p_expected_version and r.data_mode = 'real'
    returning r.id, r.status, r.version, r.updated_at;
  if not found then
    raise exception 'report not found or version conflict' using errcode = '40001';
  end if;
end;
$$;
revoke all on function public.moderate_report(uuid, integer, public.report_status, text, text, text) from public, anon;
grant execute on function public.moderate_report(uuid, integer, public.report_status, text, text, text) to authenticated;

create or replace function public.create_member_role()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.user_roles(user_id, role) values (new.id, 'member') on conflict (user_id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created_role after insert on auth.users
for each row execute function public.create_member_role();

create or replace function public.bump_report_version()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  new.version := old.version + 1;
  return new;
end;
$$;
create trigger reports_bump_version before update on public.reports
for each row execute function public.bump_report_version();

create or replace function public.withdraw_report(p_report_id uuid, p_expected_version integer, p_reason text)
returns table(id uuid, status public.report_status, version integer)
language plpgsql security definer set search_path = ''
as $$
begin
  return query update public.reports as r
    set status = 'withdrawn', status_reason = left(btrim(coalesce(p_reason, 'Người gửi đã rút phản ánh')), 500)
    where r.id = p_report_id and r.author_id = (select auth.uid())
      and r.version = p_expected_version and r.status in ('pending_review', 'needs_more_info')
    returning r.id, r.status, r.version;
  if not found then raise exception 'report not found, not withdrawable, or version conflict' using errcode = '40001'; end if;
end;
$$;
revoke all on function public.withdraw_report(uuid, integer, text) from public, anon;
grant execute on function public.withdraw_report(uuid, integer, text) to authenticated;

create or replace function public.append_report_event()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.report_events(report_id, actor_id, action, old_status, new_status, reason, report_version)
  values (new.id, (select auth.uid()),
    case when tg_op = 'INSERT' then 'submitted'
         when old.status is distinct from new.status and new.status = 'withdrawn' then 'withdrawn'
         when old.status is distinct from new.status then 'moderated'
         else 'updated' end,
    case when tg_op = 'INSERT' then null else old.status end, new.status,
    case when tg_op = 'INSERT' then null else new.status_reason end, new.version);
  return new;
end;
$$;
create trigger reports_append_event after insert or update on public.reports
for each row execute function public.append_report_event();

alter table public.user_roles enable row level security;
alter table public.reports enable row level security;
alter table public.report_events enable row level security;
alter table public.report_media enable row level security;

create policy "Users can read own role; moderators can read roles"
  on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_moderator()));

create policy "Authors and moderators can read private reports"
  on public.reports for select to authenticated
  using (author_id = (select auth.uid()) or (select public.is_moderator()));
create policy "Authenticated members can submit real reports"
  on public.reports for insert to authenticated
  with check (author_id = (select auth.uid()) and status = 'pending_review'
    and data_mode = 'real' and verification_level = 'unreviewed' and public_consent
    and expires_at > observed_at and expires_at <= observed_at + interval '2 hours');
create policy "Authors can update their pending reports"
  on public.reports for update to authenticated
  using (author_id = (select auth.uid()) and status in ('pending_review', 'needs_more_info'))
  with check (author_id = (select auth.uid()) and status in ('pending_review', 'needs_more_info')
    and data_mode = 'real' and verification_level = 'unreviewed');
create policy "Moderators can review reports"
  on public.reports for update to authenticated
  using ((select public.is_moderator()))
  with check ((select public.is_moderator()) and data_mode = 'real');

create policy "Report owners and moderators can read history"
  on public.report_events for select to authenticated
  using (exists (select 1 from public.reports r where r.id = report_id
    and (r.author_id = (select auth.uid()) or (select public.is_moderator()))));
create policy "Report owners and moderators can read media metadata"
  on public.report_media for select to authenticated
  using (exists (select 1 from public.reports r where r.id = report_id
    and (r.author_id = (select auth.uid()) or (select public.is_moderator()))));

revoke all on public.user_roles, public.reports, public.report_events, public.report_media from anon;
revoke insert, delete on public.user_roles from anon, authenticated;
revoke update on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;
grant select on public.reports to authenticated;
grant insert (author_id, description, point, observed_at, expires_at, data_mode, public_consent) on public.reports to authenticated;
grant update (description, point, observed_at) on public.reports to authenticated;
grant select on public.report_events, public.report_media to authenticated;

-- Sanitized public feed deliberately excludes author identity and original text.
create or replace view public.public_reports with (security_barrier = true) as
select id, public_summary, verification_level,
  round(extensions.st_y(point::extensions.geometry)::numeric, 4)::double precision as latitude,
  round(extensions.st_x(point::extensions.geometry)::numeric, 4)::double precision as longitude,
  observed_at, expires_at, status, updated_at
from public.reports
where status in ('reviewed', 'insufficient_evidence', 'closed')
  and data_mode = 'real' and public_consent
  and public_summary is not null and char_length(btrim(public_summary)) > 0;
revoke all on public.public_reports from anon, authenticated;
grant select on public.public_reports to anon, authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('report-private', 'report-private', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy "Owners upload into their report namespace"
on storage.objects for insert to authenticated
with check (bucket_id = 'report-private' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owners and moderators read private report images"
on storage.objects for select to authenticated
using (bucket_id = 'report-private' and ((storage.foldername(name))[1] = (select auth.uid())::text
  or (select public.is_moderator())));

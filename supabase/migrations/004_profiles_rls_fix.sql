-- Repair authenticated profile access and ensure signup always has a profile row.
-- Apply after migrations 001, 002, and 003.

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated;

grant select, insert, update on table public.profiles to authenticated;
alter table public.profiles enable row level security;

create or replace function public.is_workspace_advisor(ws uuid) returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspace_advisors a
    where a.workspace_id = ws and a.user_id = auth.uid()
  )
$$;

create or replace function public.is_workspace_member(ws uuid) returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
      and m.is_active
  ) and not public.is_workspace_advisor(ws)
$$;

create or replace function public.has_workspace_access(ws uuid) returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select public.is_workspace_member(ws) or public.is_workspace_advisor(ws)
$$;

drop policy if exists "profiles: own or staff" on public.profiles;
drop policy if exists "profiles: own select" on public.profiles;
drop policy if exists "profiles: workspace peers" on public.profiles;
drop policy if exists "profiles: own insert" on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;
drop policy if exists "profiles: own update" on public.profiles;

create policy "profiles: own select" on public.profiles
for select to authenticated
using (id = auth.uid() or is_staff());

create policy "profiles: workspace peers" on public.profiles
for select to authenticated
using (
  exists (
    select 1
    from public.workspace_members m
    where m.user_id = profiles.id
      and (
        public.is_workspace_member(m.workspace_id)
        or public.is_workspace_advisor(m.workspace_id)
      )
  )
  or exists (
    select 1
    from public.workspace_advisors a
    where a.user_id = profiles.id
      and (
        public.is_workspace_member(a.workspace_id)
        or public.is_workspace_advisor(a.workspace_id)
      )
  )
);

create policy "profiles: own insert" on public.profiles
for insert to authenticated
with check (
  id = auth.uid()
  and role = 'student'
  and status = 'approved'
);

create policy "profiles: own update" on public.profiles
for update to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and role = (select p.role from public.profiles p where p.id = auth.uid())
  and status = (select p.status from public.profiles p where p.id = auth.uid())
);

alter table public.workspace_members enable row level security;
drop policy if exists "members: read" on public.workspace_members;
drop policy if exists "members: manage" on public.workspace_members;
drop policy if exists "members: read access" on public.workspace_members;
drop policy if exists "members: read own or workspace" on public.workspace_members;
create policy "members: read own or workspace" on public.workspace_members
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_workspace_member(workspace_id)
  or public.is_workspace_advisor(workspace_id)
);

create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles as current_profile (id, email, full_name, academic_year, department, semester)
  values (
    new.id,
    lower(new.email),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'academic_year',
    new.raw_user_meta_data->>'department',
    new.raw_user_meta_data->>'semester'
  )
  on conflict (id) do update
  set email = coalesce(excluded.email, current_profile.email),
      full_name = coalesce(excluded.full_name, current_profile.full_name),
      academic_year = coalesce(excluded.academic_year, current_profile.academic_year),
      department = coalesce(excluded.department, current_profile.department),
      semester = coalesce(excluded.semester, current_profile.semester);
  return new;
end;
$$;

drop trigger if exists trg_new_user on auth.users;
create trigger trg_new_user
after insert on auth.users
for each row execute function public.handle_new_user();

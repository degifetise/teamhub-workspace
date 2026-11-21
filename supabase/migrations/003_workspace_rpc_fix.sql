-- Repair workspace creation and join-code generation on existing deployments.
-- Safe to apply after migrations 001 and 002, or paste into the Supabase SQL Editor.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create or replace function public.create_workspace(
  p_name text,
  p_mode text default 'capstone',
  p_advisor_name text default null,
  p_advisor_email text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  created workspaces%rowtype;
  code text;
begin
  if auth.uid() is null then
    raise exception 'Sign in is required';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Workspace name is required';
  end if;
  if p_mode not in ('capstone', 'internship', 'general') then
    raise exception 'Invalid workspace mode';
  end if;

  loop
    code := 'PPMS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    insert into public.workspaces (name, join_code, mode, advisor_name, advisor_email, created_by)
    values (
      trim(p_name),
      code,
      p_mode,
      nullif(trim(p_advisor_name), ''),
      nullif(lower(trim(p_advisor_email)), ''),
      auth.uid()
    )
    on conflict (join_code) do nothing
    returning * into created;
    if found then
      exit;
    end if;
  end loop;

  -- The existing schema represents the creator as a Team Lead membership;
  -- ownership permissions are derived from workspaces.created_by.
  insert into public.workspace_members (workspace_id, user_id, team_role, email, is_active)
  select created.id, auth.uid(), 'Team Lead', lower(u.email), true
  from auth.users u
  where u.id = auth.uid()
  on conflict (workspace_id, user_id) do update
    set team_role = 'Team Lead',
        email = excluded.email,
        is_active = true;

  return to_jsonb(created);
end;
$$;

create or replace function public.regenerate_workspace_join_code(p_workspace_id uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_code text;
begin
  if not public.can_manage_workspace_team(p_workspace_id) then
    raise exception 'Only a team lead or owner can change the join code';
  end if;

  loop
    new_code := 'PPMS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      update public.workspaces
      set join_code = new_code
      where id = p_workspace_id;
      if found then
        return new_code;
      end if;
      return null;
    exception when unique_violation then
      continue;
    end;
  end loop;
end;
$$;

revoke all on function public.create_workspace(text, text, text, text) from public;
revoke all on function public.join_team_by_code(text) from public;
revoke all on function public.regenerate_workspace_join_code(uuid) from public;

grant execute on function public.create_workspace(text, text, text, text) to authenticated;
grant execute on function public.join_team_by_code(text) to authenticated;
grant execute on function public.regenerate_workspace_join_code(uuid) to authenticated;

notify pgrst, 'reload schema';

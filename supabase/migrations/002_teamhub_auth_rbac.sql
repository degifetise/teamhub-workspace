-- TeamHub auth, per-workspace authorization, realtime and private storage.
-- Apply after 001_ppms_workspace_schema.sql.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table profiles alter column status set default 'approved';
update profiles set status = 'approved' where status = 'pending';
alter table chat_messages add column if not exists audio_storage_path text;
alter table chat_messages drop constraint if exists chat_messages_check;
alter table chat_messages drop constraint if exists chat_messages_content_present;
alter table chat_messages add constraint chat_messages_content_present
  check (body is not null or audio_url is not null or audio_storage_path is not null);

create table if not exists workspace_advisors (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  linked_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create or replace function is_workspace_advisor(ws uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from workspace_advisors a
    where a.workspace_id = ws and a.user_id = auth.uid()
  )
$$;

create or replace function is_workspace_member(ws uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid() and m.is_active
  ) and not is_workspace_advisor(ws)
$$;

create or replace function has_workspace_access(ws uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select is_workspace_member(ws) or is_workspace_advisor(ws)
$$;

create or replace function can_manage_workspace_team(ws uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select not is_workspace_advisor(ws) and exists (
    select 1 from workspaces w
    where w.id = ws and (
      w.created_by = auth.uid()
      or exists (
        select 1 from workspace_members m
        where m.workspace_id = ws and m.user_id = auth.uid()
          and m.is_active and m.team_role = 'Team Lead'
      )
    )
  )
$$;

create or replace function link_confirmed_advisor_workspaces() returns integer
language plpgsql security definer set search_path = public as $$
declare
  current_email text;
  count_linked integer;
begin
  select lower(email) into current_email
  from auth.users
  where id = auth.uid() and email_confirmed_at is not null;

  if current_email is null then
    return 0;
  end if;

  insert into workspace_advisors (workspace_id, user_id)
  select id, auth.uid()
  from workspaces
  where lower(trim(coalesce(advisor_email, ''))) = current_email
    and coalesce(trim(advisor_name), '') <> ''
  on conflict do nothing;

  get diagnostics count_linked = row_count;
  return count_linked;
end
$$;

create or replace function sync_workspace_advisor_link() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from workspace_advisors a
  where a.workspace_id = new.id
    and not exists (
      select 1 from auth.users u
      where u.id = a.user_id and u.email_confirmed_at is not null
        and lower(u.email) = lower(trim(coalesce(new.advisor_email, '')))
    );
  insert into workspace_advisors (workspace_id, user_id)
  select new.id, u.id
  from auth.users u
  where u.email_confirmed_at is not null
    and lower(u.email) = lower(trim(coalesce(new.advisor_email, '')))
    and coalesce(trim(new.advisor_name), '') <> ''
  on conflict do nothing;
  return new;
end
$$;
drop trigger if exists trg_sync_workspace_advisor_link on workspaces;
create trigger trg_sync_workspace_advisor_link
after update of advisor_name, advisor_email on workspaces
for each row execute function sync_workspace_advisor_link();

create or replace function create_workspace(
  p_name text,
  p_mode text default 'capstone',
  p_advisor_name text default null,
  p_advisor_email text default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  created workspaces%rowtype;
  code text;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Workspace name is required'; end if;
  if p_mode not in ('capstone', 'internship', 'general') then raise exception 'Invalid workspace mode'; end if;

  loop
    code := 'PPMS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    insert into workspaces (name, join_code, mode, advisor_name, advisor_email, created_by)
    values (trim(p_name), code, p_mode, nullif(trim(p_advisor_name), ''), nullif(lower(trim(p_advisor_email)), ''), auth.uid())
    on conflict (join_code) do nothing
    returning * into created;
    if found then exit; end if;
  end loop;

  insert into workspace_members (workspace_id, user_id, team_role, email, is_active)
  select created.id, auth.uid(), 'Team Lead', lower(u.email), true
  from auth.users u
  where u.id = auth.uid()
  on conflict (workspace_id, user_id) do update
    set team_role = 'Team Lead', email = excluded.email, is_active = true;

  return to_jsonb(created);
end
$$;

create or replace function add_workspace_member(
  p_workspace_id uuid,
  p_email text,
  p_team_role text default 'Frontend'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  if not can_manage_workspace_team(p_workspace_id) then raise exception 'Only a team lead or owner can add members'; end if;
  if p_team_role not in ('Team Lead', 'Frontend', 'Backend', 'Database', 'Docs/QA') then raise exception 'Invalid member role'; end if;
  select u.id into target
  from auth.users u
  where lower(u.email) = lower(trim(p_email)) and u.email_confirmed_at is not null;
  if target is null then raise exception 'No confirmed account matches that email'; end if;

  insert into workspace_members (workspace_id, user_id, team_role, email, is_active)
  values (p_workspace_id, target, p_team_role, lower(trim(p_email)), true)
  on conflict (workspace_id, user_id) do update
    set team_role = excluded.team_role, email = excluded.email, is_active = true;
  return target;
end
$$;

create or replace function regenerate_workspace_join_code(p_workspace_id uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare new_code text;
begin
  if not can_manage_workspace_team(p_workspace_id) then raise exception 'Only a team lead or owner can change the join code'; end if;
  loop
    new_code := 'PPMS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      update workspaces set join_code = new_code where id = p_workspace_id;
      if found then return new_code; end if;
      return null;
    exception when unique_violation then
      continue;
    end;
  end loop;
end
$$;

create or replace function set_workspace_join_lock(p_workspace_id uuid, p_locked boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_manage_workspace_team(p_workspace_id) then raise exception 'Only a team lead or owner can lock the join code'; end if;
  update workspaces set is_locked = p_locked where id = p_workspace_id;
end
$$;

create or replace function delete_workspace(p_workspace_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if is_workspace_advisor(p_workspace_id) or not exists (
    select 1 from workspaces where id = p_workspace_id and created_by = auth.uid()
  ) then
    raise exception 'Only the workspace owner can delete this workspace';
  end if;
  delete from storage.objects
  where bucket_id in ('workspace-documents', 'voice-notes')
    and name like p_workspace_id::text || '/%';
  delete from workspaces where id = p_workspace_id;
end
$$;

create or replace function review_weekly_log(p_log_id uuid, p_status text, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  if p_status not in ('Approved', 'Needs Changes') then raise exception 'Invalid review status'; end if;
  select workspace_id into ws from weekly_logs where id = p_log_id;
  if ws is null or not is_workspace_advisor(ws) then raise exception 'Only the linked advisor can review this log'; end if;
  update weekly_logs
  set status = p_status, review_note = p_note, reviewed_by = auth.uid()
  where id = p_log_id and status = 'Pending';
  if not found then raise exception 'Only pending logbooks can be reviewed'; end if;
end
$$;

create or replace function join_team_by_code(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  select id into ws from workspaces
  where join_code = upper(trim(p_code)) and not is_locked;
  if ws is null then return null; end if;
  insert into workspace_members (workspace_id, user_id, team_role, is_active)
  values (ws, auth.uid(), 'Frontend', true)
  on conflict (workspace_id, user_id) do update set is_active = true;
  return ws;
end
$$;

revoke all on function link_confirmed_advisor_workspaces() from public;
revoke all on function create_workspace(text, text, text, text) from public;
revoke all on function add_workspace_member(uuid, text, text) from public;
revoke all on function regenerate_workspace_join_code(uuid) from public;
revoke all on function set_workspace_join_lock(uuid, boolean) from public;
revoke all on function delete_workspace(uuid) from public;
revoke all on function review_weekly_log(uuid, text, text) from public;
revoke all on function join_team_by_code(text) from public;
grant execute on function link_confirmed_advisor_workspaces() to authenticated;
grant execute on function create_workspace(text, text, text, text) to authenticated;
grant execute on function add_workspace_member(uuid, text, text) to authenticated;
grant execute on function regenerate_workspace_join_code(uuid) to authenticated;
grant execute on function set_workspace_join_lock(uuid, boolean) to authenticated;
grant execute on function delete_workspace(uuid) to authenticated;
grant execute on function review_weekly_log(uuid, text, text) to authenticated;
grant execute on function join_team_by_code(text) to authenticated;

alter table profiles enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table workspace_advisors enable row level security;

drop policy if exists "profiles: own or staff" on profiles;
drop policy if exists "profiles: workspace peers" on profiles;
create policy "profiles: own or staff" on profiles for select
using (id = auth.uid() or is_staff());
create policy "profiles: workspace peers" on profiles for select
using (
  exists (select 1 from workspace_members m where m.user_id = profiles.id and has_workspace_access(m.workspace_id))
  or exists (select 1 from workspace_advisors a where a.user_id = profiles.id and has_workspace_access(a.workspace_id))
);

drop policy if exists "workspaces: read" on workspaces;
drop policy if exists "workspaces: create" on workspaces;
drop policy if exists "workspaces: update" on workspaces;
drop policy if exists "workspaces: read access" on workspaces;
drop policy if exists "workspaces: owner update" on workspaces;
create policy "workspaces: read access" on workspaces for select using (has_workspace_access(id) or created_by = auth.uid());
create policy "workspaces: owner update" on workspaces for update
using (created_by = auth.uid() and not is_workspace_advisor(id))
with check (created_by = auth.uid() and not is_workspace_advisor(id));

drop policy if exists "members: read" on workspace_members;
drop policy if exists "members: manage" on workspace_members;
drop policy if exists "members: read access" on workspace_members;
drop policy if exists "members: lead update" on workspace_members;
drop policy if exists "members: lead remove" on workspace_members;
create policy "members: read access" on workspace_members for select using (has_workspace_access(workspace_id));
create policy "members: lead update" on workspace_members for update
using (can_manage_workspace_team(workspace_id) and user_id <> (select created_by from workspaces where id = workspace_id))
with check (can_manage_workspace_team(workspace_id) and user_id <> (select created_by from workspaces where id = workspace_id));
create policy "members: lead remove" on workspace_members for delete
using (can_manage_workspace_team(workspace_id) and user_id <> (select created_by from workspaces where id = workspace_id));

drop policy if exists "workspace advisors: read own" on workspace_advisors;
drop policy if exists "workspace advisors: read workspace" on workspace_advisors;
create policy "workspace advisors: read own" on workspace_advisors for select using (has_workspace_access(workspace_id));

drop policy if exists "tasks: member access" on tasks;
drop policy if exists "tasks: read access" on tasks;
drop policy if exists "tasks: member create" on tasks;
drop policy if exists "tasks: member update" on tasks;
drop policy if exists "tasks: lead delete" on tasks;
create policy "tasks: read access" on tasks for select using (has_workspace_access(workspace_id));
create policy "tasks: member create" on tasks for insert with check (is_workspace_member(workspace_id));
create policy "tasks: member update" on tasks for update using (is_workspace_member(workspace_id)) with check (is_workspace_member(workspace_id));
create policy "tasks: lead delete" on tasks for delete using (can_manage_workspace_team(workspace_id));

drop policy if exists "task_subtasks: member access" on task_subtasks;
drop policy if exists "task_subtasks: read" on task_subtasks;
drop policy if exists "task_subtasks: member write" on task_subtasks;
create policy "task_subtasks: read" on task_subtasks for select using (
  exists (select 1 from tasks t where t.id = task_id and has_workspace_access(t.workspace_id))
);
create policy "task_subtasks: member write" on task_subtasks for all
using (exists (select 1 from tasks t where t.id = task_id and is_workspace_member(t.workspace_id)))
with check (exists (select 1 from tasks t where t.id = task_id and is_workspace_member(t.workspace_id)));

drop policy if exists "weekly_logs: member access" on weekly_logs;
drop policy if exists "weekly_logs: read access" on weekly_logs;
drop policy if exists "weekly_logs: submit own" on weekly_logs;
drop policy if exists "weekly_logs: edit pending own" on weekly_logs;
create policy "weekly_logs: read access" on weekly_logs for select using (has_workspace_access(workspace_id));
create policy "weekly_logs: submit own" on weekly_logs for insert
with check (is_workspace_member(workspace_id) and author_id = auth.uid() and status = 'Pending');
create policy "weekly_logs: edit pending own" on weekly_logs for update
using (is_workspace_member(workspace_id) and author_id = auth.uid() and status = 'Pending')
with check (is_workspace_member(workspace_id) and author_id = auth.uid() and status = 'Pending');

drop policy if exists "proposals: member access" on proposals;
drop policy if exists "proposals: read access" on proposals;
drop policy if exists "proposals: member create" on proposals;
drop policy if exists "proposals: member update" on proposals;
drop policy if exists "proposals: member delete" on proposals;
create policy "proposals: read access" on proposals for select using (has_workspace_access(workspace_id));
create policy "proposals: member create" on proposals for insert with check (is_workspace_member(workspace_id));
create policy "proposals: member update" on proposals for update using (is_workspace_member(workspace_id)) with check (is_workspace_member(workspace_id));
create policy "proposals: member delete" on proposals for delete using (is_workspace_member(workspace_id));

drop policy if exists "meetings: member access" on meetings;
drop policy if exists "meetings: read access" on meetings;
drop policy if exists "meetings: member write" on meetings;
create policy "meetings: read access" on meetings for select using (has_workspace_access(workspace_id));
create policy "meetings: member write" on meetings for all using (is_workspace_member(workspace_id)) with check (is_workspace_member(workspace_id));

drop policy if exists "member_ratings: member access" on member_ratings;
drop policy if exists "ratings: read access" on member_ratings;
drop policy if exists "ratings: member write" on member_ratings;
drop policy if exists "ratings: own read" on member_ratings;
drop policy if exists "ratings: own write" on member_ratings;
create policy "ratings: own read" on member_ratings for select
using (is_workspace_member(workspace_id) and rater_id = auth.uid());
create policy "ratings: own write" on member_ratings for all
using (is_workspace_member(workspace_id) and rater_id = auth.uid())
with check (
  is_workspace_member(workspace_id) and rater_id = auth.uid()
  and exists (
    select 1 from workspace_members m
    where m.workspace_id = member_ratings.workspace_id
      and m.user_id = member_ratings.member_id and m.is_active
  )
);

drop policy if exists "chat_messages: member access" on chat_messages;
drop policy if exists "chat_channels: member access" on chat_channels;
drop policy if exists "chat channels: read access" on chat_channels;
drop policy if exists "messages: read access" on chat_messages;
drop policy if exists "messages: member create" on chat_messages;
drop policy if exists "messages: author or lead update" on chat_messages;
drop policy if exists "messages: author or lead delete" on chat_messages;
create policy "chat channels: read access" on chat_channels for select using (has_workspace_access(workspace_id));
create policy "messages: read access" on chat_messages for select using (has_workspace_access(workspace_id));
create policy "messages: member create" on chat_messages for insert with check (is_workspace_member(workspace_id) and author_id = auth.uid());
create policy "messages: author or lead update" on chat_messages for update
using (is_workspace_member(workspace_id) and (author_id = auth.uid() or can_manage_workspace_team(workspace_id)))
with check (is_workspace_member(workspace_id) and (author_id = auth.uid() or can_manage_workspace_team(workspace_id)));
create policy "messages: author or lead delete" on chat_messages for delete
using (is_workspace_member(workspace_id) and (author_id = auth.uid() or can_manage_workspace_team(workspace_id)));

drop policy if exists "workspace_documents: member access" on workspace_documents;
drop policy if exists "documents: read access" on workspace_documents;
drop policy if exists "documents: member write" on workspace_documents;
create policy "documents: read access" on workspace_documents for select using (has_workspace_access(workspace_id));
create policy "documents: member write" on workspace_documents for all
using (is_workspace_member(workspace_id)) with check (is_workspace_member(workspace_id));

drop policy if exists "activity_logs: member access" on activity_logs;
drop policy if exists "activity: read access" on activity_logs;
drop policy if exists "activity: member insert" on activity_logs;
create policy "activity: read access" on activity_logs for select using (has_workspace_access(workspace_id));
create policy "activity: member insert" on activity_logs for insert with check (is_workspace_member(workspace_id) and actor_id = auth.uid());

drop policy if exists "meeting_attendance: member access" on meeting_attendance;
drop policy if exists "attendance: read access" on meeting_attendance;
drop policy if exists "attendance: member write" on meeting_attendance;
create policy "attendance: read access" on meeting_attendance for select using (
  exists (select 1 from meetings m where m.id = meeting_id and has_workspace_access(m.workspace_id))
);
create policy "attendance: member write" on meeting_attendance for all
using (exists (select 1 from meetings m where m.id = meeting_id and is_workspace_member(m.workspace_id)))
with check (exists (select 1 from meetings m where m.id = meeting_id and is_workspace_member(m.workspace_id)));

create or replace function write_workspace_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ws uuid;
  verb text;
  title text;
begin
  ws := coalesce(new.workspace_id, old.workspace_id);
  verb := lower(tg_op);
  title := coalesce(to_jsonb(new)->>'title', to_jsonb(old)->>'title', to_jsonb(new)->>'week_label', to_jsonb(old)->>'week_label', '');
  if exists (select 1 from workspaces where id = ws) then
    insert into activity_logs (workspace_id, actor_id, action)
    values (ws, auth.uid(), tg_table_name || ' ' || verb || case when title = '' then '' else ': ' || title end);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;

drop trigger if exists trg_task_activity on tasks;
create trigger trg_task_activity after insert or update or delete on tasks for each row execute function write_workspace_activity();
drop trigger if exists trg_proposal_activity on proposals;
create trigger trg_proposal_activity after insert or update or delete on proposals for each row execute function write_workspace_activity();
drop trigger if exists trg_log_activity on weekly_logs;
create trigger trg_log_activity after insert or update or delete on weekly_logs for each row execute function write_workspace_activity();
drop trigger if exists trg_meeting_activity on meetings;
create trigger trg_meeting_activity after insert or update or delete on meetings for each row execute function write_workspace_activity();
drop trigger if exists trg_document_activity on workspace_documents;
create trigger trg_document_activity after insert or update or delete on workspace_documents for each row execute function write_workspace_activity();
drop trigger if exists trg_message_activity on chat_messages;
create trigger trg_message_activity after insert or update or delete on chat_messages for each row execute function write_workspace_activity();
drop trigger if exists trg_rating_activity on member_ratings;
create trigger trg_rating_activity after insert or update or delete on member_ratings for each row execute function write_workspace_activity();
drop trigger if exists trg_member_activity on workspace_members;
create trigger trg_member_activity after insert or update or delete on workspace_members for each row execute function write_workspace_activity();
drop trigger if exists trg_advisor_activity on workspace_advisors;
create trigger trg_advisor_activity after insert or update or delete on workspace_advisors for each row execute function write_workspace_activity();

create or replace function write_attendance_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meeting_ws uuid;
begin
  select workspace_id into meeting_ws from meetings where id = coalesce(new.meeting_id, old.meeting_id);
  if meeting_ws is not null then
    insert into activity_logs (workspace_id, actor_id, action)
    values (meeting_ws, auth.uid(), 'meeting attendance ' || lower(tg_op));
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;
drop trigger if exists trg_attendance_activity on meeting_attendance;
create trigger trg_attendance_activity after insert or update or delete on meeting_attendance for each row execute function write_attendance_activity();

create or replace function write_workspace_record_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  record_id uuid;
  record_name text;
  verb text := lower(tg_op);
begin
  if tg_op = 'DELETE' then return old; end if;
  record_id := coalesce(new.id, old.id);
  record_name := coalesce(new.name, old.name, '');
  insert into activity_logs (workspace_id, actor_id, action)
  values (record_id, auth.uid(), 'workspace ' || verb || case when record_name = '' then '' else ': ' || record_name end);
  return new;
end
$$;
drop trigger if exists trg_workspace_activity on workspaces;
create trigger trg_workspace_activity after insert or update on workspaces for each row execute function write_workspace_record_activity();

create or replace function workspace_id_from_storage_path(path text) returns uuid
language plpgsql immutable as $$
begin
  return split_part(path, '/', 1)::uuid;
exception when others then
  return null;
end
$$;

drop policy if exists "workspace files: members only" on storage.objects;
drop policy if exists "workspace files: read" on storage.objects;
drop policy if exists "workspace files: member insert" on storage.objects;
drop policy if exists "workspace files: member update" on storage.objects;
drop policy if exists "workspace files: member delete" on storage.objects;
create policy "workspace files: read" on storage.objects for select
using (bucket_id in ('workspace-documents', 'voice-notes') and has_workspace_access(workspace_id_from_storage_path(name)));
create policy "workspace files: member insert" on storage.objects for insert
with check (bucket_id in ('workspace-documents', 'voice-notes') and is_workspace_member(workspace_id_from_storage_path(name)));
create policy "workspace files: member update" on storage.objects for update
using (bucket_id in ('workspace-documents', 'voice-notes') and is_workspace_member(workspace_id_from_storage_path(name)))
with check (bucket_id in ('workspace-documents', 'voice-notes') and is_workspace_member(workspace_id_from_storage_path(name)));
create policy "workspace files: member delete" on storage.objects for delete
using (bucket_id in ('workspace-documents', 'voice-notes') and is_workspace_member(workspace_id_from_storage_path(name)));

do $$
declare table_name text;
begin
  foreach table_name in array array['workspaces', 'tasks', 'weekly_logs', 'meetings', 'meeting_attendance', 'proposals', 'workspace_documents', 'chat_messages', 'activity_logs', 'workspace_members', 'workspace_advisors'] loop
    begin
      execute format('alter publication supabase_realtime add table %I', table_name);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

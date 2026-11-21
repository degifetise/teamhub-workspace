-- ============================================================================
-- PPMS workspace schema. Paste this whole file into Supabase > SQL Editor > Run.
-- Safe to re-run: tables use IF NOT EXISTS; policies are dropped and recreated.
-- ============================================================================
create extension if not exists pgcrypto;

-- 1. Profiles (one per auth user): cohort details, role and approval state
create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  email         text,
  academic_year text,
  department    text,
  semester      text,
  role          text not null default 'student' check (role in ('student','advisor','admin')),
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at    timestamptz not null default now()
);

-- 2. Workspaces (teams) with a unique join code
create table if not exists workspaces (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  join_code     text not null unique,
  mode          text not null default 'capstone' check (mode in ('capstone','internship','general')),
  is_locked     boolean not null default false,
  advisor_name  text,
  advisor_email text,
  created_by    uuid default auth.uid() references auth.users(id),
  created_at    timestamptz not null default now()
);

create table if not exists workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  team_role    text not null default 'Frontend' check (team_role in ('Team Lead','Frontend','Backend','Database','Docs/QA')),
  email        text,
  is_active    boolean not null default true,   -- false = removed; history is kept
  joined_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- 3. Tasks and checklist items
create table if not exists tasks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title        text not null,
  status       text not null default 'To Do' check (status in ('To Do','In Progress','In Review','Done')),
  priority     text not null default 'Medium' check (priority in ('High','Medium','Low')),
  category     text default 'General',
  module       text default 'General',
  due_date     date,
  due_time     text,
  assignee_id  uuid references auth.users(id) on delete set null,
  blocker_note text,
  created_by   uuid default auth.uid() references auth.users(id),
  created_at   timestamptz not null default now()
);
create table if not exists task_subtasks (
  id       uuid primary key default gen_random_uuid(),
  task_id  uuid not null references tasks(id) on delete cascade,
  title    text not null,
  is_done  boolean not null default false,
  position int not null default 0
);

-- 4. Proposals and weekly logs
create table if not exists proposals (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  title            text not null,
  abstract         text,
  keywords         text,
  status           text not null default 'Draft' check (status in ('Draft','Submitted','Approved','Needs Changes')),
  similarity_score int check (similarity_score between 0 and 100),
  created_by       uuid default auth.uid() references auth.users(id),
  created_at       timestamptz not null default now()
);
create table if not exists weekly_logs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  author_id    uuid default auth.uid() references auth.users(id),
  week_label   text not null,
  finished     text,
  next_steps   text,
  blockers     text,
  status       text not null default 'Pending' check (status in ('Pending','Approved','Needs Changes')),
  review_note  text,
  reviewed_by  uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

-- 5. Meetings, attendance and ratings
create table if not exists meetings (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  title        text not null,
  meeting_date date not null default current_date,
  agenda       text,
  notes        text,
  action_items jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);
create table if not exists meeting_attendance (
  meeting_id uuid not null references meetings(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  status     text not null check (status in ('Attended','Not Attended','Excused')),
  primary key (meeting_id, user_id)
);
create table if not exists member_ratings (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces(id) on delete cascade,
  member_id     uuid not null references auth.users(id) on delete cascade,
  rater_id      uuid default auth.uid() references auth.users(id),
  reliability   int check (reliability between 1 and 5),
  quality       int check (quality between 1 and 5),
  communication int check (communication between 1 and 5),
  note          text,
  created_at    timestamptz not null default now(),
  unique (workspace_id, member_id, rater_id)
);

-- 6. Chat, documents and activity
create table if not exists chat_channels (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  kind         text not null check (kind in ('team','advisor')),
  name         text not null,
  unique (workspace_id, kind)
);
create table if not exists chat_messages (
  id           uuid primary key default gen_random_uuid(),
  channel_id   uuid not null references chat_channels(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  author_id    uuid references auth.users(id),
  author_name  text,
  author_role  text,
  body         text,
  audio_url    text,
  is_pinned    boolean not null default false,
  created_at   timestamptz not null default now(),
  check (body is not null or audio_url is not null)
);
create table if not exists workspace_documents (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  tag          text check (tag in ('Proposal','Report','Design','Code/Archive','Logbook')),
  storage_path text not null,
  size_bytes   bigint,
  mime_type    text,
  uploaded_by  uuid default auth.uid() references auth.users(id),
  created_at   timestamptz not null default now()
);
create table if not exists activity_logs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  actor_id     uuid default auth.uid() references auth.users(id),
  action       text not null,
  created_at   timestamptz not null default now()
);

-- Indexes
create index if not exists idx_members_user        on workspace_members(user_id);
create index if not exists idx_tasks_ws_status     on tasks(workspace_id, status);
create index if not exists idx_tasks_due           on tasks(workspace_id, due_date);
create index if not exists idx_subtasks_task       on task_subtasks(task_id);
create index if not exists idx_proposals_ws        on proposals(workspace_id);
create index if not exists idx_logs_ws             on weekly_logs(workspace_id, created_at desc);
create index if not exists idx_meetings_ws         on meetings(workspace_id, meeting_date desc);
create index if not exists idx_messages_channel    on chat_messages(channel_id, created_at);
create index if not exists idx_documents_ws        on workspace_documents(workspace_id, created_at desc);
create index if not exists idx_activity_ws         on activity_logs(workspace_id, created_at desc);

-- ============================================================================
-- Helper functions (security definer avoids recursive RLS checks)
-- ============================================================================
create or replace function is_workspace_member(ws uuid) returns boolean
language sql security definer stable set search_path = public as
$$ select exists (select 1 from workspace_members where workspace_id = ws and user_id = auth.uid() and is_active) $$;

create or replace function is_staff() returns boolean
language sql security definer stable set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role in ('advisor','admin') and status = 'approved') $$;

-- Join a team by its unique code. Returns the workspace id, or null if the code is wrong or the team is locked.
create or replace function join_team_by_code(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  select id into ws from workspaces where join_code = upper(trim(p_code)) and not is_locked;
  if ws is null or auth.uid() is null then return null; end if;
  insert into workspace_members (workspace_id, user_id) values (ws, auth.uid())
    on conflict (workspace_id, user_id) do update set is_active = true;
  return ws;
end $$;

-- When a workspace is created: make the creator Team Lead and add the two chat channels
create or replace function on_workspace_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    insert into workspace_members (workspace_id, user_id, team_role) values (new.id, new.created_by, 'Team Lead') on conflict do nothing;
  end if;
  insert into chat_channels (workspace_id, kind, name) values (new.id, 'team', 'Team Chat'), (new.id, 'advisor', 'Advisor / Mentor Check-In');
  return new;
end $$;
drop trigger if exists trg_workspace_created on workspaces;
create trigger trg_workspace_created after insert on workspaces for each row execute function on_workspace_created();

-- Create a profile row automatically at sign-up (starts as 'pending' until approved)
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, academic_year, department, semester)
  values (new.id, lower(new.email), new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'academic_year', new.raw_user_meta_data->>'department', new.raw_user_meta_data->>'semester')
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists trg_new_user on auth.users;
create trigger trg_new_user after insert on auth.users for each row execute function handle_new_user();

-- ============================================================================
-- Row Level Security: every workspace's data is visible only to its active members
-- (approved advisors/admins can also read). Pending users cannot write.
-- ============================================================================
alter table profiles            enable row level security;
alter table workspaces          enable row level security;
alter table workspace_members   enable row level security;

drop policy if exists "profiles: own or staff" on profiles;
create policy "profiles: own or staff" on profiles for select using (id = auth.uid() or is_staff());
drop policy if exists "profiles: update own" on profiles;
create policy "profiles: update own" on profiles for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()) and status = (select status from profiles where id = auth.uid()));
drop policy if exists "profiles: staff approve" on profiles;
create policy "profiles: staff approve" on profiles for update using (is_staff()) with check (is_staff());

drop policy if exists "workspaces: read" on workspaces;
create policy "workspaces: read" on workspaces for select using (is_workspace_member(id) or is_staff() or created_by = auth.uid());
drop policy if exists "workspaces: create" on workspaces;
create policy "workspaces: create" on workspaces for insert with check (auth.uid() is not null);
drop policy if exists "workspaces: update" on workspaces;
create policy "workspaces: update" on workspaces for update using (is_workspace_member(id));

drop policy if exists "members: read" on workspace_members;
create policy "members: read" on workspace_members for select using (is_workspace_member(workspace_id) or user_id = auth.uid() or is_staff());
drop policy if exists "members: manage" on workspace_members;
create policy "members: manage" on workspace_members for all using (is_workspace_member(workspace_id)) with check (is_workspace_member(workspace_id));

do $$
declare t text;
begin
  foreach t in array array['tasks','proposals','weekly_logs','meetings','member_ratings','chat_channels','chat_messages','workspace_documents','activity_logs'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "%s: member access" on %I', t, t);
    execute format('create policy "%s: member access" on %I for all using (is_workspace_member(workspace_id) or is_staff()) with check (is_workspace_member(workspace_id) or is_staff())', t, t);
  end loop;
end $$;

-- Child tables without workspace_id: check through their parent
alter table task_subtasks enable row level security;
drop policy if exists "task_subtasks: member access" on task_subtasks;
create policy "task_subtasks: member access" on task_subtasks for all
  using (exists (select 1 from tasks t where t.id = task_id and (is_workspace_member(t.workspace_id) or is_staff())))
  with check (exists (select 1 from tasks t where t.id = task_id and (is_workspace_member(t.workspace_id) or is_staff())));
alter table meeting_attendance enable row level security;
drop policy if exists "meeting_attendance: member access" on meeting_attendance;
create policy "meeting_attendance: member access" on meeting_attendance for all
  using (exists (select 1 from meetings m where m.id = meeting_id and (is_workspace_member(m.workspace_id) or is_staff())))
  with check (exists (select 1 from meetings m where m.id = meeting_id and (is_workspace_member(m.workspace_id) or is_staff())));

-- Realtime for chat (Dashboard > Database > Replication also works)
do $$ begin
  alter publication supabase_realtime add table chat_messages;
exception when duplicate_object then null; end $$;

-- ============================================================================
-- Storage: two PRIVATE buckets. Files must be stored as <workspace_id>/<filename>,
-- which is how the app uploads them, so the policy can check the first folder.
-- ============================================================================
insert into storage.buckets (id, name, public) values ('workspace-documents','workspace-documents', false), ('voice-notes','voice-notes', false) on conflict (id) do nothing;

drop policy if exists "workspace files: members only" on storage.objects;
create policy "workspace files: members only" on storage.objects for all
  using (bucket_id in ('workspace-documents','voice-notes') and is_workspace_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id in ('workspace-documents','voice-notes') and is_workspace_member(((storage.foldername(name))[1])::uuid));

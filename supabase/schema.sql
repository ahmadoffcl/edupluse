-- EduPulse production MVP schema.
-- Apply this to a Supabase project configured for Firebase third-party auth.
-- Firebase ID tokens must include role=authenticated for Supabase Data API/RLS.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

create type public.app_role as enum ('student', 'teacher', 'admin', 'super_admin');
create type public.membership_status as enum ('invited', 'active', 'suspended');
create type public.assignment_status as enum ('draft', 'published', 'closed');
create type public.submission_status as enum ('submitted', 'late', 'graded', 'returned');
create type public.attendance_status as enum ('present', 'absent', 'late', 'excused');
create type public.resource_type as enum ('pdf', 'video', 'image', 'rich_note', 'link');
create type public.message_kind as enum ('direct', 'class_channel', 'announcement_thread');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  tenant_type text not null default 'hybrid_institute',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null unique,
  email text,
  display_name text not null,
  username citext unique,
  bio text,
  onboarding_completed_at timestamptz,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  status public.membership_status not null default 'active',
  invited_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (org_id, profile_id, role)
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.app_role not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.device_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (profile_id, device_id)
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  grade_level text,
  section text,
  batch text,
  delivery_mode text not null default 'hybrid',
  term text,
  teacher_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  name text not null,
  code text,
  created_at timestamptz not null default now()
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, student_id)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id),
  teacher_id uuid not null references public.profiles(id),
  title text not null,
  instructions text,
  status public.assignment_status not null default 'draft',
  due_at timestamptz,
  points integer not null default 100,
  created_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status public.submission_status not null default 'submitted',
  content text,
  file_path text,
  score numeric(6,2),
  feedback text,
  submitted_at timestamptz not null default now(),
  graded_at timestamptz,
  unique (assignment_id, student_id)
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id),
  teacher_id uuid references public.profiles(id),
  title text not null,
  type public.resource_type not null,
  body text,
  file_path text,
  moderation_status text not null default 'approved',
  created_at timestamptz not null default now()
);

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  marked_by uuid references public.profiles(id),
  attended_on date not null,
  status public.attendance_status not null,
  note text,
  created_at timestamptz not null default now(),
  unique (class_id, student_id, attended_on)
);

create table public.message_threads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  kind public.message_kind not null,
  title text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.message_participants (
  thread_id uuid references public.message_threads(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  last_read_at timestamptz,
  primary key (thread_id, profile_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  created_by uuid references public.profiles(id),
  title text not null,
  body text not null,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  owner_id uuid references public.profiles(id),
  title text not null,
  kind text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.gamification_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  xp integer not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  icon text,
  xp_bonus integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.user_badges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (profile_id, badge_id)
);

create table public.ai_interactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  firebase_uid text not null,
  role public.app_role not null,
  kind text not null,
  prompt text not null,
  response text,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity text,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create schema if not exists app_private;

create or replace function app_private.firebase_uid()
returns text
language sql
stable
as $$
  select auth.jwt() ->> 'sub'
$$;

create or replace function app_private.profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.profiles p
  where p.firebase_uid = app_private.firebase_uid()
  limit 1
$$;

create or replace function app_private.is_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.profiles p on p.id = m.profile_id
    where m.org_id = target_org
      and p.firebase_uid = app_private.firebase_uid()
      and m.status = 'active'
  )
$$;

create or replace function app_private.has_role(target_org uuid, roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    join public.profiles p on p.id = m.profile_id
    where m.org_id = target_org
      and p.firebase_uid = app_private.firebase_uid()
      and m.status = 'active'
      and m.role = any(roles)
  )
$$;

grant usage on schema app_private to authenticated;
grant execute on all functions in schema app_private to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.invites enable row level security;
alter table public.device_sessions enable row level security;
alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.enrollments enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.resources enable row level security;
alter table public.attendance_records enable row level security;
alter table public.message_threads enable row level security;
alter table public.message_participants enable row level security;
alter table public.messages enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.calendar_events enable row level security;
alter table public.gamification_events enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.ai_interactions enable row level security;
alter table public.audit_logs enable row level security;

create policy "members can view organizations"
on public.organizations for select
to authenticated
using (app_private.is_member(id));

create policy "users can view tenant profiles"
on public.profiles for select
to authenticated
using (
  exists (
    select 1
    from public.memberships viewer
    join public.memberships target on target.org_id = viewer.org_id
    join public.profiles viewer_profile on viewer_profile.id = viewer.profile_id
    where target.profile_id = profiles.id
      and viewer_profile.firebase_uid = app_private.firebase_uid()
      and viewer.status = 'active'
      and target.status = 'active'
  )
);

create policy "users can update own profile"
on public.profiles for update
to authenticated
using (firebase_uid = app_private.firebase_uid())
with check (firebase_uid = app_private.firebase_uid());

create policy "admins manage memberships"
on public.memberships for all
to authenticated
using (app_private.has_role(org_id, array['admin','super_admin']::public.app_role[]))
with check (app_private.has_role(org_id, array['admin','super_admin']::public.app_role[]));

create policy "members view memberships"
on public.memberships for select
to authenticated
using (app_private.is_member(org_id));

create policy "admins manage invites"
on public.invites for all
to authenticated
using (app_private.has_role(org_id, array['admin','super_admin']::public.app_role[]))
with check (app_private.has_role(org_id, array['admin','super_admin']::public.app_role[]));

create policy "members view tenant data"
on public.classes for select
to authenticated
using (app_private.is_member(org_id));

create policy "teachers manage classes"
on public.classes for all
to authenticated
using (app_private.has_role(org_id, array['teacher','admin','super_admin']::public.app_role[]))
with check (app_private.has_role(org_id, array['teacher','admin','super_admin']::public.app_role[]));

create policy "members view subjects"
on public.subjects for select
to authenticated
using (app_private.is_member(org_id));

create policy "teachers manage subjects"
on public.subjects for all
to authenticated
using (app_private.has_role(org_id, array['teacher','admin','super_admin']::public.app_role[]))
with check (app_private.has_role(org_id, array['teacher','admin','super_admin']::public.app_role[]));

create policy "members view enrollments"
on public.enrollments for select
to authenticated
using (app_private.is_member(org_id));

create policy "admins teachers manage enrollments"
on public.enrollments for all
to authenticated
using (app_private.has_role(org_id, array['teacher','admin','super_admin']::public.app_role[]))
with check (app_private.has_role(org_id, array['teacher','admin','super_admin']::public.app_role[]));

create policy "members view assignments"
on public.assignments for select
to authenticated
using (app_private.is_member(org_id));

create policy "teachers manage assignments"
on public.assignments for all
to authenticated
using (app_private.has_role(org_id, array['teacher','admin','super_admin']::public.app_role[]))
with check (app_private.has_role(org_id, array['teacher','admin','super_admin']::public.app_role[]));

create policy "students view own submissions"
on public.submissions for select
to authenticated
using (
  app_private.has_role(org_id, array['teacher','admin','super_admin']::public.app_role[])
  or student_id = app_private.profile_id()
);

create policy "students insert own submissions"
on public.submissions for insert
to authenticated
with check (student_id = app_private.profile_id() and app_private.is_member(org_id));

create policy "teachers grade submissions"
on public.submissions for update
to authenticated
using (app_private.has_role(org_id, array['teacher','admin','super_admin']::public.app_role[]))
with check (app_private.has_role(org_id, array['teacher','admin','super_admin']::public.app_role[]));

create policy "members view resources"
on public.resources for select
to authenticated
using (app_private.is_member(org_id) and moderation_status = 'approved');

create policy "teachers manage resources"
on public.resources for all
to authenticated
using (app_private.has_role(org_id, array['teacher','admin','super_admin']::public.app_role[]))
with check (app_private.has_role(org_id, array['teacher','admin','super_admin']::public.app_role[]));

create policy "members view attendance"
on public.attendance_records for select
to authenticated
using (
  app_private.has_role(org_id, array['teacher','admin','super_admin']::public.app_role[])
  or student_id = app_private.profile_id()
);

create policy "teachers manage attendance"
on public.attendance_records for all
to authenticated
using (app_private.has_role(org_id, array['teacher','admin','super_admin']::public.app_role[]))
with check (app_private.has_role(org_id, array['teacher','admin','super_admin']::public.app_role[]));

create policy "participants view threads"
on public.message_threads for select
to authenticated
using (app_private.is_member(org_id));

create policy "members create threads"
on public.message_threads for insert
to authenticated
with check (app_private.is_member(org_id));

create policy "members view participants"
on public.message_participants for select
to authenticated
using (app_private.is_member(org_id));

create policy "members send messages"
on public.messages for insert
to authenticated
with check (sender_id = app_private.profile_id() and app_private.is_member(org_id));

create policy "members view messages"
on public.messages for select
to authenticated
using (app_private.is_member(org_id));

create policy "members view announcements"
on public.announcements for select
to authenticated
using (app_private.is_member(org_id) and published_at is not null);

create policy "teachers manage announcements"
on public.announcements for all
to authenticated
using (app_private.has_role(org_id, array['teacher','admin','super_admin']::public.app_role[]))
with check (app_private.has_role(org_id, array['teacher','admin','super_admin']::public.app_role[]));

create policy "users view own notifications"
on public.notifications for select
to authenticated
using (recipient_id = app_private.profile_id());

create policy "users update own notifications"
on public.notifications for update
to authenticated
using (recipient_id = app_private.profile_id())
with check (recipient_id = app_private.profile_id());

create policy "members view calendar"
on public.calendar_events for select
to authenticated
using (app_private.is_member(org_id));

create policy "members manage own calendar"
on public.calendar_events for all
to authenticated
using (owner_id = app_private.profile_id() or app_private.has_role(org_id, array['teacher','admin','super_admin']::public.app_role[]))
with check (owner_id = app_private.profile_id() or app_private.has_role(org_id, array['teacher','admin','super_admin']::public.app_role[]));

create policy "members view gamification"
on public.gamification_events for select
to authenticated
using (app_private.is_member(org_id));

create policy "system roles insert gamification"
on public.gamification_events for insert
to authenticated
with check (app_private.is_member(org_id));

create policy "members view badges"
on public.badges for select
to authenticated
using (app_private.is_member(org_id));

create policy "members view user badges"
on public.user_badges for select
to authenticated
using (app_private.is_member(org_id));

create policy "users view own ai logs"
on public.ai_interactions for select
to authenticated
using (
  firebase_uid = app_private.firebase_uid()
  or app_private.has_role(org_id, array['admin','super_admin']::public.app_role[])
);

create policy "admins view audit logs"
on public.audit_logs for select
to authenticated
using (app_private.has_role(org_id, array['admin','super_admin']::public.app_role[]));

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('submissions', 'submissions', false),
  ('resources', 'resources', false)
on conflict (id) do nothing;

create policy "members read org resources"
on storage.objects for select
to authenticated
using (
  bucket_id in ('resources', 'submissions')
  and app_private.is_member((storage.foldername(name))[1]::uuid)
);

create policy "members manage own org uploads"
on storage.objects for all
to authenticated
using (
  bucket_id in ('avatars', 'resources', 'submissions')
  and app_private.is_member((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id in ('avatars', 'resources', 'submissions')
  and app_private.is_member((storage.foldername(name))[1]::uuid)
);

alter publication supabase_realtime add table
  public.notifications,
  public.messages,
  public.announcements,
  public.gamification_events;

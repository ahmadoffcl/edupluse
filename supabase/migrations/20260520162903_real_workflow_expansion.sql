-- Real workflow expansion for invites, safe resources, and analytics metadata.
-- This migration is additive so it can be applied after the initial MVP schema.

alter table public.invites
  add column if not exists code_hash text unique,
  add column if not exists department text,
  add column if not exists class_id uuid references public.classes(id) on delete set null,
  add column if not exists section text,
  add column if not exists max_uses integer not null default 1 check (max_uses > 0),
  add column if not exists used_count integer not null default 0 check (used_count >= 0),
  add column if not exists revoked_at timestamptz,
  add column if not exists personal_message text,
  add column if not exists temporary_permissions jsonb not null default '{}';

alter table public.invites
  alter column email drop not null;

alter table public.profiles
  add column if not exists teacher_settings jsonb not null default '{}';

alter table public.classes
  add column if not exists capacity integer,
  add column if not exists schedule_note text,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.resources
  add column if not exists file_size bigint,
  add column if not exists mime_type text,
  add column if not exists original_filename text,
  add column if not exists external_url text,
  add column if not exists metadata jsonb not null default '{}',
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.assignments
  add column if not exists published_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.announcements
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.calendar_events
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists invites_org_status_idx
  on public.invites (org_id, accepted_at, revoked_at, expires_at);

create index if not exists invites_class_idx
  on public.invites (class_id)
  where class_id is not null;

create index if not exists resources_org_teacher_idx
  on public.resources (org_id, teacher_id, created_at desc)
  where archived_at is null;

create index if not exists classes_org_teacher_active_idx
  on public.classes (org_id, teacher_id, created_at desc)
  where archived_at is null;

create index if not exists assignments_org_teacher_status_idx
  on public.assignments (org_id, teacher_id, status, due_at);

create index if not exists submissions_assignment_status_idx
  on public.submissions (assignment_id, status);

create index if not exists attendance_org_class_date_idx
  on public.attendance_records (org_id, class_id, attended_on desc);

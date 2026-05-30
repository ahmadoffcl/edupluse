-- Timetable imports, class-session reminders, and Web Push delivery.
-- Additive migration: apply after the existing EduPulse schema.

alter table public.notifications
  add column if not exists dedupe_key text;

create unique index if not exists notifications_org_recipient_kind_dedupe_idx
  on public.notifications (org_id, recipient_id, kind, dedupe_key)
  where dedupe_key is not null;

create table if not exists public.timetable_imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  original_filename text not null,
  file_size bigint,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived', 'failed')),
  timezone text not null default 'Asia/Karachi',
  effective_from date,
  detected_sections jsonb not null default '[]',
  raw_preview text,
  error_message text,
  published_at timestamptz,
  published_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.timetable_imports(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  teacher_id uuid references public.profiles(id) on delete set null,
  section_key text not null,
  section_label text not null,
  program text,
  intake text,
  semester_label text,
  day_of_week integer not null check (day_of_week between 1 and 7),
  start_time time,
  end_time time,
  subject_name text not null,
  teacher_name text,
  venue text,
  timezone text not null default 'Asia/Karachi',
  effective_from date,
  effective_to date,
  active boolean not null default true,
  confidence numeric(4,3) not null default 0.5,
  review_status text not null default 'needs_review'
    check (review_status in ('needs_review', 'ready', 'ignored')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  device_session_id text,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete cascade,
  push_subscription_id uuid references public.push_subscriptions(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete cascade,
  channel text not null default 'web_push',
  status text not null check (status in ('sent', 'failed', 'skipped')),
  error_message text,
  attempted_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index if not exists timetable_imports_org_status_idx
  on public.timetable_imports (org_id, status, created_at desc);

create index if not exists timetable_slots_org_class_active_idx
  on public.timetable_slots (org_id, class_id, active, day_of_week)
  where active = true;

create index if not exists timetable_slots_org_section_idx
  on public.timetable_slots (org_id, section_key, day_of_week);

create index if not exists push_subscriptions_profile_enabled_idx
  on public.push_subscriptions (profile_id, enabled, last_seen_at desc)
  where revoked_at is null;

create index if not exists notification_delivery_logs_notification_idx
  on public.notification_delivery_logs (notification_id, attempted_at desc);

alter table public.timetable_imports enable row level security;
alter table public.timetable_slots enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_delivery_logs enable row level security;

grant select, insert, update on public.timetable_imports to authenticated;
grant select, insert, update on public.timetable_slots to authenticated;
grant select, insert, update on public.push_subscriptions to authenticated;
grant select on public.notification_delivery_logs to authenticated;

drop policy if exists "admins manage timetable imports" on public.timetable_imports;
create policy "admins manage timetable imports"
on public.timetable_imports for all
to authenticated
using (app_private.has_role(org_id, array['admin','super_admin']::public.app_role[]))
with check (app_private.has_role(org_id, array['admin','super_admin']::public.app_role[]));

drop policy if exists "members view timetable slots" on public.timetable_slots;
create policy "members view timetable slots"
on public.timetable_slots for select
to authenticated
using (
  app_private.has_role(org_id, array['admin','super_admin']::public.app_role[])
  or exists (
    select 1
    from public.classes c
    where c.id = timetable_slots.class_id
      and c.org_id = timetable_slots.org_id
      and (
        c.teacher_id = app_private.profile_id()
        or exists (
          select 1
          from public.enrollments e
          where e.class_id = c.id
            and e.org_id = c.org_id
            and e.student_id = app_private.profile_id()
        )
      )
  )
);

drop policy if exists "admins manage timetable slots" on public.timetable_slots;
create policy "admins manage timetable slots"
on public.timetable_slots for all
to authenticated
using (app_private.has_role(org_id, array['admin','super_admin']::public.app_role[]))
with check (app_private.has_role(org_id, array['admin','super_admin']::public.app_role[]));

drop policy if exists "users manage own push subscriptions" on public.push_subscriptions;
create policy "users manage own push subscriptions"
on public.push_subscriptions for all
to authenticated
using (profile_id = app_private.profile_id())
with check (profile_id = app_private.profile_id());

drop policy if exists "admins view notification delivery logs" on public.notification_delivery_logs;
create policy "admins view notification delivery logs"
on public.notification_delivery_logs for select
to authenticated
using (
  profile_id = app_private.profile_id()
  or app_private.has_role(org_id, array['admin','super_admin']::public.app_role[])
);

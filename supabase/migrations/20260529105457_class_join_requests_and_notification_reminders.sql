-- Student class discovery requests and scheduled in-app assignment reminders.
-- Additive migration: safe to apply after the existing EduPulse schema.

create table if not exists public.class_join_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  note text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, student_id)
);

alter table public.notifications
  add column if not exists scheduled_for timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists action_url text,
  add column if not exists metadata jsonb not null default '{}';

create index if not exists class_join_requests_org_status_idx
  on public.class_join_requests (org_id, status, requested_at desc);

create index if not exists class_join_requests_class_status_idx
  on public.class_join_requests (class_id, status, requested_at desc);

create index if not exists class_join_requests_student_status_idx
  on public.class_join_requests (student_id, status, requested_at desc);

create index if not exists notifications_recipient_schedule_idx
  on public.notifications (recipient_id, scheduled_for, created_at desc);

alter table public.class_join_requests enable row level security;

grant select, insert, update on public.class_join_requests to authenticated;

drop policy if exists "students view own class requests" on public.class_join_requests;
create policy "students view own class requests"
on public.class_join_requests for select
to authenticated
using (
  student_id = app_private.profile_id()
  or app_private.has_role(org_id, array['admin','super_admin']::public.app_role[])
  or exists (
    select 1
    from public.classes c
    where c.id = class_join_requests.class_id
      and c.org_id = class_join_requests.org_id
      and c.teacher_id = app_private.profile_id()
  )
);

drop policy if exists "students create own class requests" on public.class_join_requests;
create policy "students create own class requests"
on public.class_join_requests for insert
to authenticated
with check (
  student_id = app_private.profile_id()
  and app_private.has_role(org_id, array['student']::public.app_role[])
);

drop policy if exists "students cancel own pending class requests" on public.class_join_requests;
create policy "students cancel own pending class requests"
on public.class_join_requests for update
to authenticated
using (
  student_id = app_private.profile_id()
  and status = 'pending'
)
with check (
  student_id = app_private.profile_id()
  and status = 'cancelled'
);

drop policy if exists "teachers review class requests" on public.class_join_requests;
create policy "teachers review class requests"
on public.class_join_requests for update
to authenticated
using (
  app_private.has_role(org_id, array['admin','super_admin']::public.app_role[])
  or exists (
    select 1
    from public.classes c
    where c.id = class_join_requests.class_id
      and c.org_id = class_join_requests.org_id
      and c.teacher_id = app_private.profile_id()
  )
)
with check (
  app_private.has_role(org_id, array['admin','super_admin']::public.app_role[])
  or exists (
    select 1
    from public.classes c
    where c.id = class_join_requests.class_id
      and c.org_id = class_join_requests.org_id
      and c.teacher_id = app_private.profile_id()
  )
);

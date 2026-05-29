create table if not exists public.learning_missions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete cascade,
  source_key text not null,
  kind text not null check (
    kind in (
      'assignment_due',
      'missing_submission',
      'new_resource',
      'teacher_feedback',
      'study_streak',
      'weak_topic'
    )
  ),
  title text not null,
  description text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'completed', 'dismissed')),
  due_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, profile_id, source_key)
);

create index if not exists learning_missions_profile_status_idx
on public.learning_missions (org_id, profile_id, status);

create index if not exists learning_missions_class_status_idx
on public.learning_missions (org_id, class_id, status);

create index if not exists learning_missions_due_at_idx
on public.learning_missions (due_at)
where due_at is not null;

alter table public.learning_missions enable row level security;

create policy "students view own learning missions"
on public.learning_missions for select
to authenticated
using (profile_id = app_private.profile_id());

create policy "students update own learning missions"
on public.learning_missions for update
to authenticated
using (profile_id = app_private.profile_id())
with check (profile_id = app_private.profile_id());

create policy "teachers view class learning missions"
on public.learning_missions for select
to authenticated
using (
  app_private.has_role(org_id, array['admin','super_admin']::public.app_role[])
  or exists (
    select 1
    from public.classes c
    where c.id = learning_missions.class_id
      and c.org_id = learning_missions.org_id
      and c.teacher_id = app_private.profile_id()
  )
);

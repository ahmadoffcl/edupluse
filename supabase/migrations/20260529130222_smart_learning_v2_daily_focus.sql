alter table if exists public.learning_missions
  add column if not exists reason text,
  add column if not exists source_label text,
  add column if not exists source_href text,
  add column if not exists snoozed_until timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists last_seen_at timestamptz,
  add column if not exists ai_explanation text,
  add column if not exists ai_explained_at timestamptz;

create index if not exists learning_missions_snoozed_until_idx
on public.learning_missions (snoozed_until)
where snoozed_until is not null;

create table if not exists public.learning_mission_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete cascade,
  mission_id uuid references public.learning_missions(id) on delete set null,
  source_key text not null,
  event_type text not null check (
    event_type in (
      'created',
      'viewed',
      'started',
      'completed',
      'snoozed',
      'dismissed',
      'opened_source',
      'ai_explained'
    )
  ),
  title text not null,
  body text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists learning_mission_events_profile_created_idx
on public.learning_mission_events (org_id, profile_id, created_at desc);

create index if not exists learning_mission_events_class_created_idx
on public.learning_mission_events (org_id, class_id, created_at desc)
where class_id is not null;

alter table public.learning_mission_events enable row level security;

create policy "students view own mission events"
on public.learning_mission_events for select
to authenticated
using (profile_id = app_private.profile_id());

create policy "teachers view class mission events"
on public.learning_mission_events for select
to authenticated
using (
  app_private.has_role(org_id, array['admin','super_admin']::public.app_role[])
  or exists (
    select 1
    from public.classes c
    where c.id = learning_mission_events.class_id
      and c.org_id = learning_mission_events.org_id
      and c.teacher_id = app_private.profile_id()
  )
);

grant select, insert, update on public.learning_missions to authenticated;
grant select on public.learning_mission_events to authenticated;

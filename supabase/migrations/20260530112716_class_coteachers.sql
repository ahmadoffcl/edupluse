-- Co-teacher support for class-scoped teacher invites.

create table if not exists public.class_teachers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'co_teacher'
    check (role in ('owner', 'co_teacher')),
  invited_by uuid references public.profiles(id) on delete set null,
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, teacher_id)
);

create index if not exists class_teachers_teacher_active_idx
  on public.class_teachers (teacher_id, removed_at, class_id);

create index if not exists class_teachers_class_active_idx
  on public.class_teachers (class_id, removed_at, teacher_id);

alter table public.class_teachers enable row level security;

grant select, insert, update on public.class_teachers to authenticated;

drop policy if exists "class teachers view own classes" on public.class_teachers;
create policy "class teachers view own classes"
on public.class_teachers for select
to authenticated
using (
  teacher_id = app_private.profile_id()
  or app_private.has_role(org_id, array['admin','super_admin']::public.app_role[])
  or exists (
    select 1
    from public.classes c
    where c.id = class_teachers.class_id
      and c.org_id = class_teachers.org_id
      and c.teacher_id = app_private.profile_id()
  )
);

drop policy if exists "admins teachers manage class teachers" on public.class_teachers;
create policy "admins teachers manage class teachers"
on public.class_teachers for all
to authenticated
using (
  app_private.has_role(org_id, array['admin','super_admin']::public.app_role[])
  or exists (
    select 1
    from public.classes c
    where c.id = class_teachers.class_id
      and c.org_id = class_teachers.org_id
      and c.teacher_id = app_private.profile_id()
  )
  or teacher_id = app_private.profile_id()
)
with check (
  app_private.has_role(org_id, array['admin','super_admin']::public.app_role[])
  or exists (
    select 1
    from public.classes c
    where c.id = class_teachers.class_id
      and c.org_id = class_teachers.org_id
      and c.teacher_id = app_private.profile_id()
  )
  or teacher_id = app_private.profile_id()
);

-- Add approval states for collaborative teacher invites.

alter table public.class_teachers
  add column if not exists status text not null default 'active',
  add column if not exists requested_at timestamptz not null default now(),
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists rejected_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'class_teachers_status_check'
  ) then
    alter table public.class_teachers
      add constraint class_teachers_status_check
      check (status in ('pending', 'active', 'rejected'));
  end if;
end $$;

update public.class_teachers
set status = 'active',
    approved_at = coalesce(approved_at, joined_at),
    requested_at = coalesce(requested_at, joined_at),
    updated_at = now()
where status is null;

create index if not exists class_teachers_status_idx
  on public.class_teachers (org_id, class_id, status, removed_at);

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
  or exists (
    select 1
    from public.class_teachers own
    where own.org_id = class_teachers.org_id
      and own.class_id = class_teachers.class_id
      and own.teacher_id = app_private.profile_id()
      and own.status = 'active'
      and own.removed_at is null
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
);

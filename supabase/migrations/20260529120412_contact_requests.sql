create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete set null,
  name text not null,
  email text not null,
  institute text,
  subject text not null default 'Support request',
  message text not null,
  status text not null default 'open' check (status in ('open', 'replied', 'closed')),
  reply_body text,
  replied_by uuid references public.profiles(id),
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contact_requests_created_at_idx
on public.contact_requests (created_at desc);

create index if not exists contact_requests_status_idx
on public.contact_requests (status);

alter table public.contact_requests enable row level security;

create policy "admins view contact requests"
on public.contact_requests for select
to authenticated
using (app_private.has_role(org_id, array['admin','super_admin']::public.app_role[]));

create policy "admins update contact requests"
on public.contact_requests for update
to authenticated
using (app_private.has_role(org_id, array['admin','super_admin']::public.app_role[]))
with check (app_private.has_role(org_id, array['admin','super_admin']::public.app_role[]));

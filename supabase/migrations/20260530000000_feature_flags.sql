create table if not exists public.organization_feature_flags (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  smart_learning_enabled boolean not null default false,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

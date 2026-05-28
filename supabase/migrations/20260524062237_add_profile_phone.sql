-- Repair profile columns needed by onboarding and admin-created accounts.
create extension if not exists "citext";

alter table public.profiles
  add column if not exists phone text,
  add column if not exists username citext unique,
  add column if not exists bio text,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists profile_settings jsonb not null default '{}';

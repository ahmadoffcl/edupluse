alter table public.classes
  add column if not exists description text,
  add column if not exists banner_url text;

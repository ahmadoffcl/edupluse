alter table public.assignments
  add column if not exists attachments jsonb not null default '[]';

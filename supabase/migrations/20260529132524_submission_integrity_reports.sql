alter table public.submissions
  add column if not exists file_size bigint,
  add column if not exists mime_type text,
  add column if not exists original_filename text;

create table if not exists public.submission_integrity_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'ready' check (status in ('ready', 'unsupported', 'failed')),
  ai_risk_score integer not null default 0 check (ai_risk_score between 0 and 100),
  ai_risk_band text not null default 'low' check (ai_risk_band in ('low', 'medium', 'high')),
  similarity_score integer not null default 0 check (similarity_score between 0 and 100),
  extracted_word_count integer not null default 0,
  checked_peer_count integer not null default 0,
  extracted_text_hash text,
  extraction_status text not null default 'pending',
  model_version text not null default 'integrity-v1',
  evidence jsonb not null default '{}',
  guidance text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, submission_id)
);

create table if not exists public.submission_similarity_matches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  report_id uuid not null references public.submission_integrity_reports(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  source_submission_id uuid not null references public.submissions(id) on delete cascade,
  matched_submission_id uuid not null references public.submissions(id) on delete cascade,
  matched_student_id uuid not null references public.profiles(id) on delete cascade,
  similarity_score integer not null default 0 check (similarity_score between 0 and 100),
  matched_snippets jsonb not null default '[]',
  excluded_cover_page boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists submission_integrity_reports_assignment_idx
on public.submission_integrity_reports (org_id, assignment_id, updated_at desc);

create index if not exists submission_similarity_matches_report_idx
on public.submission_similarity_matches (report_id, similarity_score desc);

alter table public.submission_integrity_reports enable row level security;
alter table public.submission_similarity_matches enable row level security;

create policy "teachers view owned integrity reports"
on public.submission_integrity_reports for select
to authenticated
using (
  app_private.has_role(org_id, array['admin','super_admin']::public.app_role[])
  or exists (
    select 1
    from public.assignments a
    join public.classes c on c.id = a.class_id
    where a.id = submission_integrity_reports.assignment_id
      and a.org_id = submission_integrity_reports.org_id
      and c.teacher_id = app_private.profile_id()
  )
);

create policy "teachers view owned similarity matches"
on public.submission_similarity_matches for select
to authenticated
using (
  app_private.has_role(org_id, array['admin','super_admin']::public.app_role[])
  or exists (
    select 1
    from public.assignments a
    join public.classes c on c.id = a.class_id
    where a.id = submission_similarity_matches.assignment_id
      and a.org_id = submission_similarity_matches.org_id
      and c.teacher_id = app_private.profile_id()
  )
);

grant select on public.submission_integrity_reports to authenticated;
grant select on public.submission_similarity_matches to authenticated;

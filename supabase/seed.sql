insert into public.organizations (id, name, slug, tenant_type)
values (
  '11111111-1111-4111-8111-111111111111',
  'EduPulse Academy Network',
  'edupulse-academy-network',
  'hybrid_institute'
)
on conflict (id) do nothing;

insert into public.profiles (id, firebase_uid, email, display_name)
values
  ('22222222-2222-4222-8222-222222222221', 'demo-student', 'student@edupulse.demo', 'Ayla Rahman'),
  ('22222222-2222-4222-8222-222222222222', 'demo-teacher', 'teacher@edupulse.demo', 'Mikael Chen'),
  ('22222222-2222-4222-8222-222222222223', 'demo-admin', 'admin@edupulse.demo', 'Sara Malik'),
  ('22222222-2222-4222-8222-222222222224', 'demo-super-admin', 'superadmin@edupulse.demo', 'Platform Owner')
on conflict (firebase_uid) do nothing;

insert into public.memberships (org_id, profile_id, role, status)
values
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222221', 'student', 'active'),
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'teacher', 'active'),
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222223', 'admin', 'active'),
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222224', 'super_admin', 'active')
on conflict (org_id, profile_id, role) do nothing;

insert into public.classes (id, org_id, name, grade_level, section, batch, delivery_mode, term, teacher_id)
values
  ('33333333-3333-4333-8333-333333333331', '11111111-1111-4111-8111-111111111111', 'Grade 10-A', '10', 'A', null, 'hybrid', 'Spring Term 2026', '22222222-2222-4222-8222-222222222222'),
  ('33333333-3333-4333-8333-333333333332', '11111111-1111-4111-8111-111111111111', 'Batch Alpha', null, null, 'Alpha', 'online', 'Spring Term 2026', '22222222-2222-4222-8222-222222222222')
on conflict (id) do nothing;

insert into public.subjects (id, org_id, class_id, name, code)
values
  ('44444444-4444-4444-8444-444444444441', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333331', 'Physics', 'PHY-10'),
  ('44444444-4444-4444-8444-444444444442', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333332', 'Mathematics', 'MATH-A')
on conflict (id) do nothing;

insert into public.enrollments (org_id, class_id, student_id)
values
  ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333331', '22222222-2222-4222-8222-222222222221'),
  ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333332', '22222222-2222-4222-8222-222222222221')
on conflict (class_id, student_id) do nothing;

insert into public.assignments (id, org_id, class_id, subject_id, teacher_id, title, instructions, status, due_at, points)
values
  ('55555555-5555-4555-8555-555555555551', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333331', '44444444-4444-4444-8444-444444444441', '22222222-2222-4222-8222-222222222222', 'Vector Forces Simulation', 'Upload your simulation result and short reflection.', 'published', '2026-05-20 23:59:00+00', 120),
  ('55555555-5555-4555-8555-555555555552', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333332', '44444444-4444-4444-8444-444444444442', '22222222-2222-4222-8222-222222222222', 'Algebra Mastery Set', 'Complete the worksheet and mark difficult questions.', 'published', '2026-05-21 23:59:00+00', 80)
on conflict (id) do nothing;

insert into public.submissions (org_id, assignment_id, student_id, status, content, score, feedback)
values (
  '11111111-1111-4111-8111-111111111111',
  '55555555-5555-4555-8555-555555555552',
  '22222222-2222-4222-8222-222222222221',
  'graded',
  'Submitted algebra set with working.',
  92,
  'Strong working. Review question 8 for cleaner factorization.'
)
on conflict (assignment_id, student_id) do nothing;

insert into public.resources (id, org_id, class_id, subject_id, teacher_id, title, type, body, moderation_status)
values
  ('66666666-6666-4666-8666-666666666661', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333331', '44444444-4444-4444-8444-444444444441', '22222222-2222-4222-8222-222222222222', 'Momentum and impulse visual guide', 'rich_note', 'Key formulas, diagrams, and guided examples for momentum.', 'approved'),
  ('66666666-6666-4666-8666-666666666662', '11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333332', '44444444-4444-4444-8444-444444444442', '22222222-2222-4222-8222-222222222222', 'Quadratic patterns worksheet', 'pdf', null, 'approved')
on conflict (id) do nothing;

insert into public.attendance_records (org_id, class_id, student_id, marked_by, attended_on, status)
values
  ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333331', '22222222-2222-4222-8222-222222222221', '22222222-2222-4222-8222-222222222222', current_date - interval '2 day', 'present'),
  ('11111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333331', '22222222-2222-4222-8222-222222222221', '22222222-2222-4222-8222-222222222222', current_date - interval '1 day', 'present')
on conflict (class_id, student_id, attended_on) do nothing;

insert into public.message_threads (id, org_id, class_id, kind, title, created_by)
values (
  '77777777-7777-4777-8777-777777777771',
  '11111111-1111-4111-8111-111111111111',
  '33333333-3333-4333-8333-333333333331',
  'class_channel',
  'Physics 10-A',
  '22222222-2222-4222-8222-222222222222'
)
on conflict (id) do nothing;

insert into public.message_participants (thread_id, profile_id, org_id)
values
  ('77777777-7777-4777-8777-777777777771', '22222222-2222-4222-8222-222222222221', '11111111-1111-4111-8111-111111111111'),
  ('77777777-7777-4777-8777-777777777771', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111')
on conflict (thread_id, profile_id) do nothing;

insert into public.messages (org_id, thread_id, sender_id, body)
values (
  '11111111-1111-4111-8111-111111111111',
  '77777777-7777-4777-8777-777777777771',
  '22222222-2222-4222-8222-222222222222',
  'New lab rubric has been attached.'
);

insert into public.badges (id, org_id, name, description, icon, xp_bonus)
values
  ('88888888-8888-4888-8888-888888888881', '11111111-1111-4111-8111-111111111111', 'Focus Architect', 'Maintained a long study streak with consistent submissions.', 'trophy', 250),
  ('88888888-8888-4888-8888-888888888882', '11111111-1111-4111-8111-111111111111', 'Problem Solver', 'Completed advanced challenge sets.', 'sparkles', 180)
on conflict (id) do nothing;

insert into public.user_badges (org_id, profile_id, badge_id)
values (
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222221',
  '88888888-8888-4888-8888-888888888881'
)
on conflict (profile_id, badge_id) do nothing;

insert into public.gamification_events (org_id, profile_id, action, xp, metadata)
values
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222221', 'assignment_submitted', 120, '{"assignment":"Algebra Mastery Set"}'),
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222221', 'perfect_attendance_day', 60, '{}');

# EduPulse

EduPulse is a production-oriented multi-tenant education SaaS MVP for
schools, academies, coaching centers, and online classes. It includes public
marketing pages, Firebase Auth, Supabase schema/migrations/RLS, role-specific
dashboards, AI endpoints, gamification, analytics, messaging, attendance,
assignments, notes, and admin security controls.

## Getting Started

Install dependencies and run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Dashboards are available after Firebase login once the Supabase schema is
installed and the user has an active organization membership:

- `/student`
- `/teacher`
- `/admin`

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Supabase

Supabase is initialized in `supabase/` with a real CLI migration and seed file.
For the hosted project, run these files in the Supabase dashboard SQL editor:

1. `supabase/migrations/20260518143431_lumina_learn_initial_schema.sql`
2. `supabase/seed.sql`

The local `.env.local` can enable `EDUPULSE_ENABLE_FIRST_USER_BOOTSTRAP=true`.
After the schema exists, the first verified Firebase user can create the initial
EduPulse organization and receive startup memberships. Turn this off in production
after the first institute owner is created.

Docker Desktop is required to run the local stack:

```bash
npm run supabase:start
npm run supabase:reset
npm run supabase:types
```

## Security

Read `SECURITY.md` before production deployment. The app uses signed HTTP-only
sessions, Next.js proxy route gates, Firebase token verification, Supabase RLS,
tenant-scoped storage paths, and AI audit logs.

## Deployment

The intended deployment target is Vercel.
"# edupluse" 

# EduPulse Supabase Setup

The project includes Supabase CLI `2.88.0` as a dev dependency because the
newer `2.99.0` Windows npm binary crashes/hangs in this local Node environment.
Use the npm scripts in `package.json` so the pinned local CLI is used.

Local files:

- `config.toml`: Supabase local stack config with Firebase third-party auth.
- `migrations/20260518143431_lumina_learn_initial_schema.sql`: initial schema,
  RLS policies, Storage buckets, and Realtime publication setup.
- `seed.sql`: demo organization, profiles, classes, assignments, resources,
  attendance, messaging, and gamification data.
- `schema.sql`: readable copy of the initial schema.

Setup:

1. Install Docker Desktop.
2. Copy `.env.example` to `.env.local` and fill Firebase, Supabase, and OpenAI
   values.
3. Start Supabase with `npm run supabase:start`.
4. Reset/apply migrations and seed with `npm run supabase:reset`.
5. Generate DB types with `npm run supabase:types`.

Firebase requirements:

- Add a Third-party Auth Firebase integration in hosted Supabase, or use the
  `[auth.third_party.firebase]` config locally.
- Ensure Firebase ID tokens include the custom claim `role: "authenticated"`.
- Keep per-organization storage paths shaped as `<org_id>/<resource-path>` so
  Storage RLS can resolve tenant membership.

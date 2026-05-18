# EduPulse Security Model

The dashboard uses defense in depth. UI redirects are not treated as security.

## Request Layer

- `/student`, `/teacher`, and `/admin` routes are guarded in `src/proxy.ts`.
- The proxy verifies the `lumina_session` HTTP-only cookie before dashboard pages load.
- The cookie is HMAC-signed with `APP_SESSION_SECRET` and expires after 8 hours.
- Role mismatch redirects to the correct dashboard instead of rendering restricted routes.
- Security headers are applied through the proxy: frame denial, content sniffing
  prevention, referrer policy, and browser permission restrictions.

## Auth Layer

- Firebase Auth handles identity.
- `/api/auth/session` verifies Firebase ID tokens with Firebase Admin before issuing
  an app session.
- Production sessions require Supabase membership lookup, so a user cannot choose
  an arbitrary role from the browser.
- `LUMINA_ENABLE_FIRST_USER_BOOTSTRAP=true` is only for initial setup. It still
  requires a verified Firebase token and only works when the membership table is
  empty. Disable it after the first institute owner is created.
- Firebase users must receive the custom claim `role: "authenticated"` for
  Supabase Data API, Storage, and Realtime access.
- `npm run firebase:set-supabase-claims` assigns that claim to existing users.

## Data Layer

- Supabase RLS is enabled on all exposed tables.
- Authorization uses `profiles.firebase_uid` plus `memberships.org_id`, role, and
  active status.
- Storage buckets require organization-prefixed object paths:
  `<org_id>/<resource-path>`.
- AI interactions are logged with organization, role, Firebase UID, prompt, and
  response metadata.

## Production Checklist

- Set a strong `APP_SESSION_SECRET`.
- Configure Firebase Admin env vars on the server only.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- Enable Firebase third-party auth in hosted Supabase.
- Run Supabase advisors after applying migrations.
- Keep all sensitive reads/writes behind RLS, server routes, or both.

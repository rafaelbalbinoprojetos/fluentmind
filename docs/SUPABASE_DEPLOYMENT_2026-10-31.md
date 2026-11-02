# Supabase deployment — 2026-10-31

## Target and application

- Project: `cvgcfpaitoigcoinvnaj`, explicitly selected by the user.
- Source environment: `.env.local`.
- The three scripts below were applied successfully in one transaction, with a
  five-second lock timeout and sixty-second statement timeout.
- The target did not contain these four tables/functions before this application.
- The database phase was followed by the production deployment recorded below.

| Script | SHA-256 of the applied source file |
| --- | --- |
| `ultra_access_grants.sql` | `11a46ee0567f171931323e51043692e608759936ff0bec9d28f837a298c53174` |
| `insights_schema.sql` | `68c15a4d7f237d797db8a851553b1c1f53137a71d1a56b16cc0d0fb11b270b0a` |
| `ai_usage.sql` | `2cd30ac36e97629a75887a2a050b2e088261009291424c263a400ee5c038c4f6` |

## Verified database state

- `ultra_access_grants`, `insights`, `ai_usage` and `ai_trials` exist with RLS enabled.
- Ultra access has only owner-read and master-management policies.
- Insights has the three intended owner policies.
- `consume_ai_usage` and `start_ai_trial` execute as invoker and are executable
  by `service_role`, but not by `anon` or `authenticated`.
- Real transactional checks passed for quota increments, rejecting exhausted
  quotas, monthly reset, repeat trial activation, preserving expired trial dates,
  isolation of two accounts, cross-account write rejection and master management.
- Checks used `supabase/tests/validate_security_and_usage.sql`. All fixture rows,
  quota increments and trial dates were rolled back.
- The final audit found zero rows in all four new tables and preserved both
  existing authentication accounts.
- This run did not include a multi-session concurrency load test.

## Legacy premium audit

Two existing accounts were inspected for the relevant plan fields. No account
had a legacy `premium`, `pro` or `ultra` plan in editable `user_metadata` requiring
migration. No account was promoted and no authentication metadata was rewritten.
The configured master account remains recognized by the existing application
rules; master database permissions passed the integration test.

## Public key configuration correction

The integration check identified that `.env.local` used the administrator
`service_role` key as `VITE_SUPABASE_ANON_KEY`. Only that frontend assignment was
replaced with the project's verified `anon` key. The server credential was retained.
No credential values are recorded here.

REST checks after correction:

| Credential | Operation | Result |
| --- | --- | --- |
| Server `service_role` | Read usage table with zero-row limit | HTTP 200 |
| Server `service_role` | Invoke usage RPC with a deliberately null user | HTTP 400, `P0001` from argument validation; no writes |
| Public `anon` | Read usage table | HTTP 401, `42501` permission denied |
| Public `anon` | Invoke usage RPC | HTTP 401, `42501` permission denied |

A build-time guard and browser client validation now reject administrator keys
in the public Supabase variable. The guard was also exercised through an actual
Vite build with a synthetic administrator JWT: it failed before bundling.
The administrator key was not rotated as part of this database migration. Review
and rotate it if prior development builds containing it were shared or exposed.

## Local validation and deployment

- ESLint passed.
- 65 automated tests passed.
- Production build passed.
- `.env.production` and the Vercel Production Supabase variables now point to
  `cvgcfpaitoigcoinvnaj`. No SQLs were applied to the separate KORDEN database.
- Production uses the locally verified OpenAI key. The existing protected
  ElevenLabs production credential was preserved; its value cannot be retrieved
  from Vercel, so voice generation was not part of the deployment smoke test.

## Production publication — 2026-10-31

- Vercel project: `rafael-balbinos-projects/fluentmind`.
- Deployment: `dpl_4UVrQ5YUt9EU7a7GMuCYioU6cxAx`.
- Deployment URL: https://fluentmind-m27qvnylf-rafael-balbinos-projects.vercel.app
- Public alias: https://project-r80py.vercel.app
- Conversation page: https://project-r80py.vercel.app/conversar
- Status: Ready; both existing public aliases now point to this deployment.
- Production variables were separated from their existing shared Production /
  Preview definitions, retaining the previous Preview values. Sensitive values
  were updated through Vercel's official API because the installed CLI attempted
  to edit immutable keys of Sensitive variables.
- `.vercelignore` excludes environment files, dependencies, caches, tests,
  database scripts and local documentation from the source upload.
- The cloud build succeeded. Public `/`, `/app`, `/dashboard` and `/conversar`
  returned HTTP 200 with the SPA shell.
- The published frontend references the intended Supabase project and contains
  neither the server Supabase credential nor the OpenAI credential.
- All five API endpoints returned HTTP 401 without a user token, confirming
  they are deployed and require authentication. The smoke test made no paid AI
  generation calls and consumed no user quota.

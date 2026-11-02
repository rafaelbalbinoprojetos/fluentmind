# FluentMind

Stop translating. Start thinking.

FluentMind is a premium language-learning dashboard built with React, Tailwind CSS and Supabase foundations. The product focuses on AI conversations, saved expressions, MindBlocks, review flows, playlists, pronunciation practice, corrected mistakes and personal progress.

## Local Development

```powershell
npm install
npm run dev
```

Default local URL:

```text
http://127.0.0.1:5173/
```

## Build

```powershell
npm run build
```

## Validation

```powershell
npm run lint
npm test
npm run build
```

## Simple conversation

Open `/conversar`, or select **Conversa livre** in the menu/dashboard. This page
has a conversation area and one composer with text, microphone and send controls.
Enter sends a message; Shift+Enter adds a line. Stop the microphone to transcribe
and send the utterance, then hear the reply. Text replies have an **Ouvir** button;
the header sound toggle enables spoken replies for typed messages too.

The current conversation stays in this tab's `sessionStorage`, scoped to the user.
**Nova conversa** clears that conversation and cancels pending requests/recording.
It does not create a permanent conversation in the Supabase history. Use the
existing learning chatbot for its MindBlock, correction and history workflows.

Server model defaults:

| Purpose | Default | Server override |
| --- | --- | --- |
| Chat | `gpt-6-luna`, low reasoning | `OPENAI_MODEL` |
| Answer/mistake correction | Same as chat | `OPENAI_CORRECTION_MODEL` |
| ElevenLabs voice | `eleven_v4` | `ELEVENLABS_MODEL` |

GPT-5/6 requests omit sampling parameters that are incompatible with reasoning.
The simple conversation mode returns a concise reply without a second correction
request. The existing learning chatbot continues returning suggestions/corrections.

Eleven v4 uses `/v1/text-to-dialogue`; older explicitly configured TTS models use
`/v1/text-to-speech/{voice_id}`. Both voice routes share this integration and honor
`ELEVENLABS_VOICE_MINEIRINHA`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_VOICE_FEMALE`, and
`ELEVENLABS_VOICE_MALE`. Long text is split into bounded dialogue requests. Cached
MindBlock audio is reused. `eleven_v4_turbo` needs a different WebSocket transport
and is not supported by these HTTP routes.

Use `vercel dev` when testing serverless APIs locally; `npm run dev` serves only
the Vite frontend. Keep provider keys on the server. The database security/usage
scripts below must be applied before live calls can reserve quota. Microphone
access requires HTTPS or localhost and browser permission.

Model references: [OpenAI GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna),
[ElevenLabs models](https://elevenlabs.io/docs/overview/models/), and
[ElevenLabs dialogue API](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert).

## Security update and database deployment

Before deploying the updated APIs, run these scripts in the Supabase SQL Editor,
in this order:

1. `supabase/ultra_access_grants.sql` — replaces the broad read policy with owner
   and administrator access. Align the master email in this script with
   `ULTRA_MASTER_EMAILS` if you customized the server configuration.
2. `supabase/insights_schema.sql` — installs the corrected, repeatable policies.
3. `supabase/ai_usage.sql` — creates the server-only usage/trial tables and atomic
   reservation functions. It can be run again without resetting usage or trials.

Deploy the application and APIs only after these scripts succeed. A missing usage
function causes paid operations to return 503; the APIs do not bypass accounting.
The checked-in SQL is not automatically applied by the Vite build.

Premium plans and trial dates are read from server-managed `app_metadata`, or
from an active Ultra grant. Editable `user_metadata` no longer authorizes access.
Review existing paid accounts and assign their verified plan through the Supabase
admin interface/API; do not automatically copy user-editable plan fields.
Existing active Ultra grants remain supported, including legacy email grants
that are not bound to another user.

The seven-day trial starts through the authenticated `start-trial` action on
`/api/ultra-access`. The database records the first activation, so retries cannot
extend it. Trial fields are mirrored into `app_metadata` by the server.

Chat, answer correction, transcription, speech and new MindBlock audio generation
share the existing Pro budget of 300 operations per UTC calendar month. Each paid
attempt reserves one operation before calling its provider; a later provider or
storage error does not refund that reservation. Replaying cached MindBlock audio
does not consume another operation. Concurrent requests reserve quota atomically.
Usage and trial tables/RPCs are accessible only to `service_role`.

Learning progress, events, onboarding and Neo memory caches are isolated by user
ID. Unscoped legacy browser data is retained but no longer imported because its
owner cannot be established. Existing Supabase data is loaded normally. Daily
missions, streaks and activity use the learner's browser calendar day.
Authenticated screens wait for hydration before recording progress; late
authentication responses and learning actions from a previous account are ignored.

The three scripts were applied to `cvgcfpaitoigcoinvnaj` on 2026-10-31. Real database
tests verified quotas, monthly reset, trial dates, owner isolation, master access,
and table/RPC privileges, with all test writes rolled back. The local unit tests
still mock the database boundary. See
`docs/SUPABASE_DEPLOYMENT_2026-10-31.md` for the audit and deployment scope.

The rollback-only integration check can be repeated with an authorized CLI session:

```powershell
supabase db query --linked --project-ref cvgcfpaitoigcoinvnaj --file supabase/tests/validate_security_and_usage.sql --output json
```

This test requires two existing users. Run it with an administrator; it creates
temporary fixtures, checks several database roles and rolls everything back.
Vite now rejects a `service_role` or `sb_secret_` key in `VITE_SUPABASE_ANON_KEY`
before starting the frontend/build. Use an anon/publishable key in that variable.

## Upload To GitHub

```powershell
.\upload_fluentmind_to_github.ps1
```

The upload script protects local `.env*` files by default.

## Current production deployment

The immersive presentation is published at https://project-r80py.vercel.app/neo,
with an entry from **Neo imersivo** and the orbit icon in `/conversar`. It shares
the existing conversation logic and session cache. See `docs/NEO_IMMERSIVE_MODE.md`
for previews, files, state behavior, validation and limitations.

Published on 2026-10-31 to https://project-r80py.vercel.app.
The simple conversation page is https://project-r80py.vercel.app/conversar.
Production and `.env.production` now target the validated Supabase project
`cvgcfpaitoigcoinvnaj`; existing Preview environment values were preserved.
Deployment details and smoke-test results are recorded in
`docs/SUPABASE_DEPLOYMENT_2026-10-31.md`.

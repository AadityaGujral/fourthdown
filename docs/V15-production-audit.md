# FourthDown V15 production audit — 2026-10-06

Story: NFL feeds render scores and player leaders; signed-in users save favorites and alert preferences; their browser subscriptions receive opt-in notifications through authenticated APIs and scheduled dispatch.

## Verified baseline

- Canonical health endpoint returned HTTP 200 with `version: v15`, `pushConfigured: true`, `cloudAuthConfigured: true`, `emailConfigured: true`, and `cronConfigured: true`.
- Vercel's production deployment matched `main` commit `26d6d7610cb8839f24e5aeef7207ef3130123cd7`; no grouped runtime errors were reported for the preceding 24 hours. Absence of errors is not proof of correct behavior.
- HTTP 200: home, account, scores, stats, fantasy, standings, teams, injuries, notifications, analytics, news, search, service worker, personalization snapshot.
- Unauthorized requests received HTTP 401: both cron routes and POST requests to push-test and email-dispatch.
- Live browser: Account rendered, signed-out Enable Browser Push returned “Sign in first.” Stats rendered its unavailable fallback, reproducing the leaders bug.
- All eight public application tables have RLS enabled. Existing row policies restrict reads/writes to `auth.uid()` ownership; write policies include ownership checks. This is a catalog inspection, not a two-user isolation test.
- Database held zero browser push subscriptions at audit time. No real-device delivery was attempted or verified.

## Fixes

| Priority | Finding | Change and evidence |
|---|---|---|
| Critical | Three publicly callable SECURITY DEFINER write helpers rejected wrong secrets with `<>`. SQL NULL bypassed that rejection branch. | Replaced guards with `IS DISTINCT FROM` in production. Transactional checks confirmed null-secret email-record, push-record, and subscription-delete calls return false, as does invalid-secret deletion. No test data was changed. Migration included in repository. |
| High | ESPN leaders response uses `leaders.categories`; V15 called `.slice()` on the enclosing object, then silently returned unavailable. | Support nested categories and array variants. Verified with the current upstream response and regression cases. |
| High | Leaders fetched with Next fetch caching despite a >2 MB response. | Fetch raw response with `no-store`; use `unstable_cache` for only 8 categories × 5 normalized leaders, revalidating every 900 seconds. Oversized-payload regression proves bulky upstream fields are excluded. |
| High | Push state could show success despite failed preference writes or missing saved subscription. Errors could leave an indefinite loading state. | Check database results, bound service-worker readiness, catch UI errors, disable buttons during operations, refresh on auth changes, and require browser plus saved subscription when checking enabled state. |
| High | Disabling one browser switched off account-wide preferences, affecting every device. | Delete only this browser's subscription; leave global alert preferences intact. |
| Medium | Test endpoint reported `ok: true` with zero successful sends; expired subscriptions persisted. | Return 409 for no subscriptions, 502 for zero accepted deliveries, 503 for service errors; remove this user's expired 404/410 subscriptions. Tests cover all branches. |
| Medium | Supabase async work was started directly inside auth callbacks. | Defer loaders until after the synchronous callback to avoid waiting while the auth lock is held. |
| Medium | Sports feed errors were swallowed; network calls lacked deadlines. | Eight-second feed deadlines and structured diagnostics with no upstream payload or personal data. Snapshot reports feed availability separately. Cron RPC/email and push sends also have deadlines and failure logs. |
| Medium | An empty successful scoreboard showed static samples with a live-feed label. | Display an explicit empty schedule instead; samples appear only on failure. |
| Medium | Dependency ranges and no lockfile made installs vary between builds. | Pin installed dependency versions, commit npm lockfile, and add typecheck/test scripts. |
| Medium | Notification click URLs were trusted, and focus raced navigation. | Restrict URLs to this origin; await navigation before focus. Regression test covers external URLs. |
| High | Arizona/Washington app abbreviations differ from ESPN identifiers, causing two roster failures and breaking personalized team matches. | Translate ARZ↔ARI and WAS↔WSH at provider boundaries; regression cases cover roster requests and scoreboard output. |
| Medium | No app manifest or standalone metadata for the iPhone Home Screen Web Push path. | Add a standalone manifest, app icons, and Apple web-app metadata. Real iPhone verification remains pending. |

## Validation

- 18 automated regression tests passed: nested/array leaders, oversized normalization, empty schedules, six provider failure paths, push authentication, missing subscriptions, expired subscriptions, accepted delivery, query failures, and safe notification navigation.
- TypeScript and production Next build passed. Feed fallback warnings are now visible rather than swallowed.
- Application production deployment is pending explicit approval: automatic approval review rejected the direct push to main. The production app still uses the original V15 deployment. The database guard patch was applied separately and is already live.
- Draft PR #1: https://github.com/AadityaGujral/fourthdown/pull/1.
- Vercel preview `dpl_CvkLfxo9URVYa8K2h8fgKQA5mFLD` reached READY from application commit `7a9851c5016ef12beda7c5c500b30d0270844fff`. Its build completed in 17 seconds with no leaders-cache or roster failure warnings.
- Authenticated Vercel fetch checks of that preview returned HTTP 200: Stats contains Passing Yards leader data; Arizona and Washington contain LIVE PROTOTYPE ROSTER; Account loads; manifest declares standalone display with 192/512 icons. These are rendered HTTP response checks, not an authenticated user or physical-device push test.

## Remaining V16 work, in priority order

1. **Real-device account and push test.** Sign in, enable push, verify a saved subscription, send a test, confirm the OS notification arrives and opens the app, then disable/re-enable. On iPhone use the installed Home Screen web app. An accepted provider request does not prove OS receipt.
2. **Generate alerts without a page visit.** Current game/injury notification generation lives in `NotificationCenter`. Scheduled delivery only reads stored notifications; it does not ingest new sports events. Move generation to a server-side ingestion job before describing this as continuous unattended alerting.
3. **Delivery durability and scale.** Add batch claiming/idempotency, per-subscription push delivery dedupe, bounded concurrency, retry/backoff, and execution-budget checks. Current dedupe is per user/notification; partial multi-device failures can be suppressed after another device succeeds. Daily alert cron is not real-time.
4. **Privileged RPC isolation.** Supabase advisors flag six secret-gated SECURITY DEFINER RPCs executable by anon and authenticated roles. They intentionally support today's publishable-key cron requests, so revoking access alone would break dispatch. Migrate server calls to a least-privilege server identity/private function model, then revoke browser-role execution. Null-secret write bypass has already been repaired.
5. **Email launch configuration.** Health reports Resend onboarding sender and test-recipient mode. Verify a sender domain and delivery behavior before enabling arbitrary user recipients.
6. **Auth security.** Supabase advisor reports leaked-password protection disabled; assess supported plan/settings and enable it before wider onboarding.
7. **Observability.** Add alerting/retention and operational dashboards for feed status, job failures and delivery counters. Structured logs alone do not notify an operator.
8. **Data quality and licensing.** ESPN is still an unlicensed prototype feed. Confirm feed availability semantics and integrate a licensed provider before promising production sports-data coverage.
9. **Mobile and authenticated UX.** Complete physical-device layout and two-account isolation tests. No authenticated browser session was available in this audit.

## Sources

- [Live application](https://fourthdown.vercel.app), [health](https://fourthdown.vercel.app/api/health), [Stats](https://fourthdown.vercel.app/stats).
- [PostgreSQL comparison predicates and NULL](https://www.postgresql.org/docs/17/functions-comparison.html).
- [Next.js unstable_cache](https://nextjs.org/docs/app/api-reference/functions/unstable_cache).
- [Supabase auth state callbacks](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Supabase privileged-function advisor](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
- [WebKit: Home Screen Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
- [Next.js app manifest](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest).

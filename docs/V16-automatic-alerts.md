# V16 automatic alerts

V16 generates favorite-team game alerts and saved-player injury alerts on the server. Opening the inbox is no longer required. Each opted-in browser has its own delivery job so one device succeeding cannot suppress retries for another.

## Schedule and limits

The existing Vercel schedule remains daily at 13:00 UTC, with weekly email on Mondays at 14:00 UTC. These are scheduled updates, not real-time score alerts. Game events are restricted to 24 hours around their start time; unchanged scores and injuries deduplicate. Each run claims at most 20 deliveries and sends at most four concurrently. Pending jobs expire after 72 hours, use five-minute leases and stop after five attempts. Backoff is enforced by the database; on the daily schedule retries normally wait until the next run. This throughput suits the current small installation and must be increased before wider launch.

## Data and security

Two additive migrations create private queue/configuration/run tables and an inbox visibility flag. Private tables have RLS, no client grants and deliberately no client policies. The private worker function uses SECURITY INVOKER. A narrow public SECURITY DEFINER wrapper requires the existing cron secret (NULL and invalid secrets fail); authenticated clients have no execute grant. The wrapper is callable with the server's existing publishable-key plus secret configuration. The secret hash is copied inside Postgres from the existing server function, never exported to the repository.

Supabase's security advisor consequently flags the intentional anonymous secret-gated wrapper and reports informational no-policy notices for the private tables. Existing V14/V15 secret-gated function warnings and disabled leaked-password protection remain. See [the definer-function advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) and [password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). This release does not assert a warning-free security audit.

Preview deployments cannot run mutating delivery jobs. Cron endpoints require a constant-time Bearer-secret check. Push endpoints are limited to known HTTPS browser push providers. Failed or expired subscriptions do not silently count as delivered. User opt-out cancels queued work when claiming it; requests already in flight cannot be recalled.

## Delivery semantics

Email uses a stable Resend idempotency key for each queue job. Provider acceptance and database settlement are separate operations. If settlement fails, the worker records an unsettled count and does not immediately send again. Delivery is at least once: an ambiguous provider response or expired lease can cause a later retry, and [Resend idempotency lasts 24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys), shorter than the queue retention. Push uses a stable notification tag. Provider acceptance does not prove an operating system displayed an alert.

Email remains in the existing test-recipient mode with the onboarding sender. Wider recipient launch requires a verified sender and removal of the test override. No domain purchase is part of V16.

## Verification (2026-10-06)

- 27 Node regression tests, including authorization, event deduplication, endpoint validation, retry classification, concurrency, lease settlement failure and preview write blocking.
- Rolled-back SQL integration tests against the configured database: server ingestion without UI, duplicate suppression, independent device delivery/retry, stale and expired lease fencing, opt-out, exhaustion, expiry, weekly dedupe, secret rejection and private-schema denial. No external messages sent or audit users retained.
- TypeScript and production build checks; local sports-feed requests can time out in the restricted build environment and correctly use fallback rendering.
- Additive migrations applied successfully; security advisor reviewed as above.

Deployment verification is recorded in the pull request and completion message. A manually authenticated production cron run could not be performed because Vercel does not return the sensitive CRON_SECRET value. The next scheduled run and actual iPhone receipt remain operational checks. At implementation time there were no registered push subscriptions, so device delivery cannot be claimed verified.

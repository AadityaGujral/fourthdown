# FourthDown

Independent NFL scores, teams, player leaders, standings and opt-in alerts. Sports feeds currently use public prototype endpoints.

## Development

Use Node.js 24. Copy `.env.example` to `.env.local` and set the two public Supabase values. Browser push additionally requires the public VAPID key at build time and private VAPID values on the server. Never put private credentials in `NEXT_PUBLIC_` variables.

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

Production environment variables live in Vercel. Both cron routes require `Authorization: Bearer <CRON_SECRET>`; do not manually run dispatch against production unless actual delivery is intended.

[Production audit and prioritized V16 work](docs/V15-production-audit.md)

[Live site](https://fourthdown.vercel.app) · [Health](https://fourthdown.vercel.app/api/health)

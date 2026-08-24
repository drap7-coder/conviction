# CONVICTION roadmap

Phase 0 stops silent-miss deploys. Phases 1–4 compound from there. Do not build Phase 3/4 on fetch-fresh-every-load — redo cost is high.

## Phase 0 — Stop losing work

- Production branch in Vercel must match what Cursor ships (`main` → `www.gotconviction.com`).
- `?debug=1` shows the baked commit SHA in a muted footer (`VERCEL_GIT_COMMIT_SHA` → `NEXT_PUBLIC_BUILD_ID`).
- Slack/email deploy pings: Vercel dashboard (Team → Integrations → Slack). `vercel.json` cannot subscribe to deploy events.
- Use per-PR Vercel preview URLs to verify before merging to `main`.

## Phase 1 — Foundation

- Neon/Postgres `companies` + `evidence_scores` with cache-aside (fresh if under 24h, else score and write back).
- `ConvictionScore` two-PR plan: foundation → institutional + earnings wiring.
- Watchlist off localStorage into the same backend (needs accounts — Phase 2).

## Phase 2 — Retention

- Auth (Clerk or existing NextAuth) so watchlist/portfolio persist across devices; localStorage fallback + migrate on sign-up.
- Alerts: institution files on a watchlist ticker, or Conviction Score crosses a threshold. Email first.
- Daily digest: overnight book/watchlist changes, reusing Pulse fetchers (Resend or similar).
- Onboarding: populated watchlist/portfolio in under 60 seconds (photo import or sample books).

## Phase 3 — Depth

- Options flow / unusual activity as an evidence category.
- Backtesting vs Study templates (All-Weather, 60/40, …).
- Per-ticker and portfolio daily narrative on structured evidence.
- `/compare?tickers=` side-by-side Conviction Signals.

## Phase 4 — Growth

- Dynamic OG images (score, sparkline, one-line synthesis).
- Public leaderboards (top movers, most-watched).
- SEO-indexable ticker pages (already App Router — keep `generateMetadata` per ticker).
- Embed widget for blogs/newsletters.

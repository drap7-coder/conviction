<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

This is a single Next.js 16 (App Router, Turbopack) app named `conviction`. Package manager is **npm**. Standard commands live in `package.json`: `npm run dev` (port 3000), `npm run build`, `npm run typecheck` (`tsc --noEmit` — there is no ESLint/lint script), and `npm run test` / `npm run test:watch` (Vitest).

- The app runs fully in **guest mode with no external services**: no database, KV, or auth provider is required to boot and use it. Auth (`auth.ts`) falls back to JWT sessions and the watchlist persists to a local JSON file under `.conviction/` when Neon/Vercel KV env vars are absent. `npm run dev` alone is enough to exercise the product end-to-end (root `/` redirects to `/pulse`).
- Heatmaps share one tile language (no pulsing status dots, uniform tiles, one-line names with ellipsis, brokerage teal/red fills from `src/lib/display/heat-color.ts`). **Quote grids** (Watchlist, Trending) show last `$` plus session `%`. **Pulse index/sector/theme heatmaps are `%` only**. News starts with a stat strip then stories — no second lede before the first headline. Page heroes use `ProductStage` on canvas tokens (`var(--card)` / `var(--ink)`).
- Live market/filings data is fetched at runtime from public third-party APIs (Yahoo Finance, SEC EDGAR, FINRA, Nasdaq). Egress to some of these (notably `data.sec.gov`) may be blocked/403 in the cloud sandbox; the app degrades gracefully but some evidence panels may be empty.
- Known pre-existing test failures unrelated to setup: `tests/company-tickers.test.ts` hits the real SEC API and fails with `403` when egress is blocked; one case in `tests/conviction-score-adapters.test.ts` ("remaps 0–100 ring…") is time-dependent (uses default July 2026 filing dates without a fixed `now`) and fails once the current date is far enough past those dates. The other ~522 tests pass.
- Optional integrations are enabled only via env vars: `DATABASE_URL` (Neon Postgres, with SQL in `migrations/`), `AUTH_SECRET` + GitHub OAuth creds (NextAuth GitHub sign-in), `KV_URL`/`KV_REST_API_URL` (Vercel KV), `FMP_API_KEY`, `GOOGLE_BOOKS_API_KEY`, `CRON_SECRET`. None are needed for local development.

# CONVICTION — Ownership Signals

Track institutional ownership, insider filings, and what’s driving the move — on your watchlist and across the market.

## Getting Started

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in what you need.

Optional env:

```bash
# Broader earnings coverage (FMP primary, Nasdaq fallback)
FMP_API_KEY=your_key_here
```

## Auth (GitHub + Neon)

Sign in stays in guest mode until these are set (locally or on Vercel):

- `DATABASE_URL` — Neon Postgres connection string
- `AUTH_SECRET` — `openssl rand -base64 32`
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` — GitHub OAuth App credentials
- Recommended: `AUTH_URL=https://www.gotconviction.com` and `AUTH_TRUST_HOST=true`

GitHub OAuth callback URL:

```text
https://www.gotconviction.com/api/auth/callback/github
```

For local dev, also allow:

```text
http://localhost:3000/api/auth/callback/github
```

Apply the auth schema once against Neon:

```bash
psql "$DATABASE_URL" -f migrations/001_auth_user_watchlists.sql
```

Check readiness after deploy:

```text
GET /api/health/auth
```

Expect `authConfigured`, `databaseReachable`, and `requiredTablesPresent` to be `"yes"`. Until then the UI shows “Sign in soon” / “Sign in coming soon” and guest watchlists still work.

## Product surfaces

- **Watchlist / Portfolio** — Companies and holdings you follow
- **Pulse** — Indexes, sectors, and trending heatmaps
- **Smart Money** — Institutional 13F moves and political disclosures

## Data Sources (V1)

- SEC EDGAR (fixtures)
- Market price feed (fixtures)
- USAspending (fixtures)

## Build

```bash
npm run build
```

# CONVICTION — Evidence Detection

Find material changes before they become obvious.

## Getting Started

```bash
npm install
npm run dev
```

Optional env:

```bash
# Broader earnings coverage (FMP primary, Nasdaq fallback)
FMP_API_KEY=your_key_here
```

## Architecture

- **Watchlist** — Companies you follow with latest evidence
- **Emerging** — New companies surfaced by deterministic reason codes
- **Journal** — Thesis tracking and outcome review
- **Evidence Timeline** — Event history per company

## Data Sources (V1)

- SEC EDGAR (fixtures)
- Market price feed (fixtures)
- USAspending (fixtures)

## Build

```bash
npm run build
```
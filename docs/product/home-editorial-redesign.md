# IQBulls Home: editorial market perspective

October 28, 2026. Supersedes the equal-weight six-tile Home dashboard. Pulse, Portfolio and News retain their dedicated roles.

## Desktop wireframe

    IQBulls / The daily perspective              Brand promise
    THE MARKET IN PERSPECTIVE
    One factual directional takeaway
    Session · possible delay · snapshot fetch time
    ┌─────────────────────────────────┬───────────────────────┐
    │ S&P 500 / SPY     Explore Pulse  │ Growth stocks / QQQ   │
    │ Session change + ETF price      │ Gold / GLD            │
    │ Large intraday chart            │ Borrowing costs / 10Y │
    │ Actual range + dated ET times   │ Smaller context charts│
    └─────────────────────────────────┴───────────────────────┘
    What changed                      Why it matters
    Sources, timing & how to read this [expand]
    Three sourced headlines                       Explore News
    Personal workspace invitation                 Open watchlist

## Mobile wireframe

Identical reading order in one column: takeaway → main chart → three supporting signals → what changed → why it matters → expandable methodology → headlines → watchlist link. No horizontal page scrolling or hidden critical labels. Market depth remains an explicit Pulse destination.

## Visual and interaction standards

Deep green-black canvas; charcoal panels; off-white text; readable gray supporting text; emerald controls; cyan chart lines. Gains and losses retain signed mint/coral values. No decorative streaming indicators, animated charts, or multicolor tile fills. Body line-height 1.55–1.65. Keyboard focus uses a cyan outline; primary links and summaries target at least 44px. Normal text targets WCAG AA 4.5:1 contrast, large text 3:1. Monospace is limited to figures/symbols. No motion is introduced.

## Data contract and limits

Reuse existing cached Pulse, quotes and news endpoints. Home requests SPY, QQQ and GLD, plus existing Pulse macro data. Remove Home's separate trending fetch; stock rankings remain in Pulse. Do not add providers or backend fan-out.

Direction copy describes SPY's displayed session move, not a causal news explanation. ETF prices must not be presented as index levels or spot prices. Charts show actual dated intraday points with independent scales. Empty history is unavailable, never synthetic. Sector counts include only finite available readings; they are not a whole-market breadth statistic.

Fetch time is labeled as a snapshot fetch, not a trade time. Quotes may be delayed. Snapshot older than 15 minutes or refresh failure gets a visible warning; market-session text remains separate from freshness. This release does not claim real-time connectivity. Publication timestamps accompany source links; do not present generic theme summaries as verified explanations for specific articles.

## Verification

Check desktop and a 390px-wide viewport. Verify loading, unavailable and empty states; sparse/invalid chart data; keyboard access to methodology; actual source links and mobile overflow. Keep Pulse components and navigation untouched. Run typecheck, Vitest and production build. Product acceptance: a newcomer can state the broad-market move quickly; an experienced reader can find session, source and timeframe without hunting.

## October 29 visual update

Home adds the existing bull mark and a Pulse-inspired grid/watermark overlay. Navy surfaces and stronger cyan/blue accents replace the muted green Home panels. A finite arrival sequence and light sweep run once in under four seconds; reduced-motion disables both. Charts and quote values do not animate. This supersedes the earlier no-motion/emerald-only visual direction while preserving the reading order and data contract.

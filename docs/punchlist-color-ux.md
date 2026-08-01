# Punch list — color, news filter, UX (Jul 2026)

Hand-off notes for the color/design spec plus screenshot bugs.

## Color model (documented decision)

**Heat / Market Moves tiles = two-state session move (teal / red), escalated by magnitude.**  
**Distribution / Holding / Accumulating = three-state conviction on detail rings only.**

Do not map Accumulating → tile green or Distribution → tile red. Tiles answer “up or down (and how much)”; the ring legend answers ownership/evidence state.

| Role | Value |
|---|---|
| Borders | `#E4E6EA` |
| Text primary | `#111318` |
| Text secondary | `#6B7280` |
| Positive / up / Accumulating accent | Teal `#0D9488` |
| Mild down (sub-1%) | Soft red `#F87171` on `#FEF2F2` |
| Strong down | Full red `#DC2626` / `#FECACA` tile |
| Holding | Amber `#D97706` |
| Distribution | Red `#DC2626` |

### Heat tile escalation (dark magnitude tiles)

| Band | Threshold | Tile fill | % chip |
|---|---|---|---|
| Flat | `|Δ| < 0.05%` | `#262626` | `#404040` / `#E5E5E5` |
| Mild up | `< 2.5%` | emerald-900 | emerald-800 / 100 |
| Strong up | `≥ 2.5%` | emerald-700 | emerald-600 / white |
| Extreme up | `≥ 8%` | emerald-500 | emerald-400 / 950 |
| Mild down | `< 2.5%` | rose-950 | rose-900 / 100 |
| Strong down | `≥ 2.5%` | rose-800 | rose-700 / white |
| Extreme down | `≥ 8%` | rose-600 | rose-500 / white |

Ticker sits in a `bg-black/30` pill (legible on every fill). Percent is its own contrast-matched chip.

## Bugs

1. **TDOC Material News** — filter RSS/events with `isCompanyRelevantHeadline`; never fall back to unscoped headlines for badges or lists.
2. **AMZN +15.2%** — verify against Yahoo regular vs extended session; prefer `previousClose` / `regularMarketPreviousClose` over a stale `chartPreviousClose` when both exist.

## UX polish

3. Narrative tone tags: **price reaction** (not ambiguous “reaction”).
4. Conviction Score: one calc only — `/api/conviction/score` (`displayScore` / `tone` / `ringLabel`). List surfaces must not fall back to `getCardVerdict` heuristics.
5. **Attention pace** `N×` = last-hour theme mentions ÷ trailing hourly baseline (`(24h − last hour) / 23`, floor 0.5). Expose that baseline in the UI.

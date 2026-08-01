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

### Heat tile escalation

| Band | Threshold | Up fill | Down fill |
|---|---|---|---|
| Flat | `|Δ| < 0.05%` | `#EDEEF1` | `#EDEEF1` |
| Mild | `< 2.5%` | soft teal | `#FEF2F2` |
| Strong | `≥ 2.5%` | mid teal | `#FECACA` |
| Extreme | `≥ 8%` | solid teal `#0D9488` | fuller red |

A +15.2% name (e.g. AMZN on a gap day) must land in the **extreme** band, not the mild tint.

## Bugs

1. **TDOC Material News** — filter RSS/events with `isCompanyRelevantHeadline`; never fall back to unscoped headlines for badges or lists.
2. **AMZN +15.2%** — verify against Yahoo regular vs extended session; prefer `previousClose` / `regularMarketPreviousClose` over a stale `chartPreviousClose` when both exist.

## UX polish

3. Narrative tone tags: **price reaction** (not ambiguous “reaction”).
4. Conviction Score: one calc only — `/api/conviction/score` (`displayScore` / `tone` / `ringLabel`). List surfaces must not fall back to `getCardVerdict` heuristics.
5. **Attention pace** `N×` = last-hour theme mentions ÷ trailing hourly baseline (`(24h − last hour) / 23`, floor 0.5). Expose that baseline in the UI.

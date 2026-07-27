"use client";

import Link from "next/link";
import { useMemo } from "react";
import { getCardVerdict, type CardVerdictShortInterest } from "@/lib/evidence/card-verdict";
import type { WatchlistEntry } from "@/lib/watchlist/types";
import type { StockQuote } from "@/lib/market/types";
import { getLivePrice } from "@/lib/market/live-quote";
import type { WatchlistCardHeadline } from "@/app/components/WatchlistCard";

export interface WatchlistAttentionItem {
  ticker: string;
  companyName: string;
  reason: string;
  action: string;
  priority: number;
  tone: "positive" | "negative" | "contested" | "quiet";
  strengthLabel: string;
  changePercent: number | null;
}

interface WatchlistNeedsAttentionProps {
  entries: WatchlistEntry[];
  quotes: Record<string, StockQuote>;
  shortInterest: Record<string, CardVerdictShortInterest>;
  headlines: Record<string, WatchlistCardHeadline[]>;
}

function buildAttentionItems(
  entries: WatchlistEntry[],
  quotes: Record<string, StockQuote>,
  shortInterest: Record<string, CardVerdictShortInterest>,
  headlines: Record<string, WatchlistCardHeadline[]>,
): WatchlistAttentionItem[] {
  const items: WatchlistAttentionItem[] = [];

  for (const entry of entries) {
    const quote = quotes[entry.ticker];
    const live = quote ? getLivePrice(quote) : null;
    const changePercent = live?.changePercent ?? quote?.changePercent ?? null;
    const verdict = getCardVerdict(entry, quote, shortInterest[entry.ticker]);
    const hasNews = (headlines[entry.ticker]?.length ?? 0) > 0;

    let priority = 0;
    let reason = "";
    let action = "Open company";

    if (verdict.state === "Weak") {
      priority = 1;
      reason = verdict.insight.replace(/\.$/, "") || "Evidence looks soft.";
      action = "Review evidence";
    } else if (changePercent !== null && changePercent <= -5) {
      priority = 2;
      reason = `Down ${Math.abs(changePercent).toFixed(1)}% today.`;
      action = "Check the move";
    } else if (verdict.state === "Mixed" && hasNews) {
      priority = 3;
      const headline = headlines[entry.ticker]?.[0]?.headline;
      reason = headline
        ? headline.length > 90
          ? `${headline.slice(0, 87)}…`
          : headline
        : "Mixed signals with fresh headlines.";
      action = "Read the move";
    } else if (verdict.state === "Mixed") {
      priority = 4;
      reason = verdict.insight.replace(/\.$/, "") || "Signals are mixed.";
      action = "Review evidence";
    }

    if (!priority) continue;

    items.push({
      ticker: entry.ticker,
      companyName: entry.companyName,
      reason,
      action,
      priority,
      tone: verdict.tone,
      strengthLabel: verdict.state,
      changePercent,
    });
  }

  return items
    .sort((a, b) => a.priority - b.priority || a.ticker.localeCompare(b.ticker))
    .slice(0, 4);
}

export function WatchlistNeedsAttention({
  entries,
  quotes,
  shortInterest,
  headlines,
}: WatchlistNeedsAttentionProps) {
  const items = useMemo(
    () => buildAttentionItems(entries, quotes, shortInterest, headlines),
    [entries, quotes, shortInterest, headlines],
  );

  if (entries.length === 0 || items.length === 0) return null;

  return (
    <section className="wl-attention" aria-label="Needs attention">
      <div className="wl-attention-header">
        <div>
          <span className="wl-attention-eyebrow">Needs attention</span>
          <h2 className="wl-attention-title">Start here</h2>
        </div>
        <span className="wl-attention-count">{items.length}</span>
      </div>

      <div className="wl-attention-list">
        {items.map((item) => (
          <Link
            key={item.ticker}
            href={`/companies/${item.ticker}`}
            className={`wl-attention-item wl-attention-p${item.priority}`}
          >
            <div className="wl-attention-top">
              <div className="wl-attention-identity">
                <strong className="wl-attention-ticker">{item.ticker}</strong>
                <span className="wl-attention-name">{item.companyName}</span>
              </div>
              <span className={`wl-attention-badge wl-attention-tone-${item.tone}`}>
                {item.strengthLabel}
              </span>
            </div>
            <p className="wl-attention-reason">{item.reason}</p>
            <div className="wl-attention-meta">
              {item.changePercent !== null && Number.isFinite(item.changePercent) ? (
                <span className={item.changePercent >= 0 ? "up" : "down"}>
                  {item.changePercent >= 0 ? "+" : ""}
                  {item.changePercent.toFixed(1)}%
                </span>
              ) : null}
              <span className="wl-attention-action">{item.action}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { getLivePrice } from "@/lib/market/live-quote";
import type { StockQuote } from "@/lib/market/types";
import type { WatchlistEntry } from "@/lib/watchlist/types";

export interface WatchlistNewsHeadline {
  headline: string;
  url: string | null;
  date: string;
  publisher?: string | null;
}

export interface WatchlistNewsSummary {
  headline: string | null;
  url: string | null;
  date: string | null;
  publisher?: string | null;
  driver: {
    label: string;
    explanation: string;
    confidence: "confirmed" | "reported" | "likely";
  } | null;
  headlines: WatchlistNewsHeadline[];
}

export interface WatchlistTransition {
  id: string;
  ticker: string;
  type: "status_upgrade" | "new_signal_type" | "manager_breadth_increase" | "status_downgrade" | "signal_expired";
  reason: string;
  createdAt: string;
}

export interface WatchlistBriefItem {
  ticker: string;
  companyName: string;
  kind: "Conviction change" | "Large move" | "Fresh evidence";
  tone: "up" | "down" | "watch";
  headline: string;
  why: string;
  watchNext: string;
  changePercent: number | null;
  occurredAt: string | null;
  score: number;
}

const WATCH_NEXT: Record<string, string> = {
  "Strategic options": "Deal terms and board response",
  "Street actions": "Estimate revisions and target changes",
  "Oil sensitivity": "Crude prices and supply disruption",
  "Execution + margins": "Guidance, revenue, and margins",
  "AI positioning": "Customer demand and capital spending",
  "Manufacturing turnaround": "Process milestones and foundry economics",
  "Pipeline renewal": "Trial results, approvals, and patent timing",
  "Regulatory pressure": "Court, agency, and settlement updates",
  "Demand + competition": "Market share and customer demand",
  "Capital allocation": "Debt, cash flow, and shareholder returns",
};

function hoursSince(value: string | null, now: Date): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, now.getTime() - parsed) / 3_600_000;
}

function formatAge(value: string | null): string {
  if (!value) return "Today";
  const hours = hoursSince(value, new Date());
  if (hours === null) return "Today";
  if (hours < 1) return "Just now";
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  if (hours < 48) return "Yesterday";
  return `${Math.floor(hours / 24)}d ago`;
}

function formatMove(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function relevantHeadline(
  entry: WatchlistEntry,
  news: WatchlistNewsSummary | undefined,
): WatchlistNewsHeadline | null {
  if (!news) return null;
  const companyToken = entry.companyName
    .replace(/[^a-z0-9 ]/gi, " ")
    .split(/\s+/)
    .find((token) => token.length >= 4 && !/^(company|corporation|group|holdings)$/i.test(token));
  const tickerPattern = new RegExp(`\\b${entry.ticker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  const companyPattern = companyToken ? new RegExp(`\\b${companyToken}\\b`, "i") : null;

  return news.headlines.find((item) =>
    tickerPattern.test(item.headline) || Boolean(companyPattern?.test(item.headline)),
  ) ?? (news.headline ? {
    headline: news.headline,
    url: news.url,
    date: news.date ?? "",
    publisher: news.publisher,
  } : null);
}

function transitionKind(type: WatchlistTransition["type"]): WatchlistBriefItem["tone"] {
  if (type === "status_downgrade" || type === "signal_expired") return "down";
  if (type === "status_upgrade" || type === "new_signal_type" || type === "manager_breadth_increase") return "up";
  return "watch";
}

export function buildWatchlistBriefItems({
  entries,
  quotes,
  newsByTicker,
  transitions,
  now = new Date(),
}: {
  entries: WatchlistEntry[];
  quotes: Record<string, StockQuote>;
  newsByTicker: Record<string, WatchlistNewsSummary>;
  transitions: WatchlistTransition[];
  now?: Date;
}): WatchlistBriefItem[] {
  const latestTransition = new Map<string, WatchlistTransition>();
  for (const transition of transitions) {
    const ticker = transition.ticker.toUpperCase();
    if (!latestTransition.has(ticker)) latestTransition.set(ticker, transition);
  }

  return entries
    .map((entry): WatchlistBriefItem | null => {
      const ticker = entry.ticker.toUpperCase();
      const quote = quotes[ticker];
      const changePercent = quote
        ? (getLivePrice(quote).changePercent ?? quote.changePercent ?? null)
        : null;
      const absoluteMove = Math.abs(changePercent ?? 0);
      const news = newsByTicker[ticker];
      const headline = relevantHeadline(entry, news);
      const newsAge = hoursSince(headline?.date ?? null, now);
      const transition = latestTransition.get(ticker);
      const transitionAge = hoursSince(transition?.createdAt ?? null, now);
      const freshTransition = transition && transitionAge !== null && transitionAge <= 7 * 24
        ? transition
        : null;
      const freshNews = headline && newsAge !== null && newsAge <= 48 ? headline : null;

      if (freshTransition) {
        return {
          ticker,
          companyName: entry.companyName,
          kind: "Conviction change",
          tone: transitionKind(freshTransition.type),
          headline: freshTransition.reason,
          why: news?.driver?.explanation ?? "The evidence mix changed enough to alter the company’s conviction state.",
          watchNext: news?.driver ? WATCH_NEXT[news.driver.label] ?? "Confirming or contradicting evidence" : "Confirming or contradicting evidence",
          changePercent,
          occurredAt: freshTransition.createdAt,
          score: freshTransition.type === "status_downgrade" || freshTransition.type === "signal_expired" ? 100 : 88,
        };
      }

      if (absoluteMove >= 2) {
        const direction = (changePercent ?? 0) < 0 ? "down" : "up";
        return {
          ticker,
          companyName: entry.companyName,
          kind: "Large move",
          tone: direction,
          headline: freshNews?.headline ?? `${entry.companyName} is ${direction} ${absoluteMove.toFixed(1)}% today.`,
          why: news?.driver?.explanation
            ?? `${ticker} is moving enough to warrant checking whether the underlying thesis changed.`,
          watchNext: news?.driver ? WATCH_NEXT[news.driver.label] ?? "Whether the move holds" : "Whether the move holds—and why",
          changePercent,
          occurredAt: freshNews?.date ?? null,
          score: absoluteMove >= 5 ? 82 + Math.min(12, absoluteMove) : 60 + Math.min(12, absoluteMove),
        };
      }

      if (freshNews && news?.driver) {
        return {
          ticker,
          companyName: entry.companyName,
          kind: "Fresh evidence",
          tone: "watch",
          headline: freshNews.headline,
          why: news.driver.explanation,
          watchNext: WATCH_NEXT[news.driver.label] ?? "Follow-through in the evidence",
          changePercent,
          occurredAt: freshNews.date,
          score: 46 - Math.min(12, newsAge ?? 0) / 4,
        };
      }

      return null;
    })
    .filter((item): item is WatchlistBriefItem => Boolean(item))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

export function WatchlistDailyBrief({
  entries,
  quotes,
  newsByTicker,
  transitions,
  loading,
  sessionLabel,
}: {
  entries: WatchlistEntry[];
  quotes: Record<string, StockQuote>;
  newsByTicker: Record<string, WatchlistNewsSummary>;
  transitions: WatchlistTransition[];
  loading: boolean;
  sessionLabel: string;
}) {
  const items = buildWatchlistBriefItems({ entries, quotes, newsByTicker, transitions });
  const movingCount = Object.values(quotes).filter((quote) => {
    const move = getLivePrice(quote).changePercent ?? quote.changePercent;
    return typeof move === "number" && Math.abs(move) >= 2;
  }).length;
  const freshEvidenceCount = Object.values(newsByTicker).filter((news) => {
    const age = hoursSince(news.date, new Date());
    return age !== null && age <= 48;
  }).length + transitions.filter((transition) => {
    const age = hoursSince(transition.createdAt, new Date());
    return age !== null && age <= 7 * 24;
  }).length;

  const headline = loading
    ? "Reading your companies."
    : items.length === 0
      ? "Nothing urgent. Stay selective."
      : `${items.length} ${items.length === 1 ? "thing deserves" : "things deserve"} a look.`;

  return (
    <>
      <section className="product-stage product-stage--watchlist" aria-label="Daily brief overview">
        <div className="product-stage-copy">
          <span className="product-stage-eyebrow">
            <i aria-hidden="true" /> Daily brief · {sessionLabel}
          </span>
          <h1>{headline}</h1>
          <p>
            Ranked from conviction shifts, meaningful price moves, and fresh company evidence—not headline volume.
          </p>
        </div>
        <div className="product-stage-metrics" aria-label="Daily brief summary">
          <div>
            <strong>{loading ? "—" : entries.length}</strong>
            <span>Reviewed</span>
          </div>
          <div className={movingCount > 0 ? "is-alert" : ""}>
            <strong>{loading ? "—" : movingCount}</strong>
            <span>Moving 2%+</span>
          </div>
          <div>
            <strong>{loading ? "—" : freshEvidenceCount}</strong>
            <span>Fresh evidence</span>
          </div>
        </div>
      </section>

      {entries.length > 0 ? (
        <section className={`daily-brief${items.length === 0 && !loading ? " is-clear" : ""}`} aria-label="Today’s watchlist brief">
          <header className="daily-brief-header">
            <div>
              <span>Today’s brief</span>
              <h2>{loading ? "Finding what changed" : items.length > 0 ? "What deserves attention" : "Your list is quiet"}</h2>
            </div>
            <p>{entries.length} {entries.length === 1 ? "company" : "companies"} checked</p>
          </header>

          {loading ? (
            <div className="daily-brief-loading" aria-live="polite">Reading prices, evidence, and conviction changes…</div>
          ) : items.length > 0 ? (
            <div className={`daily-brief-grid item-count-${items.length}`}>
              {items.map((item, index) => (
                <Link
                  href={`/companies/${encodeURIComponent(item.ticker)}`}
                  key={`${item.ticker}-${item.kind}`}
                  className={`daily-brief-card tone-${item.tone}${index === 0 ? " is-lead" : ""}`}
                >
                  <div className="daily-brief-card-top">
                    <span className="daily-brief-kind">{item.kind}</span>
                    <span className={`daily-brief-move${item.changePercent !== null && item.changePercent < 0 ? " is-down" : ""}`}>
                      {formatMove(item.changePercent)}
                    </span>
                  </div>
                  <div className="daily-brief-company">
                    <strong>{item.ticker}</strong>
                    <span>{item.companyName}</span>
                  </div>
                  <h3>{item.headline}</h3>
                  <p>{item.why}</p>
                  <footer>
                    <span>
                      <b>Watch next</b>
                      {item.watchNext}
                    </span>
                    <time>{formatAge(item.occurredAt)}</time>
                    <em>Open brief →</em>
                  </footer>
                </Link>
              ))}
            </div>
          ) : (
            <div className="daily-brief-clear">
              <span aria-hidden="true">✓</span>
              <div>
                <strong>No material changes found.</strong>
                <p>Prices are within normal ranges and no fresh evidence requires a thesis review.</p>
              </div>
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}

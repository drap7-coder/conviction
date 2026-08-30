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
  scope: "Portfolio" | "Watchlist" | "Both";
  proofStatus: "Evidence-backed" | "Price only";
  convictionEffect: "Strengthened" | "Weakened" | "Unconfirmed";
  sourceLabel: string;
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

function transitionEffect(type: WatchlistTransition["type"]): WatchlistBriefItem["convictionEffect"] {
  return type === "status_downgrade" || type === "signal_expired" ? "Weakened" : "Strengthened";
}

export function buildWatchlistBriefItems({
  entries,
  quotes,
  newsByTicker,
  transitions,
  portfolioTickers = [],
  watchlistTickers,
  now = new Date(),
}: {
  entries: WatchlistEntry[];
  quotes: Record<string, StockQuote>;
  newsByTicker: Record<string, WatchlistNewsSummary>;
  transitions: WatchlistTransition[];
  portfolioTickers?: string[];
  watchlistTickers?: string[];
  now?: Date;
}): WatchlistBriefItem[] {
  const portfolioSet = new Set(portfolioTickers.map((ticker) => ticker.toUpperCase()));
  const watchlistSet = new Set(
    (watchlistTickers ?? entries.map((entry) => entry.ticker)).map((ticker) => ticker.toUpperCase()),
  );
  const latestTransition = new Map<string, WatchlistTransition>();
  for (const transition of transitions) {
    const ticker = transition.ticker.toUpperCase();
    if (!latestTransition.has(ticker)) latestTransition.set(ticker, transition);
  }

  return entries
    .map((entry): WatchlistBriefItem | null => {
      const ticker = entry.ticker.toUpperCase();
      const quote = quotes[ticker];
      const companyName = entry.companyName === ticker
        ? (quote?.name ?? entry.companyName)
        : entry.companyName;
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
      const inPortfolio = portfolioSet.has(ticker);
      const inWatchlist = watchlistSet.has(ticker);
      const scope: WatchlistBriefItem["scope"] = inPortfolio && inWatchlist
        ? "Both"
        : inPortfolio
          ? "Portfolio"
          : "Watchlist";
      const priorityBonus = inPortfolio ? 12 : 0;

      if (freshTransition) {
        return {
          ticker,
          companyName,
          kind: "Conviction change",
          tone: transitionKind(freshTransition.type),
          scope,
          proofStatus: "Evidence-backed",
          convictionEffect: transitionEffect(freshTransition.type),
          sourceLabel: "IQBulls signal history",
          headline: freshTransition.reason,
          why: news?.driver?.explanation ?? "The evidence mix changed enough to alter the company’s conviction state.",
          watchNext: news?.driver ? WATCH_NEXT[news.driver.label] ?? "Confirming or contradicting evidence" : "Confirming or contradicting evidence",
          changePercent,
          occurredAt: freshTransition.createdAt,
          score: (freshTransition.type === "status_downgrade" || freshTransition.type === "signal_expired" ? 100 : 88) + priorityBonus,
        };
      }

      if (absoluteMove >= 2) {
        const direction = (changePercent ?? 0) < 0 ? "down" : "up";
        return {
          ticker,
          companyName,
          kind: "Large move",
          tone: direction,
          scope,
          proofStatus: news?.driver && freshNews ? "Evidence-backed" : "Price only",
          convictionEffect: "Unconfirmed",
          sourceLabel: news?.driver && freshNews
            ? (freshNews.publisher ?? news.publisher ?? "Company news + live price")
            : "Live market price",
          headline: freshNews?.headline ?? `${companyName} is ${direction} ${absoluteMove.toFixed(1)}% today.`,
          why: news?.driver?.explanation
            ?? "The move is large enough to investigate, but price alone does not prove the thesis changed.",
          watchNext: news?.driver
            ? WATCH_NEXT[news.driver.label] ?? "Confirming or contradicting evidence"
            : "A company-specific catalyst, estimate revision, or filing that explains the move",
          changePercent,
          occurredAt: freshNews?.date ?? null,
          score: (absoluteMove >= 5 ? 82 + Math.min(12, absoluteMove) : 60 + Math.min(12, absoluteMove)) + priorityBonus,
        };
      }

      if (freshNews && news?.driver) {
        return {
          ticker,
          companyName,
          kind: "Fresh evidence",
          tone: "watch",
          scope,
          proofStatus: "Evidence-backed",
          convictionEffect: "Unconfirmed",
          sourceLabel: freshNews.publisher ?? news.publisher ?? "Company news",
          headline: freshNews.headline,
          why: news.driver.explanation,
          watchNext: WATCH_NEXT[news.driver.label] ?? "Follow-through in the evidence",
          changePercent,
          occurredAt: freshNews.date,
          score: 46 - Math.min(12, newsAge ?? 0) / 4 + priorityBonus,
        };
      }

      return null;
    })
    .filter((item): item is WatchlistBriefItem => Boolean(item))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

export function WatchlistDailyBrief({
  entries,
  quotes,
  newsByTicker,
  transitions,
  loading,
  portfolioTickers = [],
  watchlistTickers,
  section = "all",
}: {
  entries: WatchlistEntry[];
  quotes: Record<string, StockQuote>;
  newsByTicker: Record<string, WatchlistNewsSummary>;
  transitions: WatchlistTransition[];
  loading: boolean;
  sessionLabel?: string;
  portfolioTickers?: string[];
  watchlistTickers?: string[];
  section?: "all" | "lead" | "rest" | "list";
}) {
  const items = buildWatchlistBriefItems({
    entries,
    quotes,
    newsByTicker,
    transitions,
    portfolioTickers,
    watchlistTickers,
  });

  // Same desktop composition as News Brief: one featured lead + up to two beside it.
  const board = items.slice(0, 3);
  const lead = items[0] ? [items[0]] : [];
  const rest = items.slice(1);
  const visibleBoard = section === "lead"
    ? lead
    : section === "rest"
      ? []
      : board;
  const visibleMore = section === "lead"
    ? []
    : section === "rest"
      ? rest
      : items.slice(3);
  const isLeadSection = section === "lead";
  const showLoading = loading && section !== "rest";

  function renderCard(item: WatchlistBriefItem, index: number, featured = false, total = 0) {
    const rankLabel = total > 0
      ? `${String(index + 1).padStart(2, "0")}/${String(total).padStart(2, "0")}`
      : String(index + 1).padStart(2, "0");
    return (
      <Link
        href={`/companies/${encodeURIComponent(item.ticker)}`}
        key={`${item.ticker}-${item.kind}`}
        className={[
          "for-you-feed-card",
          `tone-${item.tone}`,
          featured ? "is-lead" : "",
          index === 2 ? "is-alt" : "",
        ].filter(Boolean).join(" ")}
        aria-label={`Open ${item.ticker} company brief`}
      >
        <div className="for-you-feed-card-top">
          <div className="for-you-feed-tags">
            <span className="for-you-feed-kind">{item.kind}</span>
            <span className="for-you-feed-rank" aria-label={`Item ${index + 1}${total > 0 ? ` of ${total}` : ""}`}>{rankLabel}</span>
          </div>
          <span className={`for-you-feed-move${item.changePercent !== null && item.changePercent < 0 ? " is-down" : ""}`}>
            {formatMove(item.changePercent)}
          </span>
        </div>
        <div className="for-you-feed-company">
          <strong>{item.ticker}</strong>
          <span>{item.companyName}</span>
        </div>
        <h3>{item.headline}</h3>
        <div className="for-you-feed-reason">
          <span>Why it matters</span>
          <p>{item.why}</p>
        </div>
        <div className="for-you-feed-next">
          <span>Next proof point</span>
          <p>{item.watchNext}</p>
        </div>
        <footer>
          <div>
            <span className={`for-you-feed-proof${item.proofStatus === "Price only" ? " is-price-only" : ""}`}>
              {item.proofStatus}
            </span>
            <span>{item.sourceLabel}</span>
          </div>
          <div>
            <time>{formatAge(item.occurredAt)}</time>
          </div>
          <em>Open company brief <span aria-hidden="true">→</span></em>
        </footer>
      </Link>
    );
  }

  if (section === "list") {
    if (entries.length === 0) return null;
    return (
      <section className="for-you-feed for-you-feed--list" aria-label="Fresh evidence on your watchlist">
        <div className="wl-evidence-header">
          <span className="wl-evidence-eyebrow">Evidence</span>
          <strong className="wl-evidence-title">Fresh on your watchlist</strong>
        </div>
        {loading && items.length === 0 ? (
          <div className="for-you-feed-loading for-you-feed-loading--skeleton" aria-hidden="true">
            <span className="for-you-feed-skeleton-block for-you-feed-skeleton-pill" />
            <span className="for-you-feed-skeleton-block for-you-feed-skeleton-title" />
            <span className="for-you-feed-skeleton-block for-you-feed-skeleton-line" />
            <span className="for-you-feed-skeleton-block for-you-feed-skeleton-line for-you-feed-skeleton-line--short" />
          </div>
        ) : items.length > 0 ? (
          <div className="for-you-feed-more" aria-label="Watchlist evidence">
            {items.map((item, index) => renderCard(item, index, false, items.length))}
          </div>
        ) : (
          <div className="for-you-feed-clear">
            <span aria-hidden="true">✓</span>
            <div>
              <strong>Nothing material needs a look.</strong>
              <p>Your book is quiet — nothing to chase.</p>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      className={`for-you-feed${items.length === 0 && !loading ? " is-clear" : ""}`}
      aria-label="Worth your attention"
    >
      {entries.length === 0 ? (
        <div className="for-you-feed-clear">
          <div>
            <strong>Nothing to brief yet.</strong>
            <p>Insights appear here when something material moves on Moves.</p>
          </div>
        </div>
      ) : showLoading ? (
        <div className="for-you-feed-loading for-you-feed-loading--skeleton" aria-hidden="true">
          <span className="for-you-feed-skeleton-block for-you-feed-skeleton-pill" />
          <span className="for-you-feed-skeleton-block for-you-feed-skeleton-title" />
          <span className="for-you-feed-skeleton-block for-you-feed-skeleton-line" />
          <span className="for-you-feed-skeleton-block for-you-feed-skeleton-line for-you-feed-skeleton-line--short" />
        </div>
      ) : (visibleBoard.length > 0 || visibleMore.length > 0) ? (
        <>
          {visibleBoard.length > 0 ? (
            <div
              className={`for-you-feed-board item-count-${visibleBoard.length}`}
              aria-label={isLeadSection ? "Top watchlist headline" : "Top watchlist stories"}
            >
              {visibleBoard.map((item, index) => renderCard(item, index, true))}
            </div>
          ) : null}

          {visibleMore.length > 0 ? (
            <div className="for-you-feed-more" aria-label="More watchlist stories">
              {visibleMore.map((item, index) => renderCard(item, index + 1))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="for-you-feed-clear">
          <span aria-hidden="true">✓</span>
          <div>
            <strong>Nothing material needs a look.</strong>
            <p>Your book is quiet — nothing to chase.</p>
          </div>
        </div>
      )}
    </section>
  );
}

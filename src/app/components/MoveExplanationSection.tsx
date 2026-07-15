"use client";

import { useEffect, useState } from "react";
import type { MoveEvent } from "@/lib/evidence/move-events";
import type { EvidenceEvent } from "@/lib/evidence/types";
import type { PoliticalTradeSummary } from "@/lib/political-trades";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";
import { getPeerTickers } from "@/lib/market/peers";

interface MoveExplanationSectionProps {
  ticker: string;
}

interface InstitutionalResponse {
  results: InstitutionalAccumulation[];
}

interface InsiderResponse {
  events: EvidenceEvent[];
}

type PoliticalResponse = PoliticalTradeSummary;

interface StockQuote {
  ticker: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
}

function confidenceLabel(confidence: MoveEvent["confidence"]) {
  if (confidence === "high") return "High confidence";
  if (confidence === "medium") return "Medium confidence";
  return "Low confidence";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatShares(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function describeStatus(row: InstitutionalAccumulation) {
  if (row.status === "New") return "opened";
  if (row.status === "Increased") return "increased";
  if (row.status === "Reduced") return "reduced";
  if (row.status === "Exited") return "exited";
  return "held";
}

function summarizeInstitutional(rows: InstitutionalAccumulation[], ticker: string) {
  const activeRows = rows.filter((row) => row.status !== "Unchanged");
  const positiveRows = activeRows.filter((row) => row.status === "New" || row.status === "Increased");
  const negativeRows = activeRows.filter((row) => row.status === "Reduced" || row.status === "Exited");
  const lead = positiveRows[0] ?? negativeRows[0] ?? activeRows[0];
  const latestFilingDate = activeRows
    .map((row) => row.filingDate)
    .sort((a, b) => b.localeCompare(a))[0];

  if (!activeRows.length) {
    return {
      activeRows,
      lead,
      latestFilingDate: latestFilingDate ?? null,
      label: "No tracked 13F change found",
      text: "No activity found among the 15 tracked institutional managers.",
      tone: "neutral",
    };
  }

  const label = positiveRows.length >= negativeRows.length
    ? "Supporting 13F signal"
    : "Contradicting 13F signal";
  const text = lead
    ? `${lead.displayName} ${describeStatus(lead)} ${ticker}: ${formatShares(Math.abs(lead.shareChange))} share${Math.abs(lead.shareChange) === 1 ? "" : "s"} changed${latestFilingDate ? `, filed ${latestFilingDate}` : ""}.`
    : `${activeRows.length} tracked-manager changes${latestFilingDate ? `, latest filed ${latestFilingDate}` : ""}.`;

  return {
    activeRows,
    lead,
    latestFilingDate: latestFilingDate ?? null,
    label,
    text,
    tone: positiveRows.length >= negativeRows.length ? "positive" : "negative",
  };
}

function daysSince(value: string) {
  const then = new Date(`${value}T12:00:00`).getTime();
  if (!Number.isFinite(then)) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000));
}

function formatMoney(value: number | null | undefined) {
  if (!value) return null;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${(value / 1_000).toFixed(0)}K`;
}

function summarizeInsiders(events: EvidenceEvent[]) {
  const recentEvents = events.filter((event) => daysSince(event.date) <= 90);
  const purchases = recentEvents.filter((event) => event.metadata?.transactionType === "purchase");
  const sales = recentEvents.filter((event) => event.metadata?.transactionType === "sale");
  const leadPurchase = purchases[0] ?? null;
  const leadSale = sales[0] ?? null;

  return {
    purchases,
    sales,
    leadPurchase,
    leadSale,
  };
}

export function MoveExplanationSection({ ticker }: MoveExplanationSectionProps) {
  const [event, setEvent] = useState<MoveEvent | null>(null);
  const [institutionalRows, setInstitutionalRows] = useState<InstitutionalAccumulation[]>([]);
  const [insiderEvents, setInsiderEvents] = useState<EvidenceEvent[]>([]);
  const [politicalSummary, setPoliticalSummary] = useState<PoliticalResponse | null>(null);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const peerTickers = getPeerTickers(ticker);
        const quoteTickers = [ticker, ...peerTickers].join(",");
        const [moveResponse, institutionalResponse, insiderResponse, politicalResponse, quotesResponse] = await Promise.all([
          fetch(`/api/evidence/move?ticker=${ticker}`),
          fetch(`/api/evidence/institutional?ticker=${ticker}`),
          fetch(`/api/evidence/insider?ticker=${ticker}`),
          fetch(`/api/evidence/political?ticker=${ticker}`),
          fetch(`/api/market/quotes?tickers=${encodeURIComponent(quoteTickers)}`),
        ]);
        if (!moveResponse.ok) throw new Error("Failed to load move evidence");

        const moveData = (await moveResponse.json()) as MoveEvent;
        const institutionalData = institutionalResponse.ok
          ? ((await institutionalResponse.json()) as InstitutionalResponse)
          : { results: [] };
        const insiderData = insiderResponse.ok
          ? ((await insiderResponse.json()) as InsiderResponse)
          : { events: [] };
        const politicalData = politicalResponse.ok
          ? ((await politicalResponse.json()) as PoliticalResponse)
          : null;
        const quoteData = quotesResponse.ok
          ? ((await quotesResponse.json()) as { quotes?: StockQuote[] })
          : { quotes: [] };

        if (!cancelled) {
          const quoteMap: Record<string, StockQuote> = {};
          for (const quote of quoteData.quotes ?? []) quoteMap[quote.ticker] = quote;
          setEvent(moveData);
          setInstitutionalRows(institutionalData.results ?? []);
          setInsiderEvents(insiderData.events ?? []);
          setPoliticalSummary(politicalData);
          setQuotes(quoteMap);
        }
      } catch {
        if (!cancelled) setError("Move explanation unavailable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const isFallback = event?.category === "no-clear-catalyst";
  const institutional = summarizeInstitutional(institutionalRows, ticker);
  const insider = summarizeInsiders(insiderEvents);
  const institutionalPositive = institutional.activeRows.some((row) => row.status === "New" || row.status === "Increased");
  const hasRecentInsiderBuy = insider.purchases.length > 0;
  const politicalPurchase = politicalSummary?.purchases[0] ?? null;
  const politicalSale = politicalSummary?.sales[0] ?? null;
  const hasPoliticalPurchase = Boolean(politicalPurchase);
  const hasInsiderOffset = insider.sales.length > 0;
  const hasPoliticalOffset = Boolean(politicalSale);
  const hasCounterSignal = hasInsiderOffset || hasPoliticalOffset;
  const positiveSignalCount = [institutionalPositive, hasRecentInsiderBuy, hasPoliticalPurchase].filter(Boolean).length;
  const convergence = institutionalPositive && hasRecentInsiderBuy && hasPoliticalPurchase
    ? {
        level: "broad",
        label: "Broad conviction",
        detail: "Institutional accumulation + insider buying + political purchase",
        tone: "positive",
      }
    : institutionalPositive && positiveSignalCount >= 2
    ? {
        level: "multi",
        label: "Multi-signal conviction",
        detail: `Institutional accumulation + ${hasRecentInsiderBuy ? "insider buying" : "political purchase"}`,
        tone: "positive",
      }
    : institutionalPositive
      ? {
          level: "institutional",
          label: "Institutional conviction",
          detail: "Strong long-term positioning",
          tone: "positive",
        }
      : {
          level: "none",
          label: "No active conviction",
          detail: "No recent institutional, insider, or political conviction signal",
          tone: "neutral",
        };
  const quote = quotes[ticker];
  const peerQuotes = getPeerTickers(ticker)
    .map((peerTicker) => quotes[peerTicker])
    .filter((peerQuote): peerQuote is StockQuote => !!peerQuote);

  return (
    <section className="move-section">
      <div className="section-header mt-16">
        <h2 className="section-title">Why moved?</h2>
        <span className="section-count">Price + 13F</span>
      </div>

      {loading ? (
        <div className="move-card loading">
          <span className="move-eyebrow">Checking catalyst evidence...</span>
          <h3>Looking for a sourced explanation.</h3>
        </div>
      ) : error ? (
        <div className="move-card">
          <h3>{error}</h3>
          <p className="move-answer">No sourced move explanation is available right now.</p>
        </div>
      ) : event ? (
        <div className={`move-card convergence-card convergence-${convergence.level} confidence-${event.confidence}`}>
          <div className="move-card-top">
            <div>
              <span className="move-eyebrow">{formatDate(event.date)}</span>
              <h3>{convergence.label}</h3>
              <p className="convergence-detail">{convergence.detail}</p>
            </div>
            <span className={`move-confidence convergence-badge ${convergence.tone}`}>
              {convergence.level === "multi" ? "Aligned signals" : convergence.level === "institutional" ? "13F signal" : "No alignment"}
            </span>
          </div>

          <div className="convergence-signal-grid" aria-label="Conviction signals">
            <div className={institutionalPositive ? "signal-tile positive" : "signal-tile neutral"}>
              <span className="move-eyebrow">Institutional</span>
              <strong>{institutionalPositive ? "Accumulating" : "No accumulation"}</strong>
              <p>{institutional.text}</p>
            </div>
            <div className={hasRecentInsiderBuy ? "signal-tile positive" : "signal-tile neutral"}>
              <span className="move-eyebrow">Insider</span>
              <strong>{hasRecentInsiderBuy ? "Open-market buying" : "No recent open-market buy"}</strong>
              <p>
                {insider.leadPurchase
                  ? `${insider.leadPurchase.metadata?.insiderName ?? "Insider"} bought ${insider.leadPurchase.metadata?.shares?.toLocaleString() ?? "shares"}${formatMoney(insider.leadPurchase.metadata?.totalValue) ? ` / ${formatMoney(insider.leadPurchase.metadata?.totalValue)}` : ""}.`
                  : "Grants, tax withholding, and option exercises do not count as conviction."}
              </p>
            </div>
            <div className={hasPoliticalPurchase ? "signal-tile positive" : "signal-tile neutral"}>
              <span className="move-eyebrow">Political</span>
              <strong>{hasPoliticalPurchase ? "Disclosed purchase" : "No political purchase"}</strong>
              <p>
                {politicalPurchase
                  ? `${politicalPurchase.filerName} reported a ${politicalPurchase.amountRange} purchase, filed ${formatDate(politicalPurchase.filingDate)}.`
                  : "Political sales and exchanges do not count as positive conviction."}
              </p>
            </div>
            {hasCounterSignal ? (
              <div className="signal-tile offset">
                <span className="move-eyebrow">Signal offset</span>
                <strong>{hasInsiderOffset && hasPoliticalOffset ? "Selling present" : hasInsiderOffset ? "Insider selling present" : "Political sale present"}</strong>
                <p>
                  {insider.leadSale
                    ? `${insider.leadSale.metadata?.insiderName ?? "Insider"} sold ${insider.leadSale.metadata?.shares?.toLocaleString() ?? "shares"}${formatMoney(insider.leadSale.metadata?.totalValue) ? ` / ${formatMoney(insider.leadSale.metadata?.totalValue)}` : ""}.`
                    : politicalSale
                      ? `${politicalSale.filerName} reported a ${politicalSale.amountRange} sale, filed ${formatDate(politicalSale.filingDate)}.`
                    : `${insider.sales.length} open-market sale${insider.sales.length === 1 ? "" : "s"} in the last 90 days.`}
                </p>
              </div>
            ) : null}
          </div>

          {isFallback ? (
            <div className="move-fallback-grid">
              <div>
                <span className="move-eyebrow">Today</span>
                <strong>{ticker} {formatPercent(quote?.changePercent)}</strong>
                <p>
                  {hasRecentInsiderBuy
                    ? "No sourced same-day catalyst found. Recent insider buying is the strongest current signal."
                    : "No sourced same-day catalyst is loaded for this move."}
                </p>
              </div>
              <div>
                <span className="move-eyebrow">Peers</span>
                <strong>
                  {peerQuotes.length
                    ? peerQuotes.map((peerQuote) => `${peerQuote.ticker} ${formatPercent(peerQuote.changePercent)}`).join(" · ")
                    : "Peer quotes unavailable"}
                </strong>
                <p>Use this to separate company-specific moves from group pressure.</p>
              </div>
              <div>
                <span className="move-eyebrow">Latest 13F</span>
                <strong>{institutional.latestFilingDate ?? "No recent tracked filing"}</strong>
                <p>{institutional.text}</p>
              </div>
            </div>
          ) : (
            <>
              <p className="move-answer">{event.answer}</p>
              <span className="move-confidence move-confidence-inline">
                Catalyst: {confidenceLabel(event.confidence)}
              </span>
            </>
          )}

          {!isFallback && event.marketMove ? (
            <p className="move-market">{event.marketMove}</p>
          ) : null}

          {!isFallback && event.details.length > 0 ? (
          <ul className="move-details">
            {event.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
          ) : null}

          <div className={`move-institutional-support ${institutional.tone}`}>
            <div>
              <span className="move-eyebrow">{institutional.label}</span>
              <strong>{institutional.text}</strong>
            </div>
            <div className="move-support-metrics">
              <span>{institutional.activeRows.length} changes</span>
              <span>{institutional.latestFilingDate ?? "No filing date"}</span>
            </div>
          </div>

          {event.sources.length > 0 ? (
            <div className="move-headlines" aria-label="Evidence headlines">
              {event.sources.slice(0, 3).map((source) => (
                <a
                  className="move-headline-card"
                  href={source.url}
                  key={source.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span>{source.label}</span>
                  <strong>{source.headline}</strong>
                </a>
              ))}
            </div>
          ) : null}

          <details className="move-hint">
            <summary>Conviction check</summary>
            <p>{event.convictionQuestion}</p>
          </details>
        </div>
      ) : null}
    </section>
  );
}

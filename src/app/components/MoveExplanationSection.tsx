"use client";

import { useEffect, useState } from "react";
import type { MoveEvent } from "@/lib/evidence/move-events";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";
import { getPeerTickers } from "@/lib/market/peers";

interface MoveExplanationSectionProps {
  ticker: string;
}

interface InstitutionalResponse {
  results: InstitutionalAccumulation[];
}

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

export function MoveExplanationSection({ ticker }: MoveExplanationSectionProps) {
  const [event, setEvent] = useState<MoveEvent | null>(null);
  const [institutionalRows, setInstitutionalRows] = useState<InstitutionalAccumulation[]>([]);
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
        const [moveResponse, institutionalResponse, quotesResponse] = await Promise.all([
          fetch(`/api/evidence/move?ticker=${ticker}`),
          fetch(`/api/evidence/institutional?ticker=${ticker}`),
          fetch(`/api/market/quotes?tickers=${encodeURIComponent(quoteTickers)}`),
        ]);
        if (!moveResponse.ok) throw new Error("Failed to load move evidence");

        const moveData = (await moveResponse.json()) as MoveEvent;
        const institutionalData = institutionalResponse.ok
          ? ((await institutionalResponse.json()) as InstitutionalResponse)
          : { results: [] };
        const quoteData = quotesResponse.ok
          ? ((await quotesResponse.json()) as { quotes?: StockQuote[] })
          : { quotes: [] };

        if (!cancelled) {
          const quoteMap: Record<string, StockQuote> = {};
          for (const quote of quoteData.quotes ?? []) quoteMap[quote.ticker] = quote;
          setEvent(moveData);
          setInstitutionalRows(institutionalData.results ?? []);
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
        <div className={`move-card confidence-${event.confidence}`}>
          <div className="move-card-top">
            <div>
              <span className="move-eyebrow">{formatDate(event.date)}</span>
              <h3>{event.headline}</h3>
            </div>
            <span className="move-confidence">
              {confidenceLabel(event.confidence)}
            </span>
          </div>

          {isFallback ? (
            <div className="move-fallback-grid">
              <div>
                <span className="move-eyebrow">Today</span>
                <strong>{ticker} {formatPercent(quote?.changePercent)}</strong>
                <p>No sourced same-day catalyst is loaded for this move.</p>
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
            <p className="move-answer">{event.answer}</p>
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

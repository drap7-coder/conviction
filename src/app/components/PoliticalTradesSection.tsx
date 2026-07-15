"use client";

import { useEffect, useMemo, useState } from "react";
import type { PoliticalTrade, PoliticalTradeSummary } from "@/lib/political-trades";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "./evidence-request";

interface PoliticalTradesSectionProps {
  ticker: string;
}

function formatAmount(value: number | null) {
  if (value === null) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${(value / 1_000).toFixed(0)}K`;
}

function formatDate(value: string) {
  if (!value) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function tradeVerb(trade: PoliticalTrade) {
  if (trade.direction === "purchase") return "bought";
  if (trade.direction === "sale") return "sold";
  if (trade.direction === "exchange") return "exchanged";
  return "reported";
}

export function PoliticalTradesSection({ ticker }: PoliticalTradesSectionProps) {
  const [summary, setSummary] = useState<PoliticalTradeSummary | null>(null);
  const [status, setStatus] = useState<EvidenceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setStatus("loading");
      setError(null);
      try {
        const data = await fetchJsonWithTimeout<PoliticalTradeSummary>(
          `/api/evidence/political?ticker=${ticker}`,
          10_000,
          controller.signal,
        );
        if (!cancelled) {
          setSummary(data);
          setStatus(data.trades.length > 0 ? "success" : "empty");
        }
      } catch (caught) {
        if (!cancelled) {
          const nextStatus = classifyClientError(caught);
          setStatus(nextStatus === "idle" ? "error" : nextStatus);
          setError(nextStatus === "timeout"
            ? "Political disclosure data is temporarily unavailable."
            : nextStatus === "unsupported"
              ? "This issuer is not currently supported."
              : "Political trade data could not be loaded.");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker, requestKey]);

  const leadTrade = useMemo(() => {
    if (!summary) return null;
    return summary.purchases[0] ?? summary.trades[0] ?? null;
  }, [summary]);

  return (
    <section className="political-section">
      <div className="section-header mt-16">
        <h2 className="section-title">Political trading</h2>
        <span className="section-count">STOCK Act</span>
      </div>

      {status === "loading" || status === "idle" ? (
        <div className="political-card loading">
          <span className="move-eyebrow">Checking disclosures...</span>
          <h3>Looking for reported political trades.</h3>
        </div>
      ) : error ? (
        <div className="political-card">
          <h3>{error}</h3>
          <p>Congressional disclosures are delayed and source availability can vary.</p>
          <button className="retry-button" type="button" onClick={() => setRequestKey((key) => key + 1)}>
            Retry
          </button>
        </div>
      ) : !summary || summary.trades.length === 0 ? (
        <div className="political-card">
          <span className="move-eyebrow">Public disclosures</span>
          <h3>No recent political trade match found</h3>
          <p>No matching ticker was found in the open congressional-trade feed currently loaded.</p>
        </div>
      ) : (
        <div className="political-card">
          <div className="move-card-top">
            <div>
              <span className="move-eyebrow">Open congressional-trade feed</span>
              <h3>
                {summary.purchases.length > 0
                  ? `${summary.purchases.length} disclosed purchase${summary.purchases.length === 1 ? "" : "s"}`
                  : `${summary.trades.length} disclosed trade${summary.trades.length === 1 ? "" : "s"}`}
              </h3>
            </div>
            <span className="move-confidence">
              {summary.latestFilingDate ? `Filed ${formatDate(summary.latestFilingDate)}` : "Filing date unavailable"}
            </span>
          </div>

          {leadTrade ? (
            <p className="political-lead">
              {leadTrade.filerName} {tradeVerb(leadTrade)} {ticker} in a reported{" "}
              {leadTrade.amountRange} range.
            </p>
          ) : null}

          <div className="political-facts">
            <div>
              <strong>{summary.purchases.length}</strong>
              <span>purchases</span>
            </div>
            <div>
              <strong>{summary.sales.length}</strong>
              <span>sales</span>
            </div>
            <div>
              <strong>{formatAmount(summary.totalEstimatedPurchases)}</strong>
              <span>est. buys</span>
            </div>
          </div>

          <div className="political-trade-list">
            {summary.trades.slice(0, 6).map((trade) => (
              <a
                className={`political-trade-row ${trade.direction}`}
                href={trade.sourceUrl}
                key={trade.id}
                rel="noreferrer"
                target="_blank"
              >
                <div>
                  <strong>{trade.filerName}</strong>
                  <span>{trade.office} · {trade.party ?? "—"}{trade.state ? `-${trade.state}` : ""}</span>
                </div>
                <div>
                  <strong>{trade.transactionType}</strong>
                  <span>{trade.amountRange} · filed {formatDate(trade.filingDate)}</span>
                </div>
              </a>
            ))}
          </div>

          <p className="political-note">
            Disclosures can lag trades by up to 45 days and amount values are reported as ranges.
            Source: Kadoa open data normalized from public STOCK Act disclosures.
          </p>
        </div>
      )}
    </section>
  );
}

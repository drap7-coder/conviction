"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "@/app/components/evidence-request";
import type { PoliticalTrade } from "@/lib/political-trades";

function formatDate(value: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function directionClass(direction: PoliticalTrade["direction"]): string {
  // Purchases stay default ink; sales use red so color marks risk, not symmetry.
  if (direction === "sale") return "negative";
  return "neutral";
}

export function PoliticiansMovesPanel() {
  const [trades, setTrades] = useState<PoliticalTrade[]>([]);
  const [status, setStatus] = useState<EvidenceStatus>("idle");
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setStatus("loading");
      try {
        const data = await fetchJsonWithTimeout<{ trades?: PoliticalTrade[] }>(
          "/api/evidence/political/recent?limit=48",
          10_000,
          controller.signal,
        );
        if (cancelled) return;
        const next = data.trades ?? [];
        setTrades(next);
        setStatus(next.length > 0 ? "success" : "empty");
      } catch (err) {
        if (!cancelled) setStatus(classifyClientError(err));
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [requestKey]);

  if (status === "loading" || status === "idle") {
    return <PageLoadingMotion label="Loading congressional disclosures" />;
  }

  if (status !== "success" || trades.length === 0) {
    return (
      <div className="empty-state">
        <p>Congressional disclosures are unavailable right now.</p>
        <small>STOCK Act filings will appear here when the source responds.</small>
        <button className="retry-button mt-8" type="button" onClick={() => setRequestKey((key) => key + 1)}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <section className="smart-money-politicians" aria-label="Political trades">
      <div className="wl-list-header">
        <div className="wl-list-title-row">
          <h3 className="wl-list-title">Politicians</h3>
          <span className="wl-list-count">
            {trades.length} disclosure{trades.length === 1 ? "" : "s"}
          </span>
        </div>
        <p className="smart-money-lede">
          STOCK Act filings ranked by filing freshness. Open a company for the full evidence panel.
        </p>
      </div>

      <div className="politician-trade-list">
        {trades.map((trade) => (
          <article key={trade.id} className="politician-trade-card">
            <div className="politician-trade-top">
              <Link href={`/companies/${trade.ticker}`} className="politician-trade-ticker">
                {trade.ticker}
              </Link>
              <span className={`politician-trade-dir ${directionClass(trade.direction)}`}>
                {trade.transactionType}
              </span>
            </div>
            <div className="politician-trade-meta">
              <strong>{trade.filerName}</strong>
              <span>{trade.office}</span>
              {trade.party ? <span>{trade.party}</span> : null}
              {trade.state ? <span>{trade.state}</span> : null}
            </div>
            <div className="politician-trade-amounts">
              <span>{trade.amountRange}</span>
              <span>Filed {formatDate(trade.filingDate)}</span>
              {trade.transactionDate ? <span>Traded {formatDate(trade.transactionDate)}</span> : null}
              {trade.isLate ? <span className="politician-trade-late">Late filing</span> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

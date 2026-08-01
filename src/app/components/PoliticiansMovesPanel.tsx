"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

  const summary = useMemo(() => {
    const filers = new Set<string>();
    let purchases = 0;
    let sales = 0;
    let late = 0;
    for (const trade of trades) {
      if (trade.filerName) filers.add(trade.filerName);
      if (trade.direction === "purchase") purchases += 1;
      if (trade.direction === "sale") sales += 1;
      if (trade.isLate) late += 1;
    }
    return {
      filerCount: filers.size,
      purchases,
      sales,
      late,
      disclosures: trades.length,
    };
  }, [trades]);

  if (status === "loading" || status === "idle") {
    return <PageLoadingMotion label="Loading congressional disclosures" />;
  }

  if (status !== "success" || trades.length === 0) {
    return (
      <section className="smart-money-politicians" aria-label="Political trades">
        <div className="investor-moves-intro">
          <span className="investor-moves-eyebrow">STOCK Act · Congressional disclosures</span>
          <h2>The disclosure feed is quiet right now</h2>
          <p>STOCK Act filings will appear here when the source responds.</p>
          <button className="retry-button mt-8" type="button" onClick={() => setRequestKey((key) => key + 1)}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  const summaryBits = [
    summary.purchases > 0 ? `${summary.purchases} purchase${summary.purchases === 1 ? "" : "s"}` : null,
    summary.sales > 0 ? `${summary.sales} sale${summary.sales === 1 ? "" : "s"}` : null,
    summary.late > 0 ? `${summary.late} late filing${summary.late === 1 ? "" : "s"}` : null,
  ].filter(Boolean);

  return (
    <section className="smart-money-politicians" aria-label="Political trades">
      <div className="investor-moves-intro ink-panel">
        <div>
          <span className="investor-moves-eyebrow">STOCK Act · Congressional disclosures</span>
          <h2>Recent trades from public officials</h2>
          <p>
            House and Senate filings ranked by freshness
            {summaryBits.length > 0 ? ` — ${summaryBits.join(", ")}.` : "."}
            {" "}
            Open a company for the full evidence panel.
          </p>
        </div>
        <div className="investor-moves-stamp">
          <strong>{summary.filerCount}</strong>
          <span>officials filing</span>
        </div>
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

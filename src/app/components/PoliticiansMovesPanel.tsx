"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LogoDisplay } from "@/app/components/LogoDisplay";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "@/app/components/evidence-request";
import type { PoliticalTrade } from "@/lib/political-trades";

type DirectionFilter = "all" | "purchase" | "sale";

function formatDate(value: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function directionTone(direction: PoliticalTrade["direction"]): "up" | "down" | "quiet" {
  // Purchases stay constructive; sales use red so color marks risk, not symmetry.
  if (direction === "sale") return "down";
  if (direction === "purchase") return "up";
  return "quiet";
}

export function PoliticiansMovesPanel() {
  const [trades, setTrades] = useState<PoliticalTrade[]>([]);
  const [status, setStatus] = useState<EvidenceStatus>("idle");
  const [filter, setFilter] = useState<DirectionFilter>("all");
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

  const visibleTrades = useMemo(() => {
    if (filter === "all") return trades;
    return trades.filter((trade) => trade.direction === filter);
  }, [filter, trades]);

  if (status === "loading" || status === "idle") {
    return (
      <section className="investor-moves-panel smart-money-panel" aria-label="Political trades" aria-busy="true">
        <PageLoadingMotion label="Loading congressional disclosures" />
      </section>
    );
  }

  if (status === "error" || status === "timeout" || status === "empty") {
    return (
      <section className="investor-moves-panel smart-money-panel" aria-label="Political trades">
        <div className="investor-moves-intro ink-panel">
          <div>
            <span className="investor-moves-eyebrow">Politicians · STOCK Act</span>
            <h2>The disclosure feed is quiet right now</h2>
            <p>STOCK Act filings will appear here when the source responds.</p>
            <button className="retry-button mt-8" type="button" onClick={() => setRequestKey((key) => key + 1)}>
              Retry
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="investor-moves-panel smart-money-panel" aria-label="Political trades">
      <div className="investor-moves-toolbar">
        <div className="investor-moves-stamp">
          <strong>{summary.filerCount}</strong>
          <span>officials filing</span>
        </div>
      </div>

      <div className="investor-filter-row" role="group" aria-label="Filter by trade direction">
        <span className="investor-filter-label">Filter</span>
        <button
          type="button"
          aria-pressed={filter === "all"}
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          All trades
        </button>
        <button
          type="button"
          aria-pressed={filter === "purchase"}
          className={filter === "purchase" ? "active" : ""}
          onClick={() => setFilter("purchase")}
        >
          Purchases
        </button>
        <button
          type="button"
          aria-pressed={filter === "sale"}
          className={filter === "sale" ? "active" : ""}
          onClick={() => setFilter("sale")}
        >
          Sales
        </button>
      </div>

      {visibleTrades.length === 0 ? (
        <div className="investor-moves-filter-empty">
          No disclosures match this filter right now.
        </div>
      ) : (
        <div className="politician-trade-list">
          {visibleTrades.map((trade) => {
            const tone = directionTone(trade.direction);
            return (
              <article key={trade.id} className="politician-trade-card">
                <div className="politician-trade-card-top">
                  <Link href={`/companies/${trade.ticker}`} className="politician-trade-company">
                    <LogoDisplay ticker={trade.ticker} size="card" />
                    <div>
                      <strong>{trade.ticker}</strong>
                      <span>{trade.assetName}</span>
                    </div>
                  </Link>
                  <span className={`ink-chip ink-chip--${tone}`}>
                    {trade.transactionType}
                  </span>
                </div>
                <div className="politician-trade-body">
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
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="investor-moves-disclaimer">
        STOCK Act filings can land days after the trade. Amounts are reported in ranges, not exact sizes.
      </p>
    </section>
  );
}

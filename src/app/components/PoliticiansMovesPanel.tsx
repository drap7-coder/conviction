"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LogoDisplay } from "@/app/components/LogoDisplay";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "@/app/components/evidence-request";
import type { PoliticalTrade } from "@/lib/political-trades";
import { SmartMoneyDecisionCard } from "@/components/market/SmartMoneyDecisionCard";
import { SmartMoneyRadar } from "@/components/market/SmartMoneyRadar";
import {
  buildPoliticalBrief,
  formatCompactMoney,
  groupPoliticalTrades,
  insightPoliticalGroups,
  type PoliticalTradeGroup,
  type SmartMoneyTone,
} from "@/lib/market/smart-money-brief";

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

function signalTone(tone: SmartMoneyTone): "up" | "down" | "quiet" {
  if (tone === "positive") return "up";
  if (tone === "negative") return "down";
  return "quiet";
}

function PoliticalGroupCard({
  group,
  trackedTickers,
  addingTicker,
  onAdd,
}: {
  group: PoliticalTradeGroup;
  trackedTickers: Set<string>;
  addingTicker: string | null;
  onAdd: (idea: { ticker: string; companyName: string }) => void;
}) {
  const isTracked = trackedTickers.has(group.ticker);
  const isAdding = addingTicker === group.ticker;
  return (
    <article className={`politician-trade-card tone-${group.tone}${group.isBroadMarket ? " is-broad-market" : ""}`}>
      <div className="politician-trade-card-top">
        <Link href={`/companies/${group.ticker}`} className="politician-trade-company">
          <LogoDisplay ticker={group.ticker} size="card" />
          <div>
            <strong>{group.ticker}</strong>
            <span>{group.assetName}</span>
          </div>
        </Link>
        <div className="investor-idea-actions">
          {group.isBroadMarket ? (
            <span className="ink-chip ink-chip--quiet">Broad market</span>
          ) : null}
          <span className={`ink-chip ink-chip--${signalTone(group.tone)}`}>
            {group.directionLabel}
          </span>
          <button
            type="button"
            className={`investor-watchlist-add${isTracked ? " tracked" : ""}`}
            aria-label={isTracked ? `${group.ticker} is already on your watchlist` : `Add ${group.ticker} to watchlist`}
            title={isTracked ? "Already on watchlist" : "Add to watchlist"}
            disabled={isTracked || isAdding}
            onClick={() => onAdd({ ticker: group.ticker, companyName: group.assetName })}
          >
            {isTracked ? "✓" : isAdding ? "…" : "+"}
          </button>
        </div>
      </div>
      <div className="politician-trade-body">
        <div className="politician-cluster-metrics">
          <div>
            <strong>{group.purchaseCount > 0 ? formatCompactMoney(group.estimatedPurchases) : "—"}</strong>
            <span>{group.purchaseCount} disclosed {group.purchaseCount === 1 ? "purchase" : "purchases"}</span>
          </div>
          <div>
            <strong>{group.saleCount > 0 ? formatCompactMoney(group.estimatedSales) : "—"}</strong>
            <span>{group.saleCount} disclosed {group.saleCount === 1 ? "sale" : "sales"}</span>
          </div>
          <div className={group.lateCount > 0 ? "is-alert" : ""}>
            <strong>{group.medianLag === null ? "—" : `${group.medianLag}d`}</strong>
            <span>Median filing lag</span>
          </div>
        </div>
        <div className="politician-cluster-list">
          {group.trades.map((trade) => {
            const tone = directionTone(trade.direction);
            return (
              <div className="politician-cluster-row" key={trade.id}>
                <div>
                  <strong>{trade.filerName}</strong>
                  <span>{trade.office}</span>
                </div>
                <div>
                  <span className={`ink-chip ink-chip--${tone}`}>{trade.transactionType}</span>
                  <strong>{trade.amountRange}</strong>
                </div>
                <small>
                  Traded {trade.transactionDate ? formatDate(trade.transactionDate) : "—"} · Filed {formatDate(trade.filingDate)}
                  {trade.isLate ? <em>Late</em> : null}
                </small>
              </div>
            );
          })}
        </div>
        <div className="investor-idea-footer">
          <Link href={`/companies/${group.ticker}`} className="investor-idea-footer-link">Open company →</Link>
          {group.trades[0]?.sourceUrl ? (
            <a href={group.trades[0].sourceUrl} target="_blank" rel="noreferrer">View filing source ↗</a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

interface PoliticiansMovesPanelProps {
  trackedTickers: Set<string>;
  addingTicker: string | null;
  onAdd: (idea: { ticker: string; companyName: string }) => void;
}

export function PoliticiansMovesPanel({ trackedTickers, addingTicker, onAdd }: PoliticiansMovesPanelProps) {
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

  const visibleTrades = useMemo(() => {
    if (filter === "all") return trades;
    return trades.filter((trade) => trade.direction === filter);
  }, [filter, trades]);

  const politicalBrief = useMemo(() => buildPoliticalBrief(trades), [trades]);
  const visibleGroups = useMemo(() => groupPoliticalTrades(visibleTrades), [visibleTrades]);
  const stockGroups = useMemo(() => insightPoliticalGroups(visibleGroups), [visibleGroups]);
  const broadMarketGroups = useMemo(
    () => visibleGroups.filter((group) => group.isBroadMarket),
    [visibleGroups],
  );

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
      <SmartMoneyDecisionCard brief={politicalBrief} political />

      <SmartMoneyRadar
        title={filter === "all" ? "Largest disclosed stock clusters" : `Largest disclosed stock ${filter}s`}
        subtitle="Single-name equities only. Index and ETF filings are demoted below — size without a business."
        items={stockGroups.slice(0, 3).map((group) => ({
          ticker: group.ticker,
          label: group.directionLabel,
          detail: `${formatCompactMoney(group.estimatedTotal)} midpoint · ${group.trades.length} ${group.trades.length === 1 ? "filing" : "filings"}`,
          meta: `${group.filerCount} ${group.filerCount === 1 ? "official" : "officials"} · ${group.medianLag === null ? "Unknown" : `${group.medianLag}d`} median lag${group.lateCount > 0 ? ` · ${group.lateCount} late` : ""}`,
          href: `/companies/${group.ticker}`,
          tone: group.lateCount > 0 ? "alert" : group.tone,
        }))}
      />

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

      {visibleGroups.length === 0 ? (
        <div className="investor-moves-filter-empty">
          No disclosures match this filter right now.
        </div>
      ) : (
        <>
          <div className="smart-money-section-label">
            <div>
              <span>Evidence detail</span>
              <h3>Disclosures grouped by company</h3>
            </div>
            <p>Stock clusters first. Broad-market ETFs stay visible but off the research lead.</p>
          </div>
          {stockGroups.length > 0 ? (
            <div className="politician-trade-list">
              {stockGroups.map((group) => (
                <PoliticalGroupCard
                  key={group.ticker}
                  group={group}
                  trackedTickers={trackedTickers}
                  addingTicker={addingTicker}
                  onAdd={onAdd}
                />
              ))}
            </div>
          ) : (
            <div className="investor-moves-filter-empty">
              No single-name stock disclosures in this filter — only broad-market ETFs below.
            </div>
          )}

          {broadMarketGroups.length > 0 ? (
            <>
              <div className="smart-money-section-label">
                <div>
                  <span>Broad market</span>
                  <h3>Index and ETF disclosures</h3>
                </div>
                <p>Useful for regime context, not company research. Ranked separately so they do not crowd the lead.</p>
              </div>
              <div className="politician-trade-list politician-trade-list--broad">
                {broadMarketGroups.map((group) => (
                  <PoliticalGroupCard
                    key={group.ticker}
                    group={group}
                    trackedTickers={trackedTickers}
                    addingTicker={addingTicker}
                    onAdd={onAdd}
                  />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}

      <p className="investor-moves-disclaimer">
        STOCK Act filings can land days after the trade. Amounts are reported in ranges, not exact sizes.
      </p>
    </section>
  );
}

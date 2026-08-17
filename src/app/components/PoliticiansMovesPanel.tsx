"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "@/app/components/evidence-request";
import { WatchlistTrackControl } from "@/app/components/WatchlistTrackControl";
import type { PoliticalTrade } from "@/lib/political-trades";
import {
  formatCompactMoney,
  groupPoliticalTrades,
  type PoliticalTradeGroup,
} from "@/lib/market/smart-money-brief";
import {
  buildPoliticianStageSummary,
  type SmartMoneyStageSummary,
} from "@/lib/market/smart-money-stage";

type DirectionFilter = "all" | "purchase" | "sale";

function formatDate(value: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function directionChip(group: PoliticalTradeGroup): { label: string; tone: "up" | "down" | "quiet" } {
  if (group.purchaseCount > 0 && group.saleCount === 0) return { label: "Buy", tone: "up" };
  if (group.saleCount > 0 && group.purchaseCount === 0) return { label: "Sell", tone: "down" };
  return { label: "Mixed", tone: "quiet" };
}

function groupAction(group: PoliticalTradeGroup): string {
  const lead = group.trades[0];
  const verb = group.purchaseCount > 0 && group.saleCount === 0
    ? "bought"
    : group.saleCount > 0 && group.purchaseCount === 0
      ? "sold"
      : "traded";
  const size = formatCompactMoney(
    group.purchaseCount > 0 && group.saleCount === 0
      ? group.estimatedPurchases
      : group.saleCount > 0 && group.purchaseCount === 0
        ? group.estimatedSales
        : group.estimatedTotal,
  );

  if (group.filerCount === 1 && lead) {
    return `${lead.filerName} ${verb} ${lead.amountRange}`;
  }
  return `${group.filerCount} officials ${verb} ${size}`;
}

function groupDate(group: PoliticalTradeGroup): string {
  const latestTrade = group.trades.reduce((latest, trade) => {
    const value = trade.transactionDate || trade.filingDate;
    return value > latest ? value : latest;
  }, group.trades[0]?.transactionDate || group.latestFilingDate || "");
  return formatDate(latestTrade);
}

function PoliticalMoveRow({
  group,
  alt,
  trackedTickers,
  addingTicker,
  onAdd,
}: {
  group: PoliticalTradeGroup;
  alt: boolean;
  trackedTickers: Set<string>;
  addingTicker: string | null;
  onAdd: (idea: { ticker: string; companyName: string }) => void;
}) {
  const tracked = trackedTickers.has(group.ticker.toUpperCase());
  const adding = addingTicker === group.ticker;
  const chip = directionChip(group);

  return (
    <article
      className={`smart-money-row${alt ? " is-alt" : ""}${group.isBroadMarket ? " is-broad" : ""} is-${chip.tone === "up" ? "positive" : chip.tone === "down" ? "negative" : "neutral"}`}
      role="listitem"
    >
      <div className="smart-money-row-identity">
        <Link href={`/companies/${encodeURIComponent(group.ticker)}`}>
          <strong>{group.ticker}</strong>
          <span>{group.assetName}</span>
        </Link>
      </div>
      <div className="smart-money-row-move">
        <span className={`ink-chip ink-chip--${chip.tone}`}>{chip.label}</span>
        <span>{groupAction(group)}</span>
      </div>
      <div className="smart-money-row-size">
        <strong>Traded {groupDate(group)}</strong>
        <span>{group.isBroadMarket ? "ETF / index" : `${group.trades.length} filing${group.trades.length === 1 ? "" : "s"}`}</span>
      </div>
      <WatchlistTrackControl
        ticker={group.ticker}
        companyName={group.assetName}
        tracked={tracked}
        adding={adding}
        onAdd={onAdd}
      />
    </article>
  );
}

interface PoliticiansMovesPanelProps {
  trackedTickers: Set<string>;
  addingTicker: string | null;
  onAdd: (idea: { ticker: string; companyName: string }) => void;
  onSummaryChange: (summary: SmartMoneyStageSummary) => void;
}

export function PoliticiansMovesPanel({
  trackedTickers,
  addingTicker,
  onAdd,
  onSummaryChange,
}: PoliticiansMovesPanelProps) {
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
        if (!cancelled) {
          setTrades([]);
          setStatus(classifyClientError(err));
        }
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

  const visibleGroups = useMemo(() => groupPoliticalTrades(visibleTrades), [visibleTrades]);
  const latestVisibleTradeDate = useMemo(
    () => visibleTrades.reduce((latest, trade) => {
      const value = trade.transactionDate || trade.filingDate;
      return value > latest ? value : latest;
    }, ""),
    [visibleTrades],
  );
  const latestFilingDate = useMemo(
    () => trades.reduce(
      (latest, trade) => trade.filingDate > latest ? trade.filingDate : latest,
      "",
    ),
    [trades],
  );

  useEffect(() => {
    if (status === "success") {
      onSummaryChange(buildPoliticianStageSummary(trades));
    }
  }, [onSummaryChange, status, trades]);

  const disclosureNote = (
    <p className="smart-money-disclosure-note">
      STOCK Act filings can arrive after the trade; check the transaction date and filing lag.
      {latestFilingDate ? <> Latest filing {formatDate(latestFilingDate)}.</> : null}
    </p>
  );

  if (status === "loading" || status === "idle") {
    return (
      <section className="investor-moves-panel smart-money-panel" aria-label="Political trades" aria-busy="true">
        {disclosureNote}
        <PageLoadingMotion label="Loading congressional disclosures" />
      </section>
    );
  }

  if (status === "error" || status === "timeout" || status === "empty") {
    return (
      <section className="investor-moves-panel smart-money-panel" aria-label="Political trades">
        {disclosureNote}
        <div className="empty-state compact">
          <p>No STOCK Act filings are available right now.</p>
          <button className="retry-button" type="button" onClick={() => setRequestKey((key) => key + 1)}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="investor-moves-panel smart-money-panel" aria-label="Political trades">
      {disclosureNote}
      <div className="investor-filter-row" role="group" aria-label="Filter by trade direction">
        <button
          type="button"
          aria-pressed={filter === "all"}
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        <button
          type="button"
          aria-pressed={filter === "purchase"}
          className={filter === "purchase" ? "active" : ""}
          onClick={() => setFilter("purchase")}
        >
          Buys
        </button>
        <button
          type="button"
          aria-pressed={filter === "sale"}
          className={filter === "sale" ? "active" : ""}
          onClick={() => setFilter("sale")}
        >
          Sells
        </button>
      </div>

      {visibleGroups.length === 0 ? (
        <div className="investor-moves-filter-empty">
          No disclosures match this filter right now.
        </div>
      ) : (
        <>
          <div className="smart-money-toolbar">
            <p>
              {visibleGroups.length} name{visibleGroups.length === 1 ? "" : "s"}
              {" · "}
              {visibleTrades.length} disclosure{visibleTrades.length === 1 ? "" : "s"}
              {latestVisibleTradeDate ? ` · through ${formatDate(latestVisibleTradeDate)}` : ""}
            </p>
          </div>
          <div className="smart-money-stream" role="list">
            {visibleGroups.map((group, index) => (
              <PoliticalMoveRow
                key={group.ticker}
                group={group}
                alt={index % 2 === 1}
                trackedTickers={trackedTickers}
                addingTicker={addingTicker}
                onAdd={onAdd}
              />
            ))}
          </div>
        </>
      )}

      <p className="investor-moves-disclaimer">
        Filings can lag the trade. Amounts are ranges, not exact sizes.
      </p>
    </section>
  );
}

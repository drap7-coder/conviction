"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "@/app/components/evidence-request";
import { SmartMoneyProductStage } from "@/components/SmartMoneyProductStage";
import { WatchlistTrackControl } from "@/app/components/WatchlistTrackControl";
import { SurfaceSlicer } from "@/components/SurfaceSlicer";
import type { PoliticalTrade } from "@/lib/political-trades";
import {
  formatCompactMoney,
  groupPoliticalTrades,
  type PoliticalTradeGroup,
} from "@/lib/market/smart-money-brief";
import {
  POLITICIAN_STAGE_IDLE,
  buildPoliticianStageSummary,
} from "@/lib/market/smart-money-stage";
import { personalTrackingBadges } from "@/lib/personal-marker";
import { loadPositions } from "@/lib/portfolio/persist";
import { loadPortfolioForViewer } from "@/lib/portfolio/client";

type DirectionFilter = "all" | "purchase" | "sale";

const DIRECTION_FILTERS = [
  { id: "all", label: "All" },
  { id: "purchase", label: "Buys", tone: "up" as const },
  { id: "sale", label: "Sells", tone: "down" as const },
];

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
  bookTickers,
  trackedTickers,
  addingTicker,
  onAdd,
}: {
  group: PoliticalTradeGroup;
  alt: boolean;
  bookTickers: Set<string>;
  trackedTickers: Set<string>;
  addingTicker: string | null;
  onAdd: (idea: { ticker: string; companyName: string }) => void;
}) {
  const tracked = trackedTickers.has(group.ticker.toUpperCase());
  const adding = addingTicker === group.ticker;
  const chip = directionChip(group);
  const youBadges = personalTrackingBadges(group.ticker, bookTickers, trackedTickers);

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
        {youBadges.length > 0 ? (
          <span
            className="sm-you"
            aria-label={youBadges.map((badge) => badge.label).join(", ")}
          >
            {youBadges.map((badge) => (
              <span key={badge.id} className={`sm-you-chip is-${badge.id}`}>
                {badge.label}
              </span>
            ))}
          </span>
        ) : null}
      </div>
      <div className="smart-money-row-move">
        <span className={`sm-action-chip ${chip.tone === "up" ? "is-up" : chip.tone === "down" ? "is-down" : "is-quiet"}`}>
          {chip.label.toUpperCase()}
        </span>
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
}

export function PoliticiansMovesPanel({
  trackedTickers,
  addingTicker,
  onAdd,
}: PoliticiansMovesPanelProps) {
  const [trades, setTrades] = useState<PoliticalTrade[]>([]);
  const [status, setStatus] = useState<EvidenceStatus>("idle");
  const [filter, setFilter] = useState<DirectionFilter>("all");
  const [requestKey, setRequestKey] = useState(0);
  const [bookTickers, setBookTickers] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;
    const local = new Set(loadPositions().map((position) => position.ticker.toUpperCase()));
    setBookTickers(local);

    void loadPortfolioForViewer()
      .then((portfolio) => {
        if (cancelled) return;
        setBookTickers(new Set([
          ...local,
          ...portfolio.positions.map((position) => position.ticker.toUpperCase()),
        ]));
      })
      .catch(() => undefined);

    const onChange = () => {
      setBookTickers(new Set(loadPositions().map((position) => position.ticker.toUpperCase())));
    };
    window.addEventListener("conviction-portfolio-changed", onChange);
    return () => {
      cancelled = true;
      window.removeEventListener("conviction-portfolio-changed", onChange);
    };
  }, []);

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

  const insight = status === "success"
    ? buildPoliticianStageSummary(trades)
    : POLITICIAN_STAGE_IDLE;
  const stageLoading = status === "loading" || status === "idle";

  const disclosureNote = (
    <p className="smart-money-disclosure-note">
      STOCK Act filings can arrive after the trade; check the transaction date and filing lag.
      {latestFilingDate ? <> Latest filing {formatDate(latestFilingDate)}.</> : null}
    </p>
  );

  return (
    <section className="investor-moves-panel smart-money-panel" aria-label="Political trades" aria-busy={stageLoading || undefined}>
      <SmartMoneyProductStage
        aria-label="Congressional disclosure overview"
        eyebrow="Smart Money · Politicians · STOCK Act"
        summary={insight}
      />
      {disclosureNote}

      {status === "error" || status === "timeout" || status === "empty" ? (
        <div className="empty-state compact">
          <p>No STOCK Act filings are available right now.</p>
          <button className="retry-button" type="button" onClick={() => setRequestKey((key) => key + 1)}>
            Retry
          </button>
        </div>
      ) : null}

      {status === "success" ? (
        <>
          <div className="smart-money-control-row">
            <SurfaceSlicer
              label="Filter by trade direction"
              options={DIRECTION_FILTERS}
              activeId={filter}
              onChange={(id) => setFilter(id as DirectionFilter)}
              className="investor-book-slicer"
            />
          </div>

          <div className="smart-money-meta-row">
            <span className="smart-money-lag-chip">STOCK Act lag</span>
            <span className="smart-money-meta-pill">
              {visibleGroups.length} name{visibleGroups.length === 1 ? "" : "s"}
              {" · "}
              {visibleTrades.length} disclosure{visibleTrades.length === 1 ? "" : "s"}
            </span>
            {latestVisibleTradeDate ? (
              <span className="smart-money-meta-pill">
                Through {formatDate(latestVisibleTradeDate)}
              </span>
            ) : null}
          </div>

          {visibleGroups.length === 0 ? (
            <div className="investor-moves-filter-empty">
              No disclosures match this filter right now.
            </div>
          ) : (
            <div className="smart-money-stream" role="list">
              {visibleGroups.map((group, index) => (
                <PoliticalMoveRow
                  key={group.ticker}
                  group={group}
                  alt={index % 2 === 1}
                  bookTickers={bookTickers}
                  trackedTickers={trackedTickers}
                  addingTicker={addingTicker}
                  onAdd={onAdd}
                />
              ))}
            </div>
          )}

          <p className="investor-moves-disclaimer">
            Filings can lag the trade. Amounts are ranges, not exact sizes.
          </p>
        </>
      ) : null}
    </section>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  classifyClientError,
  fetchJsonWithTimeout,
  type EvidenceStatus,
} from "@/app/components/evidence-request";
import { SmartMoneyProductStage } from "@/components/SmartMoneyProductStage";
import { WatchlistTrackControl } from "@/app/components/WatchlistTrackControl";
import { SurfaceSlicer } from "@/components/SurfaceSlicer";
import { INSTITUTIONAL_MANAGERS } from "@/lib/sec/institutional-managers";
import { fmtCompactCurrency } from "@/lib/display/format";
import type {
  AccumulationStatus,
  InstitutionalManagerBook,
} from "@/lib/sec/institutional";
import {
  INSTITUTION_STAGE_IDLE,
  buildInstitutionStageSummary,
} from "@/lib/market/smart-money-stage";
import { personalTrackingBadges } from "@/lib/personal-marker";
import { loadPositions } from "@/lib/portfolio/persist";
import { loadPortfolioForViewer } from "@/lib/portfolio/client";

type ManagerOption = {
  cik: string;
  displayName: string;
  slug: string;
};

type InvestorBookResponse = {
  book?: InstitutionalManagerBook | null;
  managers?: ManagerOption[];
  status?: "success" | "timeout" | "error" | "empty";
  message?: string;
  attemptedAt?: string;
};

type PositionFilter = "changes" | "added" | "trimmed" | "all";

const DEFAULT_MANAGER = "Berkshire Hathaway";

const POSITION_FILTERS = [
  { id: "changes", label: "Changes" },
  { id: "added", label: "Added" },
  { id: "trimmed", label: "Trimmed" },
  { id: "all", label: "All" },
] as const;

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const MANAGER_OPTIONS: ManagerOption[] = INSTITUTIONAL_MANAGERS.map((manager) => ({
  cik: manager.cik,
  displayName: manager.displayName,
  slug: slugify(manager.displayName),
}));

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatShares(value: number): string {
  const amount = Math.abs(value);
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}K`;
  return amount.toLocaleString();
}

function statusChipClass(status: AccumulationStatus): string {
  if (status === "Reduced" || status === "Exited") return "sm-action-chip is-down";
  if (status === "New" || status === "Increased") return "sm-action-chip is-up";
  return "sm-action-chip is-quiet";
}

function statusRowClass(status: AccumulationStatus): string {
  if (status === "New" || status === "Increased") return " is-positive";
  if (status === "Reduced" || status === "Exited") return " is-negative";
  return " is-neutral";
}

function formatAttemptedAt(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function emptyHeadline(status: EvidenceStatus): string {
  if (status === "timeout") return "SEC timed out — try again.";
  if (status === "error") return "Could not load this 13F.";
  return "No filing yet for this investor.";
}

function statusLabel(status: AccumulationStatus): string {
  if (status === "New") return "NEW";
  if (status === "Increased") return "ADDED";
  if (status === "Reduced") return "TRIMMED";
  if (status === "Exited") return "EXITED";
  return "HELD";
}

function changeSummary(position: InstitutionalManagerBook["positions"][number]): string {
  const percentage = position.percentageChange === null
    ? null
    : `${position.percentageChange > 0 ? "+" : ""}${position.percentageChange.toFixed(1)}%`;

  switch (position.status) {
    case "New":
      return `Opened ${formatShares(position.shares)}`;
    case "Increased":
      return `+${formatShares(position.shareChange)}${percentage ? ` · ${percentage}` : ""}`;
    case "Reduced":
      return `−${formatShares(Math.abs(position.shareChange))}${percentage ? ` · ${percentage}` : ""}`;
    case "Exited":
      return `Exited ${formatShares(position.previousShares)}`;
    default:
      return `${formatShares(position.shares)} held`;
  }
}

interface InvestorBookPanelProps {
  trackedTickers: Set<string>;
  addingTicker: string | null;
  onAdd: (idea: { ticker: string; companyName: string }) => void;
}

export function InvestorBookPanel({
  trackedTickers,
  addingTicker,
  onAdd,
}: InvestorBookPanelProps) {
  const [selectedCik, setSelectedCik] = useState(
    () => MANAGER_OPTIONS.find((manager) => manager.displayName === DEFAULT_MANAGER)?.cik
      ?? MANAGER_OPTIONS[0]?.cik
      ?? "",
  );
  const [book, setBook] = useState<InstitutionalManagerBook | null>(null);
  const [status, setStatus] = useState<EvidenceStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [attemptedAt, setAttemptedAt] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("changes");
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
    if (!selectedCik) return;
    let cancelled = false;
    const controller = new AbortController();

    async function loadBook() {
      setStatus("loading");
      setMessage(null);
      setAttemptedAt(null);
      try {
        const data = await fetchJsonWithTimeout<InvestorBookResponse>(
          `/api/market/investor-book?manager=${encodeURIComponent(selectedCik)}`,
          52_000,
          controller.signal,
        );
        if (cancelled) return;
        setBook(data.book ?? null);
        setMessage(data.message ?? null);
        setAttemptedAt(data.attemptedAt ?? data.book?.fetchedAt ?? new Date().toISOString());
        if (data.status === "timeout") setStatus("timeout");
        else if (data.status === "error") setStatus("error");
        else if (!data.book || data.status === "empty") setStatus("empty");
        else setStatus("success");
      } catch (error) {
        if (!cancelled) {
          setBook(null);
          setAttemptedAt(new Date().toISOString());
          setStatus(classifyClientError(error));
        }
      }
    }

    void loadBook();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [requestKey, selectedCik]);

  const visiblePositions = useMemo(() => {
    const positions = book?.positions ?? [];
    if (positionFilter === "added") {
      return positions.filter((position) => position.status === "New" || position.status === "Increased");
    }
    if (positionFilter === "trimmed") {
      return positions.filter((position) => position.status === "Reduced" || position.status === "Exited");
    }
    if (positionFilter === "changes") {
      return positions.filter((position) => position.status !== "Unchanged");
    }
    return positions;
  }, [book, positionFilter]);

  const insight = book
    ? buildInstitutionStageSummary(book)
    : INSTITUTION_STAGE_IDLE;

  const selectedManager = MANAGER_OPTIONS.find((manager) => manager.cik === selectedCik);
  const addCount = book?.positions.filter((p) => p.status === "New" || p.status === "Increased").length ?? 0;
  const trimCount = book?.positions.filter((p) => p.status === "Reduced" || p.status === "Exited").length ?? 0;

  return (
    <section
      className="investor-book-panel smart-money-panel"
      aria-label="Investor portfolio lenses"
      aria-busy={(status === "loading" || status === "idle") && !book || undefined}
    >
      <SmartMoneyProductStage
        aria-label="Institutional 13F overview"
        eyebrow={book ? `Smart Money · ${book.manager.displayName} · 13F` : "Smart Money · Institutions"}
        summary={insight}
      />

      <div className="smart-money-control-row">
        <label className="investor-manager-slicer">
          <span className="investor-manager-slicer-label">Manager</span>
          <select
            value={selectedCik}
            onChange={(event) => setSelectedCik(event.target.value)}
            aria-label="Choose an investor"
            className="investor-manager-select"
          >
            {MANAGER_OPTIONS.map((manager) => (
              <option key={manager.cik} value={manager.cik}>
                {manager.displayName}
              </option>
            ))}
          </select>
        </label>
        <SurfaceSlicer
          label="Filter positions"
          options={[...POSITION_FILTERS]}
          activeId={positionFilter}
          onChange={(id) => setPositionFilter(id as PositionFilter)}
          className="investor-book-slicer"
        />
      </div>

      <div className="smart-money-meta-row">
        <span className="smart-money-lag-chip">13F lag · up to 45 days</span>
        {book ? (
          <>
            <span className="smart-money-meta-pill">
              Holdings {formatDate(book.filingQuarter)}
            </span>
            <span className="smart-money-meta-pill">
              Filed {formatDate(book.filingDate)}
            </span>
          </>
        ) : (
          <span className="smart-money-meta-pill">
            {selectedManager?.displayName ?? "Select a manager"}
          </span>
        )}
      </div>

      {status === "error" || status === "timeout" || status === "empty" ? (
        <div className="empty-state compact">
          <p>{emptyHeadline(status)}</p>
          <small>
            {message ?? "13Fs arrive on a quarterly cadence and can lag quarter-end by up to 45 days."}
            {formatAttemptedAt(attemptedAt) ? <> Last tried {formatAttemptedAt(attemptedAt)}.</> : null}
          </small>
          <button type="button" className="brief-link" onClick={() => setRequestKey((key) => key + 1)}>
            Retry →
          </button>
        </div>
      ) : null}

      {status === "success" && book ? (
        <>
          <div className="smart-money-stat-row" aria-label="Book summary">
            <div className="smart-money-stat-chip is-up">
              <span>Net adds</span>
              <strong className="tnum">{addCount}</strong>
            </div>
            <div className="smart-money-stat-chip is-down">
              <span>Net trims</span>
              <strong className="tnum">{trimCount}</strong>
            </div>
            <div className="smart-money-stat-chip">
              <span>Reported book</span>
              <strong className="tnum">{fmtCompactCurrency(book.totalReportedValue)}</strong>
            </div>
            <div className="smart-money-stat-chip">
              <span>Showing</span>
              <strong className="tnum">
                {visiblePositions.length}
                <small>/{book.positions.length}</small>
              </strong>
            </div>
          </div>
          {(addCount > 0 || trimCount > 0) ? (
            <div
              className="smart-money-metrics-bar"
              role="img"
              aria-label={`${addCount} adds, ${trimCount} trims`}
            >
              <span
                className="is-up"
                style={{ flexGrow: Math.max(addCount, 0.01) }}
              />
              <span
                className="is-down"
                style={{ flexGrow: Math.max(trimCount, 0.01) }}
              />
            </div>
          ) : null}

          {visiblePositions.length > 0 ? (
            <div className="smart-money-stream" role="list">
              {visiblePositions.map((position, index) => {
                const key = `${position.cusip}-${position.issuer}-${position.status}`;
                const ticker = position.ticker?.toUpperCase() ?? "";
                const tracked = ticker ? trackedTickers.has(ticker) : false;
                const adding = ticker ? addingTicker === position.ticker : false;
                const youBadges = ticker
                  ? personalTrackingBadges(ticker, bookTickers, trackedTickers)
                  : [];
                return (
                  <article
                    className={`smart-money-row${index % 2 === 1 ? " is-alt" : ""}${statusRowClass(position.status)}`}
                    role="listitem"
                    key={key}
                  >
                    <div className="smart-money-row-identity">
                      {position.ticker ? (
                        <Link href={`/companies/${encodeURIComponent(position.ticker)}`}>
                          <strong>{position.ticker}</strong>
                          <span>{position.issuer}</span>
                        </Link>
                      ) : (
                        <div>
                          <strong>{position.issuer}</strong>
                          <span>{position.classTitle || "Common"}</span>
                        </div>
                      )}
                      {youBadges.length > 0 ? (
                        <span
                          className="sm-you"
                          aria-label={youBadges.map((badge) => badge.label).join(", ")}
                        >
                          {youBadges.map((badge) => (
                            <span
                              key={badge.id}
                              className={`sm-you-chip is-${badge.id}`}
                            >
                              {badge.label}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </div>
                    <div className="smart-money-row-move">
                      <span className={statusChipClass(position.status)}>
                        {statusLabel(position.status)}
                      </span>
                      <span>{changeSummary(position)}</span>
                    </div>
                    <div className="smart-money-row-size">
                      <strong>
                        {position.weight === null ? "—" : `${position.weight.toFixed(1)}% of book`}
                      </strong>
                      <span>
                        {position.status === "Exited" ? "exited" : fmtCompactCurrency(position.reportedValue)}
                      </span>
                    </div>
                    {position.ticker ? (
                      <WatchlistTrackControl
                        ticker={position.ticker}
                        companyName={position.issuer}
                        tracked={tracked}
                        adding={adding}
                        onAdd={onAdd}
                      />
                    ) : (
                      <span className="watchlist-track is-missing" aria-hidden="true">—</span>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="investor-moves-filter-empty">
              No positions match this filter in the latest filing.
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

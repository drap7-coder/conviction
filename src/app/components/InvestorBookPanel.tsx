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
import { INSTITUTIONAL_MANAGERS } from "@/lib/sec/institutional-managers";
import { fmtCompactCurrency } from "@/lib/display/format";
import type {
  AccumulationStatus,
  InstitutionalManagerBook,
} from "@/lib/sec/institutional";
import { inkChipClass } from "@/lib/display/ink-tone";
import {
  INSTITUTION_STAGE_IDLE,
  buildInstitutionStageSummary,
} from "@/lib/market/smart-money-stage";

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
};

type PositionFilter = "changes" | "added" | "trimmed" | "all";

const DEFAULT_MANAGER = "Berkshire Hathaway";

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
  if (status === "Reduced" || status === "Exited") return inkChipClass("down");
  if (status === "New" || status === "Increased") return inkChipClass("up");
  return inkChipClass("quiet");
}

function statusRowClass(status: AccumulationStatus): string {
  if (status === "New" || status === "Increased") return " is-positive";
  if (status === "Reduced" || status === "Exited") return " is-negative";
  return " is-neutral";
}

function statusLabel(status: AccumulationStatus): string {
  if (status === "New") return "New";
  if (status === "Increased") return "Added";
  if (status === "Reduced") return "Trimmed";
  if (status === "Exited") return "Exited";
  return "Held";
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
  const [requestKey, setRequestKey] = useState(0);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("changes");

  useEffect(() => {
    if (!selectedCik) return;
    let cancelled = false;
    const controller = new AbortController();

    async function loadBook() {
      setStatus("loading");
      setMessage(null);
      try {
        const data = await fetchJsonWithTimeout<InvestorBookResponse>(
          `/api/market/investor-book?manager=${encodeURIComponent(selectedCik)}`,
          52_000,
          controller.signal,
        );
        if (cancelled) return;
        setBook(data.book ?? null);
        setMessage(data.message ?? null);
        if (data.status === "timeout") setStatus("timeout");
        else if (data.status === "error") setStatus("error");
        else if (!data.book || data.status === "empty") setStatus("empty");
        else setStatus("success");
      } catch (error) {
        if (!cancelled) {
          setBook(null);
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
        <label className="investor-manager-picker">
          <span>Selected manager</span>
          <select
            value={selectedCik}
            onChange={(event) => setSelectedCik(event.target.value)}
            aria-label="Choose an investor"
          >
            {MANAGER_OPTIONS.map((manager) => (
              <option key={manager.cik} value={manager.cik}>
                {manager.displayName}
              </option>
            ))}
          </select>
        </label>
        <div className="investor-filter-row investor-book-filters" role="group" aria-label="Filter positions">
          {(
            [
              ["changes", "Changes"],
              ["added", "Added"],
              ["trimmed", "Trimmed"],
              ["all", "All"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={positionFilter === value}
              className={positionFilter === value ? "active" : ""}
              onClick={() => setPositionFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="smart-money-disclosure-note">
        13F holdings are quarter-end snapshots and can arrive up to 45 days later.
        {book ? <> Holdings {formatDate(book.filingQuarter)} · filed {formatDate(book.filingDate)}.</> : null}
      </p>

      {status === "error" || status === "timeout" || status === "empty" ? (
        <div className="empty-state compact">
          <p>{message ?? "No filing book is available for this investor right now."}</p>
          <small>13Fs arrive on a quarterly cadence and can lag quarter-end by up to 45 days.</small>
          <button type="button" className="brief-link" onClick={() => setRequestKey((key) => key + 1)}>
            Retry →
          </button>
        </div>
      ) : null}

      {status === "success" && book ? (
        <>
          <div className="smart-money-toolbar">
            <p>
              Showing {visiblePositions.length} position{visiblePositions.length === 1 ? "" : "s"}
              {" · "}
              as of {formatDate(book.filingQuarter)}
              {book.previousQuarter ? ` · vs ${formatDate(book.previousQuarter)}` : ""}
              {" · "}
              {fmtCompactCurrency(book.totalReportedValue)}
            </p>
          </div>

          {visiblePositions.length > 0 ? (
            <div className="smart-money-stream" role="list">
              {visiblePositions.map((position, index) => {
                const key = `${position.cusip}-${position.issuer}-${position.status}`;
                const tracked = position.ticker ? trackedTickers.has(position.ticker.toUpperCase()) : false;
                const adding = position.ticker ? addingTicker === position.ticker : false;
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

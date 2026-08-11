"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LogoDisplay } from "@/app/components/LogoDisplay";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { SignalBlock } from "@/components/display/SignalBlock";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "@/app/components/evidence-request";
import type {
  AccumulationStatus,
  InstitutionalMarketIdea,
  InstitutionalMarketResult,
} from "@/lib/sec/institutional";
import type { EvidenceStrength } from "@/lib/display/vocabulary";
import { inkChipClass } from "@/lib/display/ink-tone";

type InvestorMovesResponse = InstitutionalMarketResult & {
  status?: "success" | "timeout" | "error";
  message?: string;
};

type InvestorFilter = "all" | string;

function formatDate(value: string | null): string {
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
  // Adds stay quiet — red is reserved for trims/exits so it stays meaningful.
  if (status === "Reduced" || status === "Exited") return inkChipClass("down");
  if (status === "New" || status === "Increased") return inkChipClass("up");
  return inkChipClass("quiet");
}

function moveSummary(move: InstitutionalMarketIdea["moves"][number]): string {
  const percentage = move.percentageChange === null
    ? null
    : `${move.percentageChange > 0 ? "+" : ""}${move.percentageChange.toFixed(1)}%`;

  switch (move.status) {
    case "New":
      return `Opened ${formatShares(move.shares)} shares`;
    case "Increased":
      return `Added ${formatShares(move.shareChange)}${percentage ? ` · ${percentage}` : ""}`;
    case "Reduced":
      return `Trimmed ${formatShares(move.shareChange)}${percentage ? ` · ${percentage}` : ""}`;
    case "Exited":
      return `Exited ${formatShares(move.previousShares)} shares`;
    default:
      return `${formatShares(move.shares)} shares held`;
  }
}

function ideaConclusion(idea: InstitutionalMarketIdea): string {
  if (idea.newPositionCount >= 2) {
    return `Big funds are building ${idea.ticker}`;
  }
  if (idea.newPositionCount === 1) {
    return `A large fund opened ${idea.ticker}`;
  }
  if (idea.increasedCount >= 2) {
    return `Funds are adding to ${idea.ticker}`;
  }
  if (idea.increasedCount === 1) {
    return `Fund ownership increased in ${idea.ticker}`;
  }
  if (idea.holderCount >= 3) {
    return `Several large funds hold ${idea.ticker}`;
  }
  return `Fund activity showing up in ${idea.ticker}`;
}

function ideaEvidence(idea: InstitutionalMarketIdea): string {
  if (idea.newPositionCount > 0) {
    return `${idea.newPositionCount} large ${idea.newPositionCount === 1 ? "fund opened" : "funds opened"} a position.`;
  }
  if (idea.increasedCount > 0) {
    return `${idea.increasedCount} large ${idea.increasedCount === 1 ? "fund added" : "funds added"} to the position.`;
  }
  return `${idea.holderCount} large funds independently hold the company.`;
}

function ideaStrength(idea: InstitutionalMarketIdea): EvidenceStrength {
  if (idea.newPositionCount >= 2 || idea.increasedCount >= 2 || idea.holderCount >= 3) return "strong";
  if (idea.newPositionCount > 0 || idea.increasedCount > 0) return "mixed";
  return "awaiting";
}

interface InvestorMovesPanelProps {
  trackedTickers: Set<string>;
  addingTicker: string | null;
  onAdd: (idea: { ticker: string; companyName: string }) => void;
}

export function InvestorMovesPanel({ trackedTickers, addingTicker, onAdd }: InvestorMovesPanelProps) {
  const [response, setResponse] = useState<InvestorMovesResponse | null>(null);
  const [status, setStatus] = useState<EvidenceStatus>("idle");
  const [filter, setFilter] = useState<InvestorFilter>("all");
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadInvestorMoves() {
      setStatus("loading");
      try {
        const data = await fetchJsonWithTimeout<InvestorMovesResponse>(
          "/api/market/investor-moves",
          52_000,
          controller.signal,
        );
        if (cancelled) return;
        setResponse(data);
        if (data.status === "timeout") setStatus("timeout");
        else if (data.status === "error") setStatus("error");
        else setStatus(data.ideas.length > 0 ? "success" : "empty");
      } catch (error) {
        if (!cancelled) setStatus(classifyClientError(error));
      }
    }

    void loadInvestorMoves();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [requestKey]);

  const investorOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const idea of response?.ideas ?? []) {
      for (const move of idea.moves) {
        if (move.status === "New" || move.status === "Increased" || move.shares > 0) {
          counts.set(move.displayName, (counts.get(move.displayName) ?? 0) + 1);
        }
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([name]) => name);
  }, [response]);

  useEffect(() => {
    if (filter !== "all" && investorOptions.length > 0 && !investorOptions.includes(filter)) {
      setFilter("all");
    }
  }, [filter, investorOptions]);

  const visibleIdeas = useMemo(() => {
    const ideas = response?.ideas ?? [];
    if (filter === "all") return ideas;

    return ideas
      .filter((idea) => idea.moves.some((move) => move.displayName === filter))
      .map((idea) => ({
        ...idea,
        moves: [...idea.moves].sort((a, b) => {
          const aMatch = a.displayName === filter ? 0 : 1;
          const bMatch = b.displayName === filter ? 0 : 1;
          return aMatch - bMatch;
        }),
      }))
      .sort((a, b) => {
        const rank = (idea: InstitutionalMarketIdea) => {
          const move = idea.moves.find((item) => item.displayName === filter);
          if (!move) return 99;
          if (move.status === "New") return 0;
          if (move.status === "Increased") return 1;
          return 2;
        };
        return rank(a) - rank(b) || b.score - a.score;
      });
  }, [filter, response]);

  if (status === "loading" || status === "idle") {
    return (
      <section className="investor-moves-panel smart-money-panel" aria-label="Institutional moves" aria-busy="true">
        <PageLoadingMotion label="Reading institutional filings" />
      </section>
    );
  }

  if (status === "error" || status === "timeout" || status === "empty") {
    return (
      <section className="investor-moves-panel smart-money-panel" aria-label="Institutional moves">
        <div className="investor-moves-intro ink-panel">
          <div>
            <span className="investor-moves-eyebrow">Institutions · Form 13F</span>
            <h2>The filing feed is quiet right now</h2>
            <p>{response?.message ?? "No qualifying institutional ideas were found in the latest comparison."}</p>
            <button className="retry-button mt-8" type="button" onClick={() => setRequestKey((key) => key + 1)}>
              Retry
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="investor-moves-panel smart-money-panel" aria-label="Institutional moves">
      {visibleIdeas[0] ? (
        <div className="smart-money-answer" aria-label="Most notable institutional filing">
          <div className="smart-money-answer-copy">
            <span className="smart-money-answer-eyebrow">Most notable filing</span>
            <h2>{ideaConclusion(visibleIdeas[0])}</h2>
            <p>{ideaEvidence(visibleIdeas[0])}</p>
          </div>
          <div className="smart-money-answer-metrics">
            <div>
              <strong>{response?.managerCount ?? 0}</strong>
              <span>Managers read</span>
            </div>
            <div>
              <strong>{visibleIdeas.length}</strong>
              <span>{filter === "all" ? "Ideas surfaced" : "Filter matches"}</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="investor-filter-row" role="group" aria-label="Filter by investor">
        <span className="investor-filter-label">Filter</span>
        <button
          type="button"
          aria-pressed={filter === "all"}
          className={filter === "all" ? "active" : ""}
          onClick={() => setFilter("all")}
        >
          All investors
        </button>
        {investorOptions.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={filter === name}
            className={filter === name ? "active" : ""}
            onClick={() => setFilter(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {visibleIdeas.length === 0 ? (
        <div className="investor-moves-filter-empty">
          No ownership moves match this investor in the latest filings.
        </div>
      ) : (
        <div className="investor-idea-grid">
          {visibleIdeas.map((idea) => {
            const isTracked = trackedTickers.has(idea.ticker);
            const isAdding = addingTicker === idea.ticker;
            const strength = ideaStrength(idea);
            return (
              <article className="investor-idea-card" key={idea.ticker}>
                <div className="investor-idea-card-top">
                  <Link href={`/companies/${idea.ticker}`} className="investor-idea-company">
                    <LogoDisplay ticker={idea.ticker} size="card" />
                    <div>
                      <strong>{idea.ticker}</strong>
                      <span>{idea.companyName}</span>
                    </div>
                  </Link>
                  <div className="investor-idea-actions">
                    <button
                      type="button"
                      className={`investor-watchlist-add${isTracked ? " tracked" : ""}`}
                      aria-label={isTracked ? `${idea.ticker} is already on your watchlist` : `Add ${idea.ticker} to watchlist`}
                      title={isTracked ? "Already on watchlist" : "Add to watchlist"}
                      disabled={isTracked || isAdding}
                      onClick={() => onAdd({ ticker: idea.ticker, companyName: idea.companyName })}
                    >
                      {isTracked ? "✓" : isAdding ? "…" : "+"}
                    </button>
                  </div>
                </div>

                <div className="investor-idea-body">
                  <SignalBlock
                    compact
                    conclusion={
                      filter !== "all"
                        ? `${filter} activity in ${idea.ticker}`
                        : ideaConclusion(idea)
                    }
                    evidence={
                      filter !== "all"
                        ? (() => {
                            const move = idea.moves.find((item) => item.displayName === filter);
                            return move ? moveSummary(move) : ideaEvidence(idea);
                          })()
                        : ideaEvidence(idea)
                    }
                    whyItMatters="Fund filings can arrive weeks late and may not match today’s holdings."
                    dateLabel={idea.filingQuarter ? `Holdings as of ${formatDate(idea.filingQuarter)}` : null}
                    source="sec_filing"
                    strength={strength}
                  >
                    <div className="investor-manager-list">
                      {idea.moves.map((move) => (
                        <div
                          className={`investor-manager-row${filter === move.displayName ? " selected" : ""}`}
                          key={`${idea.ticker}-${move.displayName}`}
                        >
                          <button
                            type="button"
                            className="investor-manager-name"
                            onClick={() => setFilter(move.displayName)}
                          >
                            {move.displayName}
                          </button>
                          <strong className={statusChipClass(move.status)}>{moveSummary(move)}</strong>
                        </div>
                      ))}
                    </div>
                  </SignalBlock>

                  <div className="investor-idea-footer">
                    <Link href={`/companies/${idea.ticker}`} className="investor-idea-footer-link">
                      Open company →
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="investor-moves-disclaimer">
        Filed through {formatDate(response?.latestFilingDate ?? null)}. Fund filings can arrive up to 45 days after quarter-end and show positions, not intent.
      </p>
    </section>
  );
}

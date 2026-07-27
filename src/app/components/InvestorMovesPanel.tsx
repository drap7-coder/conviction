"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LogoDisplay } from "@/app/components/LogoDisplay";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "@/app/components/evidence-request";
import type {
  AccumulationStatus,
  InstitutionalIdeaCategory,
  InstitutionalMarketIdea,
  InstitutionalMarketResult,
} from "@/lib/sec/institutional";

type InvestorMovesResponse = InstitutionalMarketResult & {
  status?: "success" | "timeout" | "error";
  message?: string;
};

type InvestorFilter = "all" | InstitutionalIdeaCategory;

const INVESTOR_FILTERS: Array<{ id: InvestorFilter; label: string }> = [
  { id: "all", label: "All ideas" },
  { id: "new", label: "New positions" },
  { id: "added", label: "Biggest adds" },
  { id: "shared", label: "Shared conviction" },
];

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

function statusClass(status: AccumulationStatus): string {
  if (status === "New" || status === "Increased") return "positive";
  if (status === "Reduced" || status === "Exited") return "negative";
  return "neutral";
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

function ideaSummary(idea: InstitutionalMarketIdea): string {
  if (idea.newPositionCount > 0) {
    return `${idea.newPositionCount} tracked ${idea.newPositionCount === 1 ? "manager opened" : "managers opened"} a position.`;
  }
  if (idea.increasedCount > 0) {
    return `${idea.increasedCount} tracked ${idea.increasedCount === 1 ? "manager added" : "managers added"} to the position.`;
  }
  return `${idea.holderCount} tracked managers independently hold the company.`;
}

export function InvestorMovesPanel() {
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

  const visibleIdeas = useMemo(() => {
    const ideas = response?.ideas ?? [];
    return filter === "all"
      ? ideas
      : ideas.filter((idea) => idea.categories.includes(filter));
  }, [filter, response]);

  if (status === "loading" || status === "idle") {
    return (
      <section className="investor-moves-panel" aria-label="Investor moves" aria-busy="true">
        <div className="investor-moves-intro">
          <span className="investor-moves-eyebrow">SEC Form 13F · Investor Moves</span>
          <h2>Ideas from notable investor portfolios</h2>
          <p>Comparing the two latest filings from notable investors.</p>
        </div>
        <PageLoadingMotion label="Reading investor filings" />
      </section>
    );
  }

  if (status === "error" || status === "timeout" || status === "empty") {
    return (
      <section className="investor-moves-panel" aria-label="Investor moves">
        <div className="investor-moves-intro">
          <span className="investor-moves-eyebrow">SEC Form 13F · Investor Moves</span>
          <h2>The filing feed is quiet right now</h2>
          <p>{response?.message ?? "No qualifying investor ideas were found in the latest comparison."}</p>
          <button className="retry-button mt-8" type="button" onClick={() => setRequestKey((key) => key + 1)}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="investor-moves-panel" aria-label="Investor moves">
      <div className="investor-moves-intro">
        <div>
          <span className="investor-moves-eyebrow">SEC Form 13F · Investor Moves</span>
          <h2>Ideas from notable investor portfolios</h2>
          <p>
            New positions, meaningful adds, and companies held across multiple notable investors.
          </p>
        </div>
        <div className="investor-moves-stamp">
          <strong>{response?.managerCount ?? 0}</strong>
          <span>managers read</span>
        </div>
      </div>

      <div className="investor-filter-row" role="group" aria-label="Filter investor moves">
        {INVESTOR_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            className={filter === item.id ? "active" : ""}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {visibleIdeas.length === 0 ? (
        <div className="investor-moves-filter-empty">
          No ideas match this lens in the latest filings.
        </div>
      ) : (
        <div className="investor-idea-grid">
          {visibleIdeas.map((idea) => (
            <Link href={`/companies/${idea.ticker}`} className="investor-idea-card" key={idea.ticker}>
              <div className="investor-idea-card-top">
                <div className="investor-idea-company">
                  <LogoDisplay ticker={idea.ticker} size="card" />
                  <div>
                    <strong>{idea.ticker}</strong>
                    <span>{idea.companyName}</span>
                  </div>
                </div>
                <span className={`investor-idea-badge ${idea.headline === "Shared Conviction" ? "shared" : "positive"}`}>
                  {idea.headline}
                </span>
              </div>

              <p className="investor-idea-thesis">{ideaSummary(idea)}</p>

              <div className="investor-manager-list">
                {idea.moves.map((move) => (
                  <div className="investor-manager-row" key={`${idea.ticker}-${move.displayName}`}>
                    <span>{move.displayName}</span>
                    <strong className={statusClass(move.status)}>{moveSummary(move)}</strong>
                  </div>
                ))}
              </div>

              <div className="investor-idea-footer">
                <span>Holdings as of {formatDate(idea.filingQuarter)}</span>
                <strong>Open company →</strong>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="investor-moves-disclaimer">
        Filed through {formatDate(response?.latestFilingDate ?? null)}. 13F filings can arrive up to 45 days after quarter-end and show positions, not investor intent.
      </p>
    </section>
  );
}

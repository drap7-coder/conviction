"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";
import { getCardVerdict } from "@/lib/evidence/card-verdict";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "@/app/components/evidence-request";

interface InstitutionalEmergingIdea {
  ticker: string;
  name: string;
  score: number;
  aggregateShareChange: number;
  newPositions: number;
  increased: number;
  reduced: number;
  exited: number;
  latestFilingDate: string;
  topSignals: InstitutionalAccumulation[];
}

interface InstitutionalEmergingResponse {
  ideas: InstitutionalEmergingIdea[];
  total: number;
  source: "sec-13f" | "timeout" | "error";
  status?: "success" | "timeout" | "error";
  message?: string;
  fetchedAt: string;
}

interface ConvictionTransition {
  id: string;
  ticker: string;
  type: "status_upgrade" | "new_signal_type" | "manager_breadth_increase" | "status_downgrade" | "signal_expired";
  previousStatus: string;
  currentStatus: string;
  reason: string;
  createdAt: string;
}

interface ConvictionTransitionResponse {
  transitions: ConvictionTransition[];
  count: number;
  fetchedAt: string;
}

interface StockQuote {
  ticker: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume?: number | null;
  dollarVolume?: number | null;
  currency: string | null;
  marketState: string | null;
}

interface TrendingCompany {
  ticker: string;
  companyName: string;
  cik?: string;
  quote: StockQuote;
  activityRank: number;
  activityLabel: string;
}

function formatShares(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatPrice(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: value >= 100 ? 2 : 3,
    minimumFractionDigits: value >= 1 ? 2 : 3,
  });
}

function formatChange(value: number | null, percent: number | null) {
  if (value === null || percent === null) return "Quote unavailable";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} · ${sign}${percent.toFixed(2)}%`;
}

function signalLabel(signal: InstitutionalAccumulation) {
  if (signal.status === "New") return `${signal.displayName} opened a position`;
  if (signal.status === "Increased") {
    return `${signal.displayName} added ${formatShares(signal.shareChange)} shares`;
  }
  return `${signal.displayName}: ${signal.status}`;
}

function whyRanked(idea: InstitutionalEmergingIdea) {
  const parts = [];
  if (idea.newPositions) parts.push(`${idea.newPositions} new`);
  if (idea.increased) parts.push(`${idea.increased} increased`);
  if (idea.reduced) parts.push(`${idea.reduced} reduced`);
  if (idea.exited) parts.push(`${idea.exited} exited`);
  return parts.join(" · ");
}

function RisingBuildState() {
  return (
    <div className="rising-build" role="status" aria-live="polite">
      <div className="rising-build-header">
        <div>
          <span className="institutional-eyebrow">Building conviction board</span>
          <h3>Reading 13F filings</h3>
          <p>Checking manager changes, share counts, and filing recency.</p>
        </div>
        <div className="rising-build-meter" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="rising-build-grid" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, index) => (
          <div className="rising-build-card" key={index}>
            <div className="rising-scan-line" />
            <div className="rising-build-row">
              <span className="rising-build-chip" />
              <span className="rising-build-title" />
              <span className="rising-build-score" />
            </div>
            <div className="rising-build-facts">
              <span />
              <span />
              <span />
            </div>
            <span className="rising-build-copy" />
            <span className="rising-build-copy short" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RisingConvictionPage() {
  const [trending, setTrending] = useState<TrendingCompany[]>([]);
  const [trendingStatus, setTrendingStatus] = useState<EvidenceStatus>("idle");
  const [transitions, setTransitions] = useState<ConvictionTransition[]>([]);
  const [transitionStatus, setTransitionStatus] = useState<EvidenceStatus>("idle");
  const [ideas, setIdeas] = useState<InstitutionalEmergingIdea[]>([]);
  const [status, setStatus] = useState<EvidenceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadTrending() {
      setTrendingStatus("loading");
      try {
        const data = await fetchJsonWithTimeout<{ companies?: TrendingCompany[] }>(
          "/api/market/trending?limit=8",
          10_000,
          controller.signal,
        );
        if (!cancelled) {
          setTrending(data.companies ?? []);
          setTrendingStatus((data.companies ?? []).length > 0 ? "success" : "empty");
        }
      } catch (err) {
        console.warn("[rising] Failed to load trending companies:", err);
        if (!cancelled) setTrendingStatus(classifyClientError(err));
      }
    }

    void loadTrending();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [requestKey]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadTransitions() {
      setTransitionStatus("loading");
      try {
        const data = await fetchJsonWithTimeout<ConvictionTransitionResponse>(
          "/api/conviction/transitions",
          8_000,
          controller.signal,
        );
        if (!cancelled) {
          setTransitions(data.transitions ?? []);
          setTransitionStatus((data.transitions ?? []).length > 0 ? "success" : "empty");
        }
      } catch (err) {
        console.warn("[rising] Failed to load conviction transitions:", err);
        if (!cancelled) setTransitionStatus(classifyClientError(err));
      }
    }

    void loadTransitions();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [requestKey]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadRisingConviction() {
      setStatus("loading");
      setError(null);
      try {
        const data = await fetchJsonWithTimeout<InstitutionalEmergingResponse>(
          "/api/evidence/institutional/emerging",
          32_000,
          controller.signal,
        );
        if (!cancelled) {
          setIdeas(data.ideas ?? []);
          if (data.status === "timeout" || data.status === "error") {
            setStatus(data.status);
            setError(data.message ?? "Institutional evidence is temporarily unavailable.");
          } else {
            setStatus((data.ideas ?? []).length > 0 ? "success" : "empty");
          }
        }
      } catch (err) {
        console.warn("[rising] Failed to load institutional evidence:", err);
        if (!cancelled) {
          const nextStatus = classifyClientError(err);
          setStatus(nextStatus === "idle" ? "error" : nextStatus);
          setError(nextStatus === "timeout"
            ? "Institutional filing data is temporarily unavailable."
            : "Institutional evidence could not be loaded.");
        }
      }
    }

    void loadRisingConviction();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [requestKey]);

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Trending</h2>
        <span className="section-count">
          {trendingStatus === "loading" || trendingStatus === "idle" ? "..." : `${trending.length} ideas`}
        </span>
      </div>

      <div className="leaderboard-brief">
        <h1>Daily idea flow.</h1>
        <p>Active market names to inspect, then click into the evidence trail. Trending is discovery, not conviction by itself.</p>
      </div>

      <section className="trending-section" aria-label="Trending companies">
        {trendingStatus === "loading" || trendingStatus === "idle" ? (
          <div className="empty-state compact">
            <p>Finding active names...</p>
          </div>
        ) : trending.length === 0 ? (
          <div className="empty-state">
            <p>No trending ideas loaded right now.</p>
            <small>Market activity is temporarily unavailable.</small>
          </div>
        ) : (
          <div className="watchlist-carousel trending-carousel">
            <div className="carousel-hint" aria-hidden="true">
              <span>Daily ideas</span>
              <strong>Scroll trending →</strong>
            </div>
            <div className="watchlist-scroll" aria-label="Trending companies carousel">
              <div className="company-grid">
                {trending.map((idea) => {
                  const quote = idea.quote;
                  const quoteDirection = quote.change === null || quote.change === undefined
                    ? "neutral"
                    : quote.change > 0
                      ? "positive"
                      : quote.change < 0
                      ? "negative"
                      : "neutral";
                  const verdict = getCardVerdict({
                    ticker: idea.ticker,
                    companyName: idea.companyName,
                    addedAt: new Date().toISOString(),
                    status: "active",
                  }, quote);

                  return (
                    <div key={idea.ticker} className="company-card-wrap">
                      <div className="company-card trending-card">
                        <div className="card-header">
                          <div>
                            <span className="card-rank">#{idea.activityRank} trending</span>
                            <span className="card-ticker">{idea.ticker}</span>
                            <span className="card-name">{idea.companyName}</span>
                          </div>
                          <span className="card-arrow" aria-hidden="true">→</span>
                        </div>

                        <div className="card-quote">
                          <span className="card-price">
                            ${formatPrice(quote.price)}
                          </span>
                          <span className={`card-quote-change ${quoteDirection}`}>
                            {formatChange(quote.change, quote.changePercent)}
                          </span>
                        </div>

                        <div className={`card-verdict ${verdict.tone}`}>
                          <div className="verdict-line">
                            <span>Conviction: {verdict.state}</span>
                            <strong>{verdict.strength}%</strong>
                          </div>
                          <div className="verdict-meter" aria-hidden="true">
                            <span style={{ width: `${verdict.strength}%` }} />
                          </div>
                          <div className="verdict-evidence">
                            {idea.activityLabel} · {verdict.support} support · {verdict.contra} contra
                          </div>
                        </div>

                        <div className="card-implication">
                          {verdict.insight}
                        </div>

                        <div className="card-recency">
                          <span>Market activity today</span>
                          <span>{verdict.source}</span>
                        </div>

                        <div className="card-actions">
                          <Link href={`/companies/${idea.ticker}`} className="card-action primary">
                            More detail
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="section-header mt-16">
        <h2 className="section-title">Rising conviction</h2>
        <span className="section-count">
          {transitionStatus === "loading" || transitionStatus === "idle" ? "..." : `${transitions.length} transitions`}
        </span>
      </div>

      <div className="leaderboard-brief secondary">
        <h1>What changed?</h1>
        <p>Verified conviction shifts from successful evidence refreshes. No provider outage can create a fake alert.</p>
      </div>

      <section className="rising-transition-panel">
        {transitionStatus === "loading" || transitionStatus === "idle" ? (
          <div className="rising-transition-empty" role="status" aria-live="polite">
            <span className="institutional-eyebrow">Checking transition log</span>
            <p>Reading verified conviction shifts.</p>
          </div>
        ) : transitions.length === 0 ? (
          <div className="rising-transition-empty">
            <span className="institutional-eyebrow">Tracking</span>
            <p>Waiting for the first verified conviction shift.</p>
            <small>First snapshots create a silent baseline. The next successful evidence change can appear here.</small>
          </div>
        ) : (
          <div className="rising-transition-list">
            {transitions.map((transition) => (
              <Link href={`/companies/${transition.ticker}`} className={`rising-transition-card ${transition.type}`} key={transition.id}>
                <span>{transition.type.replace(/_/g, " ")}</span>
                <strong>{transition.ticker}: {transition.previousStatus} → {transition.currentStatus}</strong>
                <p>{transition.reason}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="section-header mt-16">
        <h2 className="section-title">Institutional leaderboard</h2>
        <span className="section-count">
          {status === "loading" || status === "idle" ? "..." : `${ideas.length} companies`}
        </span>
      </div>

      <div className="leaderboard-brief secondary">
        <h1>Institutional context</h1>
        <p>Ranked by new and increased positions among 15 tracked institutional managers.</p>
      </div>

      {status === "loading" || status === "idle" ? (
        <RisingBuildState />
      ) : error && ideas.length === 0 ? (
        <div className="leaderboard-warning">
          <div>
            <span className="institutional-eyebrow">13F board unavailable</span>
            <p>{error}</p>
          </div>
          <button className="retry-button" type="button" onClick={() => setRequestKey((key) => key + 1)}>
            Retry
          </button>
        </div>
      ) : ideas.length === 0 ? (
        <div className="empty-state">
          <p>No institutional leaderboard entries right now.</p>
          <small>This secondary section uses 13F accumulation only.</small>
        </div>
      ) : (
        <div className="leaderboard-list">
          {ideas.map((idea, index) => (
            <div key={idea.ticker} className="emerging-card">
              <div className="leaderboard-card-header">
                <span className="leaderboard-rank">#{index + 1}</span>
                <div>
                  <span className="card-ticker">{idea.ticker}</span>
                  <span className="card-name">{idea.name}</span>
                </div>
                <span className="leaderboard-score">{Math.round(idea.score)}</span>
              </div>

              <div className="leaderboard-facts">
                <div>
                  <strong>{idea.newPositions}</strong>
                  <span>new</span>
                </div>
                <div>
                  <strong>{idea.increased}</strong>
                  <span>increased</span>
                </div>
                <div>
                  <strong>{idea.reduced + idea.exited}</strong>
                  <span>reduced/exited</span>
                </div>
              </div>

              <div className="emerging-event">
                <strong>Why ranked:</strong> {whyRanked(idea)}
              </div>
              <div className="emerging-event mt-8">
                <strong>Net shares:</strong>{" "}
                {idea.aggregateShareChange > 0 ? "+" : ""}
                {formatShares(idea.aggregateShareChange)} shares
                {" · "}
                <strong>Latest filing:</strong> {idea.latestFilingDate}
              </div>

              {idea.topSignals.length > 0 ? (
                <div className="leaderboard-signals mt-8">
                  {idea.topSignals.map((signal) => (
                    <span key={`${signal.cik}-${signal.status}-${signal.cusip}`}>
                      {signalLabel(signal)}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="flex items-center gap-8 mt-8">
                <Link href={`/companies/${idea.ticker}`} className="detail-back">
                  View company →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.55rem",
          color: "var(--quiet)",
          textAlign: "center",
          marginTop: 16,
        }}
      >
        Powered by SEC EDGAR Form 13F institutional data
      </p>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildConvictionSnapshot, type BuildSnapshotInput } from "@/lib/conviction/canonical";
import { MODEL_VERSION } from "@/lib/conviction/model-version";
import { getConvictionBadge } from "@/lib/conviction/canonical-types";
import { cachedFetch } from "@/lib/request-cache";
import type { EarningsEvidence } from "@/lib/earnings/types";
import type { EvidenceEvent } from "@/lib/evidence/types";
import type { PoliticalTradeSummary } from "@/lib/political-trades";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";
import type { StockHistoryPoint } from "@/lib/market/technical-state";
import type { StockQuote } from "@/lib/market/quotes";

interface FetchState {
  institutional: { results?: InstitutionalAccumulation[]; status?: string } | null;
  insider: { events?: EvidenceEvent[]; status?: string; source?: string } | null;
  earnings: EarningsEvidence | null;
  political: (PoliticalTradeSummary & { status?: string }) | null;
  history: StockHistoryPoint[];
  quote: StockQuote | null;
  week52High: number | null;
  week52Low: number | null;
}

interface CompanyVerdictSimpleProps {
  ticker: string;
  /** Pre-fetched snapshot to skip client-side loading */
  initialSnapshot?: ReturnType<typeof buildConvictionSnapshot>;
}

const EMPTY: FetchState = {
  institutional: null,
  insider: null,
  earnings: null,
  political: null,
  history: [],
  quote: null,
  week52High: null,
  week52Low: null,
};

export function CompanyVerdict({ ticker }: CompanyVerdictSimpleProps) {
  const [state, setState] = useState<FetchState>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [institutional, insider, earnings, political, quoteDataAll] = await Promise.all([
          cachedFetch<FetchState["institutional"]>(`/api/evidence/institutional?ticker=${ticker}`, { ttl: 60 * 60 * 1000 }),
          cachedFetch<FetchState["insider"]>(`/api/evidence/insider?ticker=${ticker}`, { ttl: 30 * 60 * 1000 }),
          cachedFetch<EarningsEvidence>(`/api/evidence/earnings?ticker=${ticker}`, { ttl: 60 * 60 * 1000 }),
          cachedFetch<FetchState["political"]>(`/api/evidence/political?ticker=${ticker}`, { ttl: 60 * 60 * 1000 }),
          cachedFetch<{ quotes?: StockQuote[] }>(`/api/market/quotes?tickers=${encodeURIComponent(ticker)}`, { ttl: 60 * 1000 }),
        ]);

        if (cancelled) return;

        const quote = (quoteDataAll?.quotes ?? [])[0] ?? null;
        const history = quote?.sparkline ?? [];
        const week52High = null; // quote doesn't carry this from sparkline
        const week52Low = null;

        setState({ institutional, insider, earnings, political, history, quote, week52High, week52Low });
      } catch {
        if (!cancelled) setState(EMPTY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [ticker]);

  const snapshot = useMemo(() => {
    if (!state.quote) return null;
    return buildConvictionSnapshot({
      ticker,
      institutional: state.institutional,
      insider: state.insider,
      earnings: state.earnings,
      political: state.political,
      historyPoints: state.history,
      quote: state.quote,
      week52High: state.week52High,
      week52Low: state.week52Low,
    });
  }, [ticker, state]);

  const badge = useMemo(() => snapshot ? getConvictionBadge(snapshot) : null, [snapshot]);

  if (loading) {
    return (
      <section className="verdict-card" aria-label="Conviction verdict">
        <div className="verdict-topline">
          <div>
            <span className="verdict-eyebrow">Decision snapshot</span>
            <h2>Building the evidence picture…</h2>
            <p>Checking filings, insider trades, earnings and political disclosures.</p>
          </div>
          <div className="verdict-score insufficient">
            <strong>—</strong>
            <span>of 100</span>
          </div>
        </div>
        <div className="verdict-meta">
          <span><b>…</b> confidence</span>
          <span><b>…</b> evidence coverage</span>
          <span>Score is evidence, not a recommendation</span>
        </div>
        <div className="signal-strip">
          {["Large investors", "Company insiders", "Earnings momentum", "Political disclosures"].map((label) => (
            <div className="signal-pill" key={label}>
              <span>{label}</span>
              <strong className="missing">Checking</strong>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!snapshot) {
    return (
      <section className="verdict-card" aria-label="Conviction verdict unavailable">
        <div className="verdict-topline">
          <div>
            <span className="verdict-eyebrow">Decision snapshot</span>
            <h2>Evidence still forming</h2>
            <p>Unable to load evidence feeds for {ticker}.</p>
          </div>
        </div>
      </section>
    );
  }

  const { evidence, technical, market } = snapshot;
  const verdict = evidence.summary;
  const directionClass = evidence.score > 0 ? "bullish" : evidence.score < 0 ? "bearish" : "mixed";
  const techState = technical.state !== "unknown" ? technical.state : null;

  return (
    <section className="verdict-card" aria-label="Conviction verdict">
      <div className="verdict-topline">
        <div>
          <span className="verdict-eyebrow">Decision snapshot</span>
          <h2>
            {evidence.verdict === "strong" ? "Strong conviction" :
             evidence.verdict === "positive" ? "Positive setup" :
             evidence.verdict === "negative" ? "Negative setup" :
             evidence.verdict === "weak" ? "Weak evidence" :
             evidence.verdict === "mixed" ? "Mixed signals" : "Evidence forming"}
            {badge?.technicalState ? ` · ${badge.technicalState}` : ""}
          </h2>
          <p>{verdict}</p>
          {badge?.direction ? (
            <p className="verdict-direction">{badge.direction}</p>
          ) : null}
        </div>
        <div className={`verdict-score ${directionClass}`}>
          <strong>{evidence.score >= 0 ? `+${evidence.score}` : evidence.score}</strong>
          <span>of 100</span>
        </div>
      </div>
      <div className="verdict-meta">
        <span><b>{snapshot.evidence.confidence >= 0.65 ? "High" : snapshot.evidence.confidence >= 0.4 ? "Medium" : "Low"}</b> confidence</span>
        <span><b>{Math.round(evidence.coverage * 100)}%</b> evidence coverage</span>
        {market.session !== "regular" ? (
          <span className="verdict-session">{market.referenceLabel}: {market.referencePrice != null ? `$${market.referencePrice.toFixed(2)}` : "—"}</span>
        ) : null}
        <span>Score is evidence, not a recommendation</span>
      </div>

      {/* Signal strip */}
      <div className="signal-strip">
        {(["institutional", "insider", "earnings", "political"] as const).map((key) => {
          const signal = evidence.signals[key];
          return (
            <div className="signal-pill" key={key}>
              <span>{signal.summary.split(".")[0]}</span>
              <strong className={
                signal.sentiment === "strong_positive" || signal.sentiment === "positive" ? "positive" :
                signal.sentiment === "strong_negative" || signal.sentiment === "negative" ? "negative" :
                signal.sentiment === "neutral" ? "neutral" : "missing"
              }>
                {signal.score !== null && signal.score > 0 ? `+${signal.score}` : signal.score !== null ? signal.score : "—"}
              </strong>
            </div>
          );
        })}
      </div>

      {/* Technical summary */}
      {techState && (
        <div className="verdict-tech">
          <span className="verdict-tech-label">Technical: {technical.summary}</span>
        </div>
      )}

      {/* Model version */}
      <details className="verdict-explainer">
        <summary>How this score works</summary>
        <p>Each available signal is scored from −100 to +100. Missing feeds are excluded—not treated as neutral—and the remaining weights are normalized. A score only appears when at least half of the intended evidence is available.</p>
        <p className="verdict-version">Model v{MODEL_VERSION}</p>
      </details>
    </section>
  );
}
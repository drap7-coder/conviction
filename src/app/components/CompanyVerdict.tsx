"use client";

import { useEffect, useMemo, useState } from "react";
import { cachedFetch } from "@/lib/request-cache";
import type { EarningsEvidence } from "@/lib/earnings/types";
import { deriveTechnicalState, type StockHistoryPoint } from "@/lib/market/technical-state";
import type { StockQuote } from "@/lib/market/quotes";

type MomentumDirection = "improving" | "mixed" | "weakening" | "unavailable";

interface FetchState {
  earnings: EarningsEvidence | null;
  quote: StockQuote | null;
  history: StockHistoryPoint[];
  week52High: number | null;
  week52Low: number | null;
}

interface HistoryResponse {
  history: {
    points: StockHistoryPoint[];
    endPrice: number | null;
    fiftyTwoWeekHigh: number | null;
    fiftyTwoWeekLow: number | null;
  };
}

interface MomentumSignal {
  label: "Price" | "Earnings" | "Analysts";
  direction: MomentumDirection;
  detail: string;
}

function directionLabel(direction: MomentumDirection) {
  if (direction === "improving") return "↗ Improving";
  if (direction === "weakening") return "↘ Weakening";
  if (direction === "mixed") return "→ Mixed";
  return "— Unavailable";
}

function classifyScore(score: number | null | undefined): MomentumDirection {
  if (score === null || score === undefined) return "unavailable";
  if (score >= 15) return "improving";
  if (score <= -15) return "weakening";
  return "mixed";
}

function priceTechnicalDetail(technical: ReturnType<typeof deriveTechnicalState>) {
  let baseline = "Technical baseline unavailable";
  if (technical.sma50Relation === "above" && technical.sma200Relation === "above") {
    baseline = "Above 50D + 200D averages";
  } else if (technical.sma50Relation === "below" && technical.sma200Relation === "below") {
    baseline = "Below 50D + 200D averages";
  } else if (technical.sma50Relation && technical.sma200Relation) {
    baseline = "Between 50D + 200D averages";
  }

  return technical.shortTermTrend === null
    ? baseline
    : `${baseline} · 5D ${technical.shortTermTrend > 0 ? "+" : ""}${technical.shortTermTrend.toFixed(1)}%`;
}

function buildSummary(signals: MomentumSignal[]) {
  const available = signals.filter((signal) => signal.direction !== "unavailable");
  const directions = new Set(available.map((signal) => signal.direction));

  if (available.length === 0) {
    return {
      headline: "Momentum picture forming",
      summary: "Price, earnings, and analyst revision data are not yet available.",
    };
  }

  if (directions.size === 1 && directions.has("improving")) {
    return {
      headline: "Improving momentum",
      summary: "Price, earnings, and analyst revisions are moving in a constructive direction.",
    };
  }

  if (directions.size === 1 && directions.has("weakening")) {
    return {
      headline: "Weakening momentum",
      summary: "Price, earnings, and analyst revisions are all moving in a weaker direction.",
    };
  }

  const clauses = signals
    .filter((signal) => signal.direction !== "unavailable")
    .map((signal) => `${signal.label.toLowerCase()} is ${signal.direction}`);

  return {
    headline: "Mixed momentum",
    summary: `${clauses.join(", ").replace(/, ([^,]*)$/, ", but $1")}.`,
  };
}

export function CompanyVerdict({ ticker }: { ticker: string }) {
  const [state, setState] = useState<FetchState>({
    earnings: null,
    quote: null,
    history: [],
    week52High: null,
    week52Low: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [earningsResult, quoteResult, historyResult] = await Promise.allSettled([
          cachedFetch<EarningsEvidence>(`/api/evidence/earnings?ticker=${ticker}`, { ttl: 60 * 60 * 1000 }),
          cachedFetch<{ quotes?: StockQuote[] }>(`/api/market/quotes?tickers=${encodeURIComponent(ticker)}`, { ttl: 60 * 1000 }),
          cachedFetch<HistoryResponse>(`/api/market/history?ticker=${encodeURIComponent(ticker)}&range=1y`, { ttl: 5 * 60 * 1000 }),
        ]);

        if (cancelled) return;
        const earnings = earningsResult.status === "fulfilled" ? earningsResult.value : null;
        const quoteData = quoteResult.status === "fulfilled" ? quoteResult.value : null;
        const historyData = historyResult.status === "fulfilled" ? historyResult.value.history : null;
        const quote = (quoteData?.quotes ?? [])[0] ?? null;
        setState({
          earnings,
          quote,
          history: historyData?.points ?? [],
          week52High: historyData?.fiftyTwoWeekHigh ?? null,
          week52Low: historyData?.fiftyTwoWeekLow ?? null,
        });
      } catch {
        if (!cancelled) setState({
          earnings: null,
          quote: null,
          history: [],
          week52High: null,
          week52Low: null,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [ticker]);

  const signals = useMemo<MomentumSignal[]>(() => {
    const technical = deriveTechnicalState(
      state.history,
      state.quote?.price ?? null,
      state.week52High,
      state.week52Low,
    );
    const priceDirection: MomentumDirection =
      technical.sma50Relation === "above" && technical.sma200Relation === "above"
        ? "improving"
        : technical.sma50Relation === "below" && technical.sma200Relation === "below"
          ? "weakening"
          : technical.sma50Relation === null && technical.sma200Relation === null
            ? "unavailable"
            : "mixed";

    return [
      { label: "Price", direction: priceDirection, detail: priceTechnicalDetail(technical) },
      {
        label: "Earnings",
        direction: classifyScore(state.earnings?.historyScore),
        detail: "Recent reported results versus expectations.",
      },
      {
        label: "Analysts",
        direction: classifyScore(state.earnings?.revisionScore),
        detail: "Estimate revisions over the last four weeks.",
      },
    ];
  }, [state]);

  if (loading) {
    return (
      <section className="verdict-card" aria-label="Momentum snapshot">
        <div className="verdict-topline">
          <div>
            <span className="verdict-eyebrow">Momentum snapshot</span>
            <h2>Building the momentum picture…</h2>
            <p>Checking price trend, reported earnings, and analyst revisions.</p>
          </div>
        </div>
        <div className="signal-strip momentum-signal-strip">
          {["Price", "Earnings", "Analysts"].map((label) => (
            <div className="signal-pill momentum-signal" key={label}>
              <span>{label}</span>
              <strong className="missing">Checking</strong>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const summary = buildSummary(signals);

  return (
    <section className="verdict-card" aria-label="Momentum snapshot">
      <div className="verdict-topline">
        <div>
          <span className="verdict-eyebrow">Momentum snapshot</span>
          <h2>{summary.headline}</h2>
          <p>{summary.summary}</p>
        </div>
      </div>

      <div className="signal-strip momentum-signal-strip">
        {signals.map((signal) => (
          <div className="signal-pill momentum-signal" key={signal.label} title={signal.detail}>
            <span>{signal.label}</span>
            <strong className={signal.direction}>{directionLabel(signal.direction)}</strong>
            {signal.label === "Price" ? <small>{signal.detail}</small> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

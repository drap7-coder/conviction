"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, CalendarClock, CircleGauge, ShieldCheck, TriangleAlert } from "lucide-react";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import {
  buildCompanyDecisionBrief,
  type CompanyDecisionTone,
} from "@/lib/company/company-decision-brief";
import type { ConvictionScoreView } from "@/lib/conviction/score/view";
import type { EarningsEvidence } from "@/lib/earnings/types";
import { deriveTechnicalState } from "@/lib/market/technical-state";
import type { StockHistory } from "@/lib/market/quotes";

const TONE_LABEL: Record<CompanyDecisionTone, string> = {
  positive: "Constructive",
  mixed: "Contested",
  negative: "Defensive",
  quiet: "Still forming",
};

export function CompanyDecisionBrief({ ticker }: { ticker: string }) {
  const [score, setScore] = useState<ConvictionScoreView | null>(null);
  const [earnings, setEarnings] = useState<EarningsEvidence | null>(null);
  const [history, setHistory] = useState<StockHistory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      const [scoreResult, earningsResult, historyResult] = await Promise.all([
        fetchJsonWithTimeout<ConvictionScoreView>(
          `/api/conviction/score?ticker=${encodeURIComponent(ticker)}`,
          45_000,
          controller.signal,
        ).catch(() => null),
        fetchJsonWithTimeout<EarningsEvidence>(
          `/api/evidence/earnings?ticker=${encodeURIComponent(ticker)}`,
          15_000,
          controller.signal,
        ).catch(() => null),
        fetchJsonWithTimeout<{ history?: StockHistory }>(
          `/api/market/history?ticker=${encodeURIComponent(ticker)}&range=1y`,
          12_000,
          controller.signal,
        ).catch(() => null),
      ]);
      if (cancelled) return;
      setScore(scoreResult);
      setEarnings(earningsResult);
      setHistory(historyResult?.history ?? null);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker]);

  const brief = useMemo(() => buildCompanyDecisionBrief(score, earnings), [score, earnings]);
  const tape = useMemo(() => {
    if (!history?.points?.length) return null;
    return deriveTechnicalState(
      history.points,
      history.endPrice,
      history.fiftyTwoWeekHigh,
      history.fiftyTwoWeekLow,
    );
  }, [history]);

  return (
    <section
      className={`company-decision-brief tone-${brief.tone}${loading ? " is-loading" : ""}`}
      aria-label="Company decision snapshot"
      aria-busy={loading}
    >
      <header className="company-decision-header">
        <div>
          <span className="company-decision-eyebrow">Decision snapshot</span>
          <h2>{loading ? "Building the investment read…" : brief.headline}</h2>
        </div>
        <span className={`company-decision-status tone-${brief.tone}`}>
          <i aria-hidden="true" />
          {loading ? "Checking" : TONE_LABEL[brief.tone]}
        </span>
      </header>

      <div className="company-decision-metrics" aria-label="Key decision metrics">
        <article>
          <span>Conviction</span>
          <strong>{loading ? "—" : brief.scoreValue}</strong>
          <small>{loading ? "Combining signals" : `${brief.status} · ${brief.scoreDetail}`}</small>
        </article>
        <article>
          <span>Evidence coverage</span>
          <strong>{loading ? "—" : brief.coverageValue}</strong>
          <small>{loading ? "Checking sources" : brief.coverageDetail}</small>
          <div className="company-coverage-track" aria-hidden="true">
            <i style={{ width: loading ? "18%" : brief.coverageValue }} />
          </div>
        </article>
        <article>
          <span>Earnings setup</span>
          <strong>{loading ? "—" : brief.earningsValue}</strong>
          <small>{loading ? "Reading the latest quarter" : brief.earningsDetail}</small>
        </article>
        <article>
          <span>Tape</span>
          <strong>{loading ? "—" : (tape?.label ?? "—")}</strong>
          <small>
            {loading
              ? "Reading trend and averages"
              : (tape?.interpretation ?? "Technical history unavailable")}
          </small>
        </article>
      </div>

      <div className="company-decision-questions">
        <article className="company-decision-question support">
          <ShieldCheck aria-hidden="true" />
          <div>
            <span>What supports the read</span>
            <p>{loading ? "Finding the strongest live evidence…" : brief.support}</p>
          </div>
        </article>
        <article className="company-decision-question pressure">
          <TriangleAlert aria-hidden="true" />
          <div>
            <span>What could break it</span>
            <p>{loading ? "Finding the clearest pressure point…" : brief.pressure}</p>
          </div>
        </article>
        <article className="company-decision-question next">
          <CalendarClock aria-hidden="true" />
          <div>
            <span>Next proof point</span>
            <p>{loading ? "Checking the next evidence window…" : brief.nextCheck}</p>
          </div>
        </article>
        <article className="company-decision-question tape">
          <Activity aria-hidden="true" />
          <div>
            <span>Technical read</span>
            <p>
              {loading
                ? "Checking moving averages and short-term trend…"
                : tape
                  ? [
                      tape.sma50Relation ? `Price ${tape.sma50Relation} SMA-50` : null,
                      tape.sma200Relation ? `${tape.sma200Relation} SMA-200` : null,
                      tape.shortTermTrend !== null
                        ? `5-day ${tape.shortTermTrend >= 0 ? "+" : ""}${tape.shortTermTrend.toFixed(1)}%`
                        : null,
                    ].filter(Boolean).join(" · ") || tape.interpretation
                  : "Open Evidence → Market Signals for the full technical panel."}
            </p>
          </div>
        </article>
      </div>

      <footer className="company-decision-footer">
        <CircleGauge aria-hidden="true" />
        <span>{loading ? "Refreshing source-backed evidence" : brief.freshness}</span>
      </footer>
    </section>
  );
}

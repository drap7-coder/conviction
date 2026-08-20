"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, CalendarClock, ShieldCheck, TriangleAlert } from "lucide-react";
import { TypewriterText } from "@/components/TypewriterText";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import {
  buildCompanyDecisionBrief,
} from "@/lib/company/company-decision-brief";
import type { ConvictionScoreView } from "@/lib/conviction/score/view";
import type { EarningsEvidence } from "@/lib/earnings/types";
import { deriveTechnicalState } from "@/lib/market/technical-state";
import type { StockHistory } from "@/lib/market/quotes";

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

  const tape = useMemo(() => {
    if (!history?.points?.length) return null;
    return deriveTechnicalState(
      history.points,
      history.endPrice,
      history.fiftyTwoWeekHigh,
      history.fiftyTwoWeekLow,
    );
  }, [history]);

  const brief = useMemo(
    () => buildCompanyDecisionBrief(score, earnings, tape ? {
      label: tape.label,
      interpretation: tape.interpretation,
    } : null),
    [score, earnings, tape],
  );

  return (
    <section
      className={`company-decision-brief company-decision-brief--simple tone-${brief.tone}${loading ? " is-loading" : ""}`}
      aria-label="Today's read"
      aria-busy={loading}
    >
      <header className="company-decision-header company-decision-header--simple">
        <div>
          <span className="company-decision-eyebrow">Today&apos;s read</span>
          <h2>
            {loading ? (
              <span className="company-decision-skeleton company-decision-skeleton-headline" aria-hidden="true" />
            ) : (
              <TypewriterText
                text={brief.headline}
                as="span"
                className="company-decision-headline-typewriter"
                msPerChar={24}
                startDelay={60}
              />
            )}
          </h2>
        </div>
      </header>

      <div className="company-decision-signals" aria-label="Reliable signals">
        <article className="company-decision-signal company-decision-signal--earnings">
          <CalendarClock aria-hidden="true" />
          <div>
            <span>Earnings</span>
            {loading ? (
              <>
                <span className="company-decision-skeleton company-decision-skeleton-signal-strong" aria-hidden="true" />
                <span className="company-decision-skeleton company-decision-skeleton-line company-decision-skeleton-line--short" aria-hidden="true" />
              </>
            ) : (
              <>
                <strong className="tnum">{brief.earningsValue}</strong>
                <small>{brief.earningsDetail}</small>
              </>
            )}
          </div>
        </article>
        <article className={`company-decision-signal company-decision-signal--tape tone-${brief.tone}`}>
          <Activity aria-hidden="true" />
          <div>
            <span>Technical read</span>
            {loading ? (
              <>
                <span className="company-decision-skeleton company-decision-skeleton-signal-strong" aria-hidden="true" />
                <span className="company-decision-skeleton company-decision-skeleton-line company-decision-skeleton-line--short" aria-hidden="true" />
              </>
            ) : (
              <>
                <strong>{tape?.label ?? "—"}</strong>
                <small>{tape?.interpretation ?? "Technical history unavailable"}</small>
              </>
            )}
          </div>
        </article>
      </div>

      <div className="company-decision-questions company-decision-questions--simple" aria-label="Quick take">
        <article className="company-decision-question support">
          <ShieldCheck aria-hidden="true" />
          <div>
            <span>Supports the read</span>
            {loading ? (
              <>
                <span className="company-decision-skeleton company-decision-skeleton-line" aria-hidden="true" />
                <span className="company-decision-skeleton company-decision-skeleton-line company-decision-skeleton-line--short" aria-hidden="true" />
              </>
            ) : (
              <p>{brief.support}</p>
            )}
          </div>
        </article>
        <article className="company-decision-question pressure">
          <TriangleAlert aria-hidden="true" />
          <div>
            <span>Could break it</span>
            {loading ? (
              <>
                <span className="company-decision-skeleton company-decision-skeleton-line" aria-hidden="true" />
                <span className="company-decision-skeleton company-decision-skeleton-line company-decision-skeleton-line--short" aria-hidden="true" />
              </>
            ) : (
              <p>{brief.pressure}</p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

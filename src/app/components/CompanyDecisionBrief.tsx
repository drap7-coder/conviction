"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import { TypewriterText } from "@/components/TypewriterText";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import {
  buildCompanyDecisionBrief,
  type CompanyDecisionTone,
} from "@/lib/company/company-decision-brief";
import type { ConvictionScoreView } from "@/lib/conviction/score/view";
import type { EarningsEvidence } from "@/lib/earnings/types";

const TONE_LABEL: Record<CompanyDecisionTone, string> = {
  positive: "Constructive",
  mixed: "Contested",
  negative: "Defensive",
  quiet: "Still forming",
};

export function CompanyDecisionBrief({ ticker }: { ticker: string }) {
  const [score, setScore] = useState<ConvictionScoreView | null>(null);
  const [earnings, setEarnings] = useState<EarningsEvidence | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      const [scoreResult, earningsResult] = await Promise.all([
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
      ]);
      if (cancelled) return;
      setScore(scoreResult);
      setEarnings(earningsResult);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker]);

  const brief = useMemo(() => buildCompanyDecisionBrief(score, earnings), [score, earnings]);

  return (
    <section
      className={`company-decision-brief company-decision-brief--simple tone-${brief.tone}${loading ? " is-loading" : ""}`}
      aria-label="Today's read"
      aria-busy={loading}
    >
      <header className="company-decision-header">
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
        <span className={`company-decision-status tone-${brief.tone}`}>
          <i aria-hidden="true" />
          {loading ? "…" : TONE_LABEL[brief.tone]}
        </span>
      </header>

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

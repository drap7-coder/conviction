"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateConviction, clampScore, SIGNAL_WEIGHTS, type ConvictionSignal } from "@/lib/conviction/scoring";
import type { EarningsEvidence } from "@/lib/earnings/types";
import type { EvidenceEvent } from "@/lib/evidence/types";
import type { PoliticalTradeSummary } from "@/lib/political-trades";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";

interface EvidenceBundle {
  institutional: { results?: InstitutionalAccumulation[]; status?: string } | null;
  insider: { events?: EvidenceEvent[]; status?: string; source?: string } | null;
  earnings: EarningsEvidence | null;
  political: (PoliticalTradeSummary & { status?: string }) | null;
}

const EMPTY: EvidenceBundle = { institutional: null, insider: null, earnings: null, political: null };

async function fetchEvidence<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    return response.ok ? response.json() as Promise<T> : null;
  } catch {
    return null;
  }
}

function institutionalSignal(data: EvidenceBundle["institutional"]): ConvictionSignal {
  const usable = data && data.status !== "timeout" && data.status !== "error";
  const rows = data?.results ?? [];
  const gross = rows.reduce((sum, row) => sum + Math.max(row.shares, row.previousShares), 0);
  const net = rows.reduce((sum, row) => sum + row.shareChange, 0);
  const score = usable ? (gross ? clampScore(net / gross * 100) : 0) : null;
  return { key: "institutional", label: "Large investors", weight: SIGNAL_WEIGHTS.institutional, score,
    asOf: rows.map((row) => row.filingDate).sort().at(-1) ?? null,
    summary: score === null ? "Institutional data unavailable" : score > 10 ? "large investors are accumulating" : score < -10 ? "large investors are reducing exposure" : "large-investor activity is balanced" };
}

function insiderSignal(data: EvidenceBundle["insider"]): ConvictionSignal {
  const usable = data && data.status !== "timeout" && data.status !== "error" && data.source !== "error";
  const cutoff = Date.now() - 90 * 86_400_000;
  const events = (data?.events ?? []).filter((event) => new Date(event.date).getTime() >= cutoff && ["purchase", "sale"].includes(event.metadata?.transactionType ?? ""));
  const buys = events.filter((event) => event.metadata?.transactionType === "purchase").reduce((sum, event) => sum + (event.metadata?.totalValue ?? event.metadata?.shares ?? 0), 0);
  const sells = events.filter((event) => event.metadata?.transactionType === "sale").reduce((sum, event) => sum + (event.metadata?.totalValue ?? event.metadata?.shares ?? 0), 0);
  const score = usable ? (buys + sells ? clampScore((buys - sells) / (buys + sells) * 100) : 0) : null;
  return { key: "insider", label: "Company insiders", weight: SIGNAL_WEIGHTS.insider, score,
    asOf: events.map((event) => event.date).sort().at(-1) ?? new Date().toISOString(),
    summary: score === null ? "Insider data unavailable" : score > 10 ? "insiders are net buyers" : score < -10 ? "insiders are net sellers" : "insider activity is neutral" };
}

function earningsSignal(data: EarningsEvidence | null): ConvictionSignal {
  return { key: "earnings", label: "Earnings momentum", weight: SIGNAL_WEIGHTS.earnings,
    score: data?.status === "unavailable" ? null : data?.score ?? null, asOf: data?.asOf ?? null,
    summary: data?.score == null ? "earnings data unavailable" : data.score > 10 ? "earnings momentum is improving" : data.score < -10 ? "earnings momentum is weakening" : "earnings momentum is stable" };
}

function politicalSignal(data: EvidenceBundle["political"]): ConvictionSignal {
  const usable = data && data.status !== "timeout" && data.status !== "error";
  const buys = data?.totalEstimatedPurchases ?? 0;
  const sells = data?.totalEstimatedSales ?? 0;
  const score = usable ? (buys + sells ? clampScore((buys - sells) / (buys + sells) * 100) : 0) : null;
  return { key: "political", label: "Political disclosures", weight: SIGNAL_WEIGHTS.political, score,
    asOf: data?.latestFilingDate ?? new Date().toISOString(),
    summary: score === null ? "political data unavailable" : score > 10 ? "political disclosures lean toward buying" : score < -10 ? "political disclosures lean toward selling" : "political disclosures are neutral" };
}

function scoreLabel(score: number | null) {
  if (score === null) return "Missing";
  if (score >= 15) return "Positive";
  if (score <= -15) return "Negative";
  return "Neutral";
}

export function CompanyVerdict({ ticker }: { ticker: string }) {
  const [bundle, setBundle] = useState<EvidenceBundle>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchEvidence<EvidenceBundle["institutional"]>(`/api/evidence/institutional?ticker=${ticker}`),
      fetchEvidence<EvidenceBundle["insider"]>(`/api/evidence/insider?ticker=${ticker}`),
      fetchEvidence<EarningsEvidence>(`/api/evidence/earnings?ticker=${ticker}`),
      fetchEvidence<EvidenceBundle["political"]>(`/api/evidence/political?ticker=${ticker}`),
    ]).then(([institutional, insider, earnings, political]) => {
      if (!cancelled) { setBundle({ institutional, insider, earnings, political }); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [ticker]);

  const signals = useMemo(() => [institutionalSignal(bundle.institutional), insiderSignal(bundle.insider), earningsSignal(bundle.earnings), politicalSignal(bundle.political)], [bundle]);
  const verdict = calculateConviction(signals);

  return (
    <section className="verdict-card" aria-label="Conviction verdict">
      <div className="verdict-topline">
        <div>
          <span className="verdict-eyebrow">Decision snapshot</span>
          <h2>{loading ? "Building the evidence picture…" : verdict.direction === "insufficient" ? "Evidence still forming" : `${verdict.direction[0].toUpperCase()}${verdict.direction.slice(1)} setup`}</h2>
          <p>{loading ? "Checking filings, insider trades, earnings and political disclosures." : verdict.summary}</p>
        </div>
        <div className={`verdict-score ${verdict.direction}`}>
          <strong>{loading || verdict.score === null ? "—" : verdict.score > 0 ? `+${verdict.score}` : verdict.score}</strong>
          <span>of 100</span>
        </div>
      </div>
      <div className="verdict-meta">
        <span><b>{loading ? "…" : verdict.confidence}</b> confidence</span>
        <span><b>{loading ? "…" : `${Math.round(verdict.coverage * 100)}%`}</b> evidence coverage</span>
        <span>Score is evidence, not a recommendation</span>
      </div>
      <div className="signal-strip">
        {signals.map((signal) => (
          <div className="signal-pill" key={signal.key}>
            <span>{signal.label} · {Math.round(signal.weight * 100)}%</span>
            <strong className={signal.score === null ? "missing" : signal.score >= 15 ? "positive" : signal.score <= -15 ? "negative" : "neutral"}>{loading ? "Checking" : scoreLabel(signal.score)}</strong>
          </div>
        ))}
      </div>
      <details className="verdict-explainer">
        <summary>How this score works</summary>
        <p>Each available signal is scored from −100 to +100. Missing feeds are excluded—not treated as neutral—and the remaining weights are normalized. A score only appears when at least half of the intended evidence is available.</p>
      </details>
    </section>
  );
}

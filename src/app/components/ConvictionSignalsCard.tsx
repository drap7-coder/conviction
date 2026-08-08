"use client";

import { useEffect, useState, type ReactNode } from "react";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import { InstitutionalConvictionSection } from "@/app/components/InstitutionalConvictionSection";
import { InsiderActivitySection } from "@/app/components/InsiderActivitySection";
import { TechnicalsDetailSection } from "@/app/components/TechnicalsDetailSection";
import { ShortInterestDetailSection } from "@/app/components/ShortInterestDetailSection";
import { EarningsMomentumSection } from "@/app/components/EarningsMomentumSection";
import { PoliticalTradesSection } from "@/app/components/PoliticalTradesSection";
import { MajorOwnershipSection } from "@/app/components/MajorOwnershipSection";
import { CorporateDisclosuresSection } from "@/app/components/CorporateDisclosuresSection";
import {
  isInsiderQuietMessage,
  signalToneFromScore,
  type ConvictionSignalCategory,
  type ConvictionSignalDisplay,
  type ConvictionSignalTone,
} from "@/lib/conviction/signal-display";
import type { ConvictionScoreView } from "@/lib/conviction/score/view";
import type { EarningsEvidence } from "@/lib/earnings/types";

type EvidenceLaneId =
  | ConvictionSignalCategory
  | "earnings"
  | "political"
  | "ownership"
  | "disclosures";

type EvidenceLane = {
  id: EvidenceLaneId;
  label: string;
  tone: ConvictionSignalTone;
  status: ConvictionSignalDisplay["status"];
  headline: string;
};

const CORE_LABELS: Record<ConvictionSignalCategory, string> = {
  institutional: "Institutional",
  insider: "Insider",
  technicals: "Technicals",
  short_interest: "Short interest",
};

const CORE_ORDER = Object.keys(CORE_LABELS) as ConvictionSignalCategory[];

const FILING_LANES: Array<{ id: Exclude<EvidenceLaneId, ConvictionSignalCategory>; label: string }> = [
  { id: "earnings", label: "Earnings" },
  { id: "political", label: "Political" },
  { id: "ownership", label: "Ownership" },
  { id: "disclosures", label: "Filings" },
];

/** Keep row copy short — full evidence expands inline. */
function compactHeadline(category: ConvictionSignalCategory, headline: string): string {
  const text = headline.replace(/\s+/g, " ").trim();

  if (category === "insider" && /no open-market/i.test(text)) {
    return "No open-market buying";
  }
  if (category === "technicals") {
    if (/fallen below the short-term/i.test(text) && /above the long-term/i.test(text)) {
      return "Below SMA50, above SMA200";
    }
    if (/above the short-term/i.test(text) && /above the long-term/i.test(text)) {
      return "Above SMA50 and SMA200";
    }
    if (/below the short-term/i.test(text) && /below the long-term/i.test(text)) {
      return "Below SMA50 and SMA200";
    }
  }
  if (category === "short_interest") {
    const change = text.match(/([+-]?\d+(?:\.\d+)%)/);
    const dtc = text.match(/([\d.]+)\s*days to cover/i);
    if (change && dtc) {
      const direction = /fell|eased/i.test(text) ? "fell" : /rose|climb/i.test(text) ? "rose" : "changed";
      return `SI ${direction} ${change[1]} · ${dtc[1]} DTC`;
    }
  }
  if (text.length <= 72) return text;
  return `${text.slice(0, 71).trimEnd()}…`;
}

function clipFact(text: string, max = 72): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trimEnd()}…`;
}

function unavailableCore(
  category: ConvictionSignalCategory,
  headline: string,
  status: "loading" | "unavailable" = "unavailable",
): ConvictionSignalDisplay {
  return {
    category,
    label: CORE_LABELS[category],
    tone: "unavailable",
    status,
    headline,
    detail: headline,
    strength: 0,
  };
}

function initialCoreSignals(): ConvictionSignalDisplay[] {
  return CORE_ORDER.map((category) =>
    unavailableCore(category, "Checking…", "loading"),
  );
}

function coreFromView(view: ConvictionScoreView): ConvictionSignalDisplay[] {
  const byCategory = new Map(view.categories.map((category) => [category.category, category]));

  return CORE_ORDER.map((category) => {
    const source = byCategory.get(category);
    if (!source) {
      return unavailableCore(category, "Unavailable");
    }

    if (
      category === "insider"
      && !source.hasData
      && isInsiderQuietMessage(source.explanation)
    ) {
      return {
        category,
        label: CORE_LABELS[category],
        tone: "neutral",
        status: "quiet",
        headline: "No open-market buying",
        detail: "Purchases only — sales ignored.",
        strength: 8,
      };
    }

    const status = !source.hasData
      ? "unavailable"
      : source.isStale ? "stale" : "available";

    return {
      category,
      label: CORE_LABELS[category],
      tone: signalToneFromScore(source.score, source.hasData, source.isStale),
      status,
      headline: compactHeadline(category, source.explanation || "No detail"),
      detail: source.explanation,
      strength: source.hasData ? Math.abs(source.score) : 0,
    };
  });
}

function toneClass(tone: ConvictionSignalTone, status: EvidenceLane["status"]): string {
  if (status === "quiet") return "quiet";
  if (status === "unavailable" || status === "loading") return "unavailable";
  if (status === "stale") return "stale";
  return tone;
}

/** Quiet status word — directional, not a scoreboard grade. */
function laneStatusWord(lane: EvidenceLane): string {
  if (lane.status === "loading") return "…";
  if (lane.status === "stale") return "Stale";
  if (lane.status === "quiet") return "Quiet";
  if (lane.status === "unavailable") return "—";
  if (lane.tone === "positive") return "Support";
  if (lane.tone === "negative") return "Pressure";
  return "Mixed";
}

function initialFilingLanes(): EvidenceLane[] {
  return FILING_LANES.map((lane) => ({
    id: lane.id,
    label: lane.label,
    tone: "unavailable",
    status: "loading",
    headline: "Checking…",
  }));
}

function formatShortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

async function loadFilingLanes(
  ticker: string,
  signal: AbortSignal,
): Promise<EvidenceLane[]> {
  const [earnings, political, ownership, disclosures] = await Promise.all([
    fetchJsonWithTimeout<EarningsEvidence>(
      `/api/evidence/earnings?ticker=${encodeURIComponent(ticker)}`,
      12_000,
      signal,
    ).catch(() => null),
    fetchJsonWithTimeout<{
      status?: string;
      trades?: Array<{ direction?: string }>;
      purchases?: unknown[];
      sales?: unknown[];
      latestFilingDate?: string | null;
      message?: string;
    }>(
      `/api/evidence/political?ticker=${encodeURIComponent(ticker)}`,
      12_000,
      signal,
    ).catch(() => null),
    fetchJsonWithTimeout<{
      status?: string;
      filings?: Array<{ title: string; form: string; filingDate: string }>;
      latestFiling?: { title: string; form: string; filingDate: string } | null;
      message?: string;
    }>(
      `/api/evidence/ownership?ticker=${encodeURIComponent(ticker)}`,
      12_000,
      signal,
    ).catch(() => null),
    fetchJsonWithTimeout<{
      status?: string;
      latestDisclosure?: {
        title: string;
        form: string;
        filingDate: string;
        direction?: string;
      } | null;
      disclosures?: unknown[];
    }>(
      `/api/evidence/disclosures?ticker=${encodeURIComponent(ticker)}`,
      12_000,
      signal,
    ).catch(() => null),
  ]);

  const earningsLane = ((): EvidenceLane => {
    const base = { id: "earnings" as const, label: "Earnings" };
    if (!earnings || earnings.status === "unavailable") {
      return { ...base, tone: "unavailable", status: "unavailable", headline: "No recent results" };
    }
    const latest = earnings.history[0];
    const next = formatShortDate(earnings.nextEarningsDate);
    let headline = earnings.momentum !== "Unavailable" ? earnings.momentum : "Results on file";
    if (latest) {
      const beat = latest.actualEps >= latest.estimatedEps;
      headline = `${latest.fiscalQuarter} ${beat ? "beat" : "miss"} · ${latest.surprisePercent >= 0 ? "+" : ""}${latest.surprisePercent.toFixed(1)}%`;
    } else if (next) {
      headline = `Next print ${next}`;
    }
    const tone: ConvictionSignalTone =
      earnings.momentum === "Estimates rising" ? "positive"
        : earnings.momentum === "Estimates falling" ? "negative"
          : "neutral";
    return { ...base, tone, status: "available", headline: clipFact(headline) };
  })();

  const politicalLane = ((): EvidenceLane => {
    const base = { id: "political" as const, label: "Political" };
    const trades = political?.trades ?? [];
    if (!political || political.status === "error" || political.status === "timeout") {
      return { ...base, tone: "unavailable", status: "unavailable", headline: "Feed unavailable" };
    }
    if (trades.length === 0) {
      return { ...base, tone: "neutral", status: "quiet", headline: "No recent matches" };
    }
    const buys = political.purchases?.length ?? 0;
    const sells = political.sales?.length ?? 0;
    const filed = formatShortDate(political.latestFilingDate);
    const headline = buys > 0
      ? `${buys} disclosed purchase${buys === 1 ? "" : "s"}${filed ? ` · ${filed}` : ""}`
      : `${trades.length} disclosed trade${trades.length === 1 ? "" : "s"}${filed ? ` · ${filed}` : ""}`;
    const tone: ConvictionSignalTone = buys > sells ? "positive" : sells > buys ? "negative" : "neutral";
    return { ...base, tone, status: "available", headline: clipFact(headline) };
  })();

  const ownershipLane = ((): EvidenceLane => {
    const base = { id: "ownership" as const, label: "Ownership" };
    const latest = ownership?.latestFiling ?? ownership?.filings?.[0] ?? null;
    if (!ownership || ownership.status === "error" || ownership.status === "timeout" || ownership.status === "unsupported") {
      return { ...base, tone: "unavailable", status: "unavailable", headline: "Filings unavailable" };
    }
    if (!latest) {
      return { ...base, tone: "neutral", status: "quiet", headline: "No recent 13D / 13G" };
    }
    const filed = formatShortDate(latest.filingDate);
    return {
      ...base,
      tone: "neutral",
      status: "available",
      headline: clipFact(`${latest.form}${filed ? ` · ${filed}` : ""} · ${latest.title}`),
    };
  })();

  const disclosuresLane = ((): EvidenceLane => {
    const base = { id: "disclosures" as const, label: "Filings" };
    const latest = disclosures?.latestDisclosure ?? null;
    if (!disclosures || disclosures.status === "error" || disclosures.status === "timeout") {
      return { ...base, tone: "unavailable", status: "unavailable", headline: "SEC unavailable" };
    }
    if (!latest) {
      return { ...base, tone: "neutral", status: "quiet", headline: "No recent 8-K / events" };
    }
    const filed = formatShortDate(latest.filingDate);
    const tone: ConvictionSignalTone = latest.direction === "supporting" ? "positive" : "neutral";
    return {
      ...base,
      tone,
      status: "available",
      headline: clipFact(`${latest.form}${filed ? ` · ${filed}` : ""} · ${latest.title}`),
    };
  })();

  return [earningsLane, politicalLane, ownershipLane, disclosuresLane];
}

function laneDetail(id: EvidenceLaneId, ticker: string): ReactNode {
  switch (id) {
    case "institutional":
      return <InstitutionalConvictionSection ticker={ticker} priority="primary" hideHeader />;
    case "insider":
      return <InsiderActivitySection ticker={ticker} hideHeader />;
    case "technicals":
      return <TechnicalsDetailSection ticker={ticker} />;
    case "short_interest":
      return <ShortInterestDetailSection ticker={ticker} />;
    case "earnings":
      return <EarningsMomentumSection ticker={ticker} hideHeader />;
    case "political":
      return <PoliticalTradesSection ticker={ticker} hideHeader />;
    case "ownership":
      return <MajorOwnershipSection ticker={ticker} />;
    case "disclosures":
      return <CorporateDisclosuresSection ticker={ticker} hideHeader />;
    default:
      return null;
  }
}

export function ConvictionSignalsCard({
  ticker,
}: {
  ticker: string;
}) {
  const [core, setCore] = useState<ConvictionSignalDisplay[]>(initialCoreSignals);
  const [filingLanes, setFilingLanes] = useState<EvidenceLane[]>(initialFilingLanes);
  const [coreLoading, setCoreLoading] = useState(true);
  const [openLane, setOpenLane] = useState<EvidenceLaneId | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setCore(initialCoreSignals());
    setFilingLanes(initialFilingLanes());
    setCoreLoading(true);
    setOpenLane(null);

    async function loadCore() {
      try {
        const view = await fetchJsonWithTimeout<ConvictionScoreView>(
          `/api/conviction/score?ticker=${encodeURIComponent(ticker)}`,
          45_000,
          controller.signal,
        );
        if (!cancelled) setCore(coreFromView(view));
      } catch {
        if (!cancelled) {
          setCore(CORE_ORDER.map((category) =>
            unavailableCore(category, "Could not load"),
          ));
        }
      } finally {
        if (!cancelled) setCoreLoading(false);
      }
    }

    async function loadFilings() {
      try {
        const lanes = await loadFilingLanes(ticker, controller.signal);
        if (!cancelled) setFilingLanes(lanes);
      } catch {
        if (!cancelled) {
          setFilingLanes(FILING_LANES.map((lane) => ({
            id: lane.id,
            label: lane.label,
            tone: "unavailable",
            status: "unavailable",
            headline: "Could not load",
          })));
        }
      }
    }

    void loadCore();
    void loadFilings();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker]);

  const lanes: EvidenceLane[] = [
    ...core.map((signal) => ({
      id: signal.category as EvidenceLaneId,
      label: signal.label,
      tone: signal.tone,
      status: signal.status,
      headline: signal.headline,
    })),
    ...filingLanes,
  ];

  const anyLoading = coreLoading || filingLanes.some((lane) => lane.status === "loading");

  return (
    <section className="company-driver-module evidence-lanes" aria-label="Evidence">
      <div className="company-driver-header">
        <h2 className="company-driver-title">Evidence</h2>
        <span className={`evidence-lanes-meta${anyLoading ? " is-updating" : ""}`}>
          {anyLoading ? "Updating" : "Live"}
        </span>
      </div>

      <div className="evidence-lanes-shell">
        <ul className="evidence-lane-list">
          {lanes.map((lane) => {
            const isOpen = openLane === lane.id;
            const isLoadingRow = lane.status === "loading";
            return (
              <li key={lane.id}>
                <details
                  className={`evidence-lane tone-${toneClass(lane.tone, lane.status)}${isLoadingRow ? " is-loading" : ""}`}
                  open={isOpen}
                >
                  <summary
                    className="evidence-lane-summary"
                    onClick={(event) => {
                      event.preventDefault();
                      if (isLoadingRow) return;
                      setOpenLane((current) => (current === lane.id ? null : lane.id));
                    }}
                  >
                    <span className="evidence-lane-name">{lane.label}</span>
                    <span className="evidence-lane-status">{laneStatusWord(lane)}</span>
                    <span className="evidence-lane-chevron" aria-hidden="true">›</span>
                    {isLoadingRow ? (
                      <span className="evidence-lane-fact evidence-lane-fact-skeleton" />
                    ) : (
                      <span className="evidence-lane-fact">{lane.headline}</span>
                    )}
                  </summary>
                  <div className="evidence-lane-panel">
                    {isOpen ? laneDetail(lane.id, ticker) : null}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

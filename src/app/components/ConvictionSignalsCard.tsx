"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import {
  evidenceSemantic,
  evidenceStatusLabel,
  EVIDENCE_LANE_META,
  plainLanguageLaneCopy,
  type EvidenceLaneId,
  type EvidenceSemantic,
} from "@/lib/conviction/evidence-display";
import type { ConvictionScoreView } from "@/lib/conviction/score/view";
import type { EarningsEvidence } from "@/lib/earnings/types";

type EvidenceLane = {
  id: EvidenceLaneId;
  label: string;
  tone: ConvictionSignalTone;
  status: ConvictionSignalDisplay["status"];
  semantic: EvidenceSemantic | "loading" | "unavailable";
  primary: string;
  secondary?: string | null;
};

/** Decision owns the verdict. These are the only default source lanes. */
const CORE_ORDER: ConvictionSignalCategory[] = [
  "institutional",
  "insider",
  "technicals",
  "short_interest",
];

function compactCoreHeadline(category: ConvictionSignalCategory, headline: string): string {
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
  return text;
}

function unavailableCore(
  category: ConvictionSignalCategory,
  headline: string,
  status: "loading" | "unavailable" = "unavailable",
): ConvictionSignalDisplay {
  return {
    category,
    label: EVIDENCE_LANE_META[category].label,
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
    if (!source) return unavailableCore(category, "Unavailable");

    if (
      category === "insider"
      && !source.hasData
      && isInsiderQuietMessage(source.explanation)
    ) {
      return {
        category,
        label: EVIDENCE_LANE_META[category].label,
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
      label: EVIDENCE_LANE_META[category].label,
      tone: signalToneFromScore(source.score, source.hasData, source.isStale),
      status,
      headline: compactCoreHeadline(category, source.explanation || "No detail"),
      detail: source.explanation,
      strength: source.hasData ? Math.abs(source.score) : 0,
    };
  });
}

function formatShortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function toLane(
  id: EvidenceLaneId,
  tone: ConvictionSignalTone,
  status: ConvictionSignalDisplay["status"],
  rawHeadline: string,
  copyOptions?: Parameters<typeof plainLanguageLaneCopy>[2],
): EvidenceLane {
  const meta = EVIDENCE_LANE_META[id];
  const semantic = evidenceSemantic({ tone, status });
  const copy = status === "loading"
    ? { primary: "Checking…", secondary: null }
    : plainLanguageLaneCopy(id, rawHeadline, copyOptions);
  return {
    id,
    label: meta.label,
    tone,
    status,
    semantic,
    primary: copy.primary,
    secondary: copy.secondary,
  };
}

async function loadEarningsLane(
  ticker: string,
  signal: AbortSignal,
): Promise<EvidenceLane> {
  const earnings = await fetchJsonWithTimeout<EarningsEvidence>(
    `/api/evidence/earnings?ticker=${encodeURIComponent(ticker)}`,
    12_000,
    signal,
  ).catch(() => null);

  if (!earnings || earnings.status === "unavailable") {
    return toLane("earnings", "unavailable", "unavailable", "No recent results");
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
  return toLane("earnings", tone, "available", headline);
}

/** Optional filings — only surface when something material is on file. */
async function loadOptionalFilingLanes(
  ticker: string,
  signal: AbortSignal,
): Promise<EvidenceLane[]> {
  const [political, ownership, disclosures] = await Promise.all([
    fetchJsonWithTimeout<{
      status?: string;
      trades?: Array<{ direction?: string }>;
      purchases?: unknown[];
      sales?: unknown[];
      latestFilingDate?: string | null;
    }>(
      `/api/evidence/political?ticker=${encodeURIComponent(ticker)}`,
      12_000,
      signal,
    ).catch(() => null),
    fetchJsonWithTimeout<{
      status?: string;
      filings?: Array<{ title: string; form: string; filingDate: string }>;
      latestFiling?: { title: string; form: string; filingDate: string } | null;
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
    }>(
      `/api/evidence/disclosures?ticker=${encodeURIComponent(ticker)}`,
      12_000,
      signal,
    ).catch(() => null),
  ]);

  const lanes: EvidenceLane[] = [];

  const trades = political?.trades ?? [];
  if (political && political.status !== "error" && political.status !== "timeout" && trades.length > 0) {
    const buys = political.purchases?.length ?? 0;
    const sells = political.sales?.length ?? 0;
    const filed = formatShortDate(political.latestFilingDate);
    const headline = buys > 0
      ? `${buys} disclosed purchase${buys === 1 ? "" : "s"}${filed ? ` · ${filed}` : ""}`
      : `${trades.length} disclosed trade${trades.length === 1 ? "" : "s"}${filed ? ` · ${filed}` : ""}`;
    const tone: ConvictionSignalTone = buys > sells ? "positive" : sells > buys ? "negative" : "neutral";
    lanes.push(toLane("political", tone, "available", headline));
  }

  const latestOwnership = ownership?.latestFiling ?? ownership?.filings?.[0] ?? null;
  if (
    ownership
    && ownership.status !== "error"
    && ownership.status !== "timeout"
    && ownership.status !== "unsupported"
    && latestOwnership
  ) {
    const filed = formatShortDate(latestOwnership.filingDate);
    lanes.push(toLane("ownership", "neutral", "available", latestOwnership.title, {
      form: latestOwnership.form,
      filingDate: filed,
      ownershipTitle: latestOwnership.title,
    }));
  }

  const latestDisclosure = disclosures?.latestDisclosure ?? null;
  if (disclosures && disclosures.status !== "error" && disclosures.status !== "timeout" && latestDisclosure) {
    const filed = formatShortDate(latestDisclosure.filingDate);
    const tone: ConvictionSignalTone = latestDisclosure.direction === "supporting" ? "positive" : "neutral";
    lanes.push(toLane("disclosures", tone, "available", latestDisclosure.title, {
      form: latestDisclosure.form,
      filingDate: filed,
      ownershipTitle: latestDisclosure.title,
    }));
  }

  return lanes;
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

/**
 * Source deep-dive under Decision — flat expandable lanes, no second verdict board.
 */
export function ConvictionSignalsCard({
  ticker,
}: {
  ticker: string;
  logoUrl?: string | null;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [core, setCore] = useState<ConvictionSignalDisplay[]>(initialCoreSignals);
  const [earningsLane, setEarningsLane] = useState<EvidenceLane | null>(null);
  const [optionalLanes, setOptionalLanes] = useState<EvidenceLane[]>([]);
  const [coreLoading, setCoreLoading] = useState(false);
  const [loadedTicker, setLoadedTicker] = useState<string | null>(null);
  const [openLane, setOpenLane] = useState<EvidenceLaneId | null>(null);

  useEffect(() => {
    setLoadedTicker(null);
    setExpanded(false);
    setOpenLane(null);
    if (detailsRef.current) detailsRef.current.open = false;
  }, [ticker]);

  useEffect(() => {
    if (!expanded || loadedTicker === ticker) return;

    let cancelled = false;
    const controller = new AbortController();
    setCore(initialCoreSignals());
    setEarningsLane(null);
    setOptionalLanes([]);
    setCoreLoading(true);
    setOpenLane(null);

    async function load() {
      const [score, earnings, optional] = await Promise.all([
        fetchJsonWithTimeout<ConvictionScoreView>(
          `/api/conviction/score?ticker=${encodeURIComponent(ticker)}`,
          45_000,
          controller.signal,
        ).catch(() => null),
        loadEarningsLane(ticker, controller.signal),
        loadOptionalFilingLanes(ticker, controller.signal),
      ]);
      if (cancelled) return;
      setCore(score ? coreFromView(score) : CORE_ORDER.map((category) => unavailableCore(category, "Unavailable")));
      setEarningsLane(earnings);
      setOptionalLanes(optional);
      setCoreLoading(false);
      setLoadedTicker(ticker);
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [expanded, loadedTicker, ticker]);

  const lanes = useMemo(() => {
    const fromCore = core.map((signal) =>
      toLane(signal.category, signal.tone, signal.status, signal.headline),
    );
    const ordered: EvidenceLane[] = [];
    // Fixed machine order: ownership flow → earnings → tape → risk.
    for (const id of ["institutional", "insider", "earnings", "technicals", "short_interest"] as const) {
      if (id === "earnings") {
        if (earningsLane) ordered.push(earningsLane);
        continue;
      }
      const lane = fromCore.find((item) => item.id === id);
      if (lane) ordered.push(lane);
    }
    return [...ordered, ...optionalLanes];
  }, [core, earningsLane, optionalLanes]);

  const openDetail = openLane ? lanes.find((lane) => lane.id === openLane) ?? null : null;

  return (
    <details
      ref={detailsRef}
      id="sources"
      className="company-sources-disclosure company-driver-module evidence-sources"
      onToggle={(event) => setExpanded((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="company-sources-summary">
        <span className="company-sources-summary-label">See filing detail</span>
        <span className="company-sources-summary-copy">
          Institutional, insider, earnings, and tape — expand only when you need the underlying evidence.
        </span>
      </summary>

      <div className="company-sources-body" aria-label="Source deep-dive">
      <ul className="evidence-source-list">
        {lanes.map((lane) => {
          const isOpen = openLane === lane.id;
          const isLoadingRow = lane.status === "loading" || (coreLoading && CORE_ORDER.includes(lane.id as ConvictionSignalCategory));
          const tone = lane.semantic === "loading" || lane.semantic === "unavailable"
            ? "quiet"
            : lane.semantic;
          return (
            <li key={lane.id}>
              <button
                type="button"
                className={`evidence-source-row tone-${tone}${isOpen ? " is-open" : ""}${isLoadingRow ? " is-loading" : ""}`}
                disabled={isLoadingRow}
                aria-expanded={isOpen}
                onClick={() => setOpenLane((current) => (current === lane.id ? null : lane.id))}
              >
                <span className="evidence-source-label">{lane.label}</span>
                <span className="evidence-source-fact">
                  {isLoadingRow ? "Checking…" : lane.primary}
                  {!isLoadingRow && lane.secondary ? <small>{lane.secondary}</small> : null}
                </span>
                <span className={`evidence-status-pill tone-${tone}`}>
                  {evidenceStatusLabel(lane.semantic)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {openDetail && openLane ? (
        <div className="evidence-source-detail" aria-label={`${openDetail.label} detail`}>
          <div className="evidence-source-detail-bar">
            <strong>{openDetail.label}</strong>
            <button
              type="button"
              className="evidence-source-detail-close"
              onClick={() => setOpenLane(null)}
            >
              Close
            </button>
          </div>
          <div className="evidence-lane-panel evidence-source-detail-body">
            {laneDetail(openLane, ticker)}
          </div>
        </div>
      ) : null}
      </div>
    </details>
  );
}

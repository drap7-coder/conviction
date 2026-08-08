"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  compositeEvidenceLabel,
  countEvidenceSemantics,
  evidenceSemantic,
  evidenceStatusLabel,
  EVIDENCE_GROUPS,
  EVIDENCE_LANE_META,
  plainLanguageLaneCopy,
  synthesizeEvidenceRead,
  type EvidenceLaneId,
  type EvidenceSemantic,
} from "@/lib/conviction/evidence-display";
import type { ConvictionScoreView } from "@/lib/conviction/score/view";
import type { EarningsEvidence } from "@/lib/earnings/types";

type EvidenceLane = {
  id: EvidenceLaneId;
  label: string;
  icon: string;
  tone: ConvictionSignalTone;
  status: ConvictionSignalDisplay["status"];
  semantic: EvidenceSemantic | "loading" | "unavailable";
  primary: string;
  secondary?: string | null;
};

const CORE_ORDER: ConvictionSignalCategory[] = [
  "institutional",
  "insider",
  "technicals",
  "short_interest",
];

const FILING_ORDER: Array<Exclude<EvidenceLaneId, ConvictionSignalCategory>> = [
  "earnings",
  "political",
  "ownership",
  "disclosures",
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
    icon: meta.icon,
    tone,
    status,
    semantic,
    primary: copy.primary,
    secondary: copy.secondary,
  };
}

function initialFilingLanes(): EvidenceLane[] {
  return FILING_ORDER.map((id) =>
    toLane(id, "unavailable", "loading", "Checking…"),
  );
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

  const earningsLane = ((): EvidenceLane => {
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
  })();

  const politicalLane = ((): EvidenceLane => {
    const trades = political?.trades ?? [];
    if (!political || political.status === "error" || political.status === "timeout") {
      return toLane("political", "unavailable", "unavailable", "Feed unavailable");
    }
    if (trades.length === 0) {
      return toLane("political", "neutral", "quiet", "No recent matches");
    }
    const buys = political.purchases?.length ?? 0;
    const sells = political.sales?.length ?? 0;
    const filed = formatShortDate(political.latestFilingDate);
    const headline = buys > 0
      ? `${buys} disclosed purchase${buys === 1 ? "" : "s"}${filed ? ` · ${filed}` : ""}`
      : `${trades.length} disclosed trade${trades.length === 1 ? "" : "s"}${filed ? ` · ${filed}` : ""}`;
    const tone: ConvictionSignalTone = buys > sells ? "positive" : sells > buys ? "negative" : "neutral";
    return toLane("political", tone, "available", headline);
  })();

  const ownershipLane = ((): EvidenceLane => {
    const latest = ownership?.latestFiling ?? ownership?.filings?.[0] ?? null;
    if (!ownership || ownership.status === "error" || ownership.status === "timeout" || ownership.status === "unsupported") {
      return toLane("ownership", "unavailable", "unavailable", "Filings unavailable");
    }
    if (!latest) {
      return toLane("ownership", "neutral", "quiet", "No recent 13D / 13G");
    }
    const filed = formatShortDate(latest.filingDate);
    return toLane("ownership", "neutral", "available", latest.title, {
      form: latest.form,
      filingDate: filed,
      ownershipTitle: latest.title,
    });
  })();

  const disclosuresLane = ((): EvidenceLane => {
    const latest = disclosures?.latestDisclosure ?? null;
    if (!disclosures || disclosures.status === "error" || disclosures.status === "timeout") {
      return toLane("disclosures", "unavailable", "unavailable", "SEC unavailable");
    }
    if (!latest) {
      return toLane("disclosures", "neutral", "quiet", "No recent 8-K / events");
    }
    const filed = formatShortDate(latest.filingDate);
    const tone: ConvictionSignalTone = latest.direction === "supporting" ? "positive" : "neutral";
    return toLane("disclosures", tone, "available", latest.title, {
      form: latest.form,
      filingDate: filed,
      ownershipTitle: latest.title,
    });
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

function CompositeReadCard({
  lanes,
  loading,
}: {
  lanes: EvidenceLane[];
  loading: boolean;
}) {
  const counts = useMemo(
    () => countEvidenceSemantics(lanes.map((lane) => lane.semantic)),
    [lanes],
  );
  const overall = compositeEvidenceLabel(counts);
  const synthesis = useMemo(
    () => (loading
      ? "Reading ownership, filings, and market evidence…"
      : synthesizeEvidenceRead(lanes)),
    [lanes, loading],
  );

  return (
    <div className={`evidence-composite ink-box ink-box--quiet tone-${overall}`}>
      <div className="evidence-composite-top">
        <span className="evidence-composite-eyebrow">Composite read</span>
        <span className={`evidence-status-pill tone-${overall}`}>
          {evidenceStatusLabel(overall)}
        </span>
      </div>

      <div
        className="evidence-composite-bar"
        role="img"
        aria-label={`${counts.support} support, ${counts.mixed} mixed, ${counts.against} against, ${counts.quiet} quiet`}
      >
        {counts.support > 0 ? (
          <i className="seg-support" style={{ flex: `${counts.support} 1 0` }} />
        ) : null}
        {counts.mixed > 0 ? (
          <i className="seg-mixed" style={{ flex: `${counts.mixed} 1 0` }} />
        ) : null}
        {counts.against > 0 ? (
          <i className="seg-against" style={{ flex: `${counts.against} 1 0` }} />
        ) : null}
        {counts.quiet > 0 ? (
          <i className="seg-quiet" style={{ flex: `${counts.quiet} 1 0` }} />
        ) : null}
      </div>

      <div className="evidence-composite-legend">
        {counts.support > 0 ? (
          <span><i className="dot-support" />{counts.support} support</span>
        ) : null}
        {counts.mixed > 0 ? (
          <span><i className="dot-mixed" />{counts.mixed} mixed</span>
        ) : null}
        {counts.against > 0 ? (
          <span><i className="dot-against" />{counts.against} against</span>
        ) : null}
        {counts.quiet > 0 ? (
          <span><i className="dot-quiet" />{counts.quiet} quiet</span>
        ) : null}
      </div>

      <p className="evidence-composite-synthesis">{synthesis}</p>
    </div>
  );
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
          setFilingLanes(FILING_ORDER.map((id) =>
            toLane(id, "unavailable", "unavailable", "Could not load"),
          ));
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

  const lanesById = useMemo(() => {
    const map = new Map<EvidenceLaneId, EvidenceLane>();
    for (const signal of core) {
      map.set(
        signal.category,
        toLane(signal.category, signal.tone, signal.status, signal.headline),
      );
    }
    for (const lane of filingLanes) {
      map.set(lane.id, lane);
    }
    return map;
  }, [core, filingLanes]);

  const allLanes = useMemo(
    () => EVIDENCE_GROUPS.flatMap((group) =>
      group.laneIds.map((id) => lanesById.get(id)).filter((lane): lane is EvidenceLane => Boolean(lane)),
    ),
    [lanesById],
  );

  const anyLoading = coreLoading || filingLanes.some((lane) => lane.status === "loading");

  return (
    <section className="company-driver-module evidence-lanes" aria-label="Evidence">
      <div className="company-driver-header">
        <h2 className="company-driver-title evidence-lanes-title">Evidence</h2>
        <span className={`evidence-live-pill${anyLoading ? " is-updating" : ""}`}>
          <i aria-hidden="true" />
          {anyLoading ? "Updating" : "Live"}
        </span>
      </div>

      <CompositeReadCard lanes={allLanes} loading={anyLoading} />

      <div className="evidence-groups">
        {EVIDENCE_GROUPS.map((group) => {
          const groupLanes = group.laneIds
            .map((id) => lanesById.get(id))
            .filter((lane): lane is EvidenceLane => Boolean(lane));
          if (groupLanes.length === 0) return null;

          return (
            <section className="evidence-group" key={group.id} aria-label={group.label}>
              <h3 className="evidence-group-label">{group.label}</h3>
              <ul className="evidence-lane-list">
                {groupLanes.map((lane) => {
                  const isOpen = openLane === lane.id;
                  const isLoadingRow = lane.status === "loading";
                  const tone = lane.semantic === "loading" || lane.semantic === "unavailable"
                    ? "quiet"
                    : lane.semantic;
                  return (
                    <li key={lane.id}>
                      <details
                        className={`evidence-lane tone-${tone}${isLoadingRow ? " is-loading" : ""}`}
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
                          <span className="evidence-lane-icon" aria-hidden="true">{lane.icon}</span>
                          <span className="evidence-lane-main">
                            <span className="evidence-lane-title-row">
                              <span className="evidence-lane-name">{lane.label}</span>
                              <span className={`evidence-status-pill tone-${tone}`}>
                                {evidenceStatusLabel(lane.semantic)}
                              </span>
                            </span>
                            {isLoadingRow ? (
                              <span className="evidence-lane-fact evidence-lane-fact-skeleton" />
                            ) : (
                              <span className="evidence-lane-copy">
                                <span className="evidence-lane-fact">{lane.primary}</span>
                                {lane.secondary ? (
                                  <span className="evidence-lane-secondary">{lane.secondary}</span>
                                ) : null}
                              </span>
                            )}
                          </span>
                          <span className="evidence-lane-chevron" aria-hidden="true">›</span>
                        </summary>
                        <div className="evidence-lane-panel">
                          {isOpen ? laneDetail(lane.id, ticker) : null}
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </section>
  );
}

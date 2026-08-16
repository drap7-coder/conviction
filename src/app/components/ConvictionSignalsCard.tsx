"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, CircleHelp, Radio, ShieldAlert } from "lucide-react";
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
import { buildEvidenceDecisionView } from "@/lib/conviction/evidence-decision";
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
  ticker,
  logoUrl,
}: {
  lanes: EvidenceLane[];
  loading: boolean;
  ticker: string;
  logoUrl: string | null;
}) {
  const counts = useMemo(
    () => countEvidenceSemantics(lanes.map((lane) => lane.semantic)),
    [lanes],
  );
  const overall = compositeEvidenceLabel(counts);
  const decision = useMemo(() => buildEvidenceDecisionView(lanes), [lanes]);
  const synthesis = useMemo(() => (
    loading
      ? "Reading ownership, filings, fundamentals, and market evidence…"
      : synthesizeEvidenceRead(lanes)
  ), [lanes, loading]);
  const unresolvedCopy = decision.unresolved
    ? `${decision.unresolved.label} — ${decision.unresolved.primary}`
    : decision.gapLabels.length > 0
      ? `Waiting on ${decision.gapLabels.join(", ")}`
      : "No major unresolved lane in the current stack.";

  return (
    <div className={`evidence-composite evidence-decision-board ink-box ink-box--quiet tone-${decision.stance}`}>
      <div className="evidence-decision-hero">
        <div className="evidence-composite-lead">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="evidence-composite-logo" />
          ) : (
            <div className="evidence-composite-logo-fallback" aria-hidden="true">
              {ticker.charAt(0)}
            </div>
          )}
          <div className="evidence-decision-copy">
            <span>Signal verdict</span>
            <h3>{loading ? "Building the evidence map…" : decision.headline}</h3>
            <p>{loading ? synthesis : decision.explanation}</p>
          </div>
        </div>
        <span className={`evidence-status-pill tone-${loading ? overall : decision.stance}`}>
          {loading ? "Checking" : evidenceStatusLabel(decision.stance)}
        </span>
      </div>

      <div className="evidence-decision-metrics" aria-label="Evidence balance">
        <article className="support">
          <span>Supports</span>
          <strong>{loading ? "—" : decision.supportCount}</strong>
          <small>directional lanes</small>
        </article>
        <article className="against">
          <span>Pushes back</span>
          <strong>{loading ? "—" : decision.againstCount}</strong>
          <small>live contradictions</small>
        </article>
        <article className="coverage">
          <span>Live coverage</span>
          <strong>{loading ? "—" : `${decision.coveragePercent}%`}</strong>
          <small>{loading ? "Checking sources" : `${decision.coveredCount} of ${decision.totalCount} lanes`}</small>
          <div className="evidence-coverage-track" aria-hidden="true">
            <i style={{ width: loading ? "14%" : `${decision.coveragePercent}%` }} />
          </div>
        </article>
      </div>

      <div
        className="evidence-composite-bar"
        role="img"
        aria-label={`${counts.support} support, ${counts.mixed} mixed, ${counts.against} against, ${counts.quiet} quiet`}
      >
        {counts.support > 0 ? <i className="seg-support" style={{ flex: `${counts.support} 1 0` }} /> : null}
        {counts.mixed > 0 ? <i className="seg-mixed" style={{ flex: `${counts.mixed} 1 0` }} /> : null}
        {counts.against > 0 ? <i className="seg-against" style={{ flex: `${counts.against} 1 0` }} /> : null}
        {counts.quiet > 0 ? <i className="seg-quiet" style={{ flex: `${counts.quiet} 1 0` }} /> : null}
      </div>

      <div className="evidence-decision-proof-grid">
        <article className="support">
          <ArrowUpRight aria-hidden="true" />
          <div>
            <span>Leading support</span>
            <p>{loading ? "Finding the strongest confirmation…" : decision.leadingSupport
              ? `${decision.leadingSupport.label} — ${decision.leadingSupport.primary}`
              : "No live directional support has cleared the bar yet."}</p>
          </div>
        </article>
        <article className="risk">
          <ShieldAlert aria-hidden="true" />
          <div>
            <span>Main contradiction</span>
            <p>{loading ? "Testing the strongest counter-signal…" : decision.leadingRisk
              ? `${decision.leadingRisk.label} — ${decision.leadingRisk.primary}`
              : "No live directional contradiction is visible in the current stack."}</p>
          </div>
        </article>
        <article className="unresolved">
          <CircleHelp aria-hidden="true" />
          <div>
            <span>Still unresolved</span>
            <p>{loading ? "Finding the biggest evidence gap…" : unresolvedCopy}</p>
          </div>
        </article>
      </div>

      <footer className="evidence-decision-footnote">
        <Radio aria-hidden="true" />
        <span>{loading ? "Refreshing source-backed signals" : `${synthesis} Price action is context, not proof.`}</span>
      </footer>
    </div>
  );
}

export function ConvictionSignalsCard({
  ticker,
  logoUrl = null,
}: {
  ticker: string;
  logoUrl?: string | null;
}) {
  const [core, setCore] = useState<ConvictionSignalDisplay[]>(initialCoreSignals);
  const [filingLanes, setFilingLanes] = useState<EvidenceLane[]>(initialFilingLanes);
  const [coreLoading, setCoreLoading] = useState(true);
  const [openLane, setOpenLane] = useState<EvidenceLaneId | null>(null);
  const [activeGroup, setActiveGroup] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const activeGroupRef = useRef(0);

  const selectGroup = (index: number, opts?: { scroll?: boolean }) => {
    if (activeGroupRef.current !== index) {
      activeGroupRef.current = index;
      setActiveGroup(index);
      setOpenLane(null);
    }
    if (opts?.scroll) {
      cardRefs.current[index]?.scrollIntoView({
        behavior: "smooth",
        inline: "start",
        block: "nearest",
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setCore(initialCoreSignals());
    setFilingLanes(initialFilingLanes());
    setCoreLoading(true);
    setOpenLane(null);
    activeGroupRef.current = 0;
    setActiveGroup(0);

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

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const cards = cardRefs.current.filter(Boolean) as HTMLElement[];
    if (cards.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let best: { index: number; ratio: number } | null = null;
        for (const entry of entries) {
          const index = cards.indexOf(entry.target as HTMLElement);
          if (index < 0) continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { index, ratio: entry.intersectionRatio };
          }
        }
        if (best && best.ratio > 0.45) {
          selectGroup(best.index);
        }
      },
      {
        root: track,
        threshold: [0.35, 0.5, 0.65, 0.8],
      },
    );

    for (const card of cards) observer.observe(card);
    return () => observer.disconnect();
  }, [ticker, filingLanes, core]);

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
  const openDetail = openLane ? lanesById.get(openLane) : null;

  return (
    <section className="company-driver-module evidence-lanes" aria-label="Conviction signals">
      <header className="evidence-lanes-heading">
        <div>
          <span className="company-section-kicker">Source deep-dive</span>
          <h2 className="company-driver-title evidence-lanes-title">Evidence lanes</h2>
        </div>
        <p>
          Decision above owns the consolidated read. Use these lanes to inspect ownership, filings,
          technicals, and short interest one source at a time.
        </p>
      </header>

      <CompositeReadCard
        lanes={allLanes}
        loading={anyLoading}
        ticker={ticker}
        logoUrl={logoUrl}
      />

      <div
        className="evidence-carousel"
        role="region"
        aria-roledescription="carousel"
        aria-label="Signal categories"
      >
        <div className="evidence-carousel-track bcn-list" ref={trackRef}>
          {EVIDENCE_GROUPS.map((group, groupIndex) => {
            const groupLanes = group.laneIds
              .map((id) => lanesById.get(id))
              .filter((lane): lane is EvidenceLane => Boolean(lane));
            if (groupLanes.length === 0) return null;

            const counts = countEvidenceSemantics(groupLanes.map((lane) => lane.semantic));
            const overall = compositeEvidenceLabel(counts);

            return (
              <article
                key={group.id}
                ref={(el) => {
                  cardRefs.current[groupIndex] = el;
                }}
                className={`evidence-carousel-card bcn-item${activeGroup === groupIndex ? " is-active" : ""}`}
                aria-label={group.label}
                aria-current={activeGroup === groupIndex ? "true" : undefined}
                onFocusCapture={() => selectGroup(groupIndex)}
              >
                <div className="evidence-carousel-card-inner ink-box ink-box--quiet">
                  <header className="evidence-carousel-card-header">
                    <div>
                      <h3 className="evidence-carousel-card-title">{group.label}</h3>
                      <small>{counts.support} support · {counts.against} against</small>
                    </div>
                    <span className={`evidence-status-pill tone-${overall}`}>{evidenceStatusLabel(overall)}</span>
                  </header>
                  <ul className="evidence-carousel-lanes">
                    {groupLanes.map((lane) => {
                      const isOpen = openLane === lane.id;
                      const isLoadingRow = lane.status === "loading";
                      const tone = lane.semantic === "loading" || lane.semantic === "unavailable"
                        ? "quiet"
                        : lane.semantic;
                      return (
                        <li key={lane.id}>
                          <button
                            type="button"
                            className={`evidence-carousel-lane tone-${tone}${isOpen ? " is-open" : ""}${isLoadingRow ? " is-loading" : ""}`}
                            disabled={isLoadingRow}
                            aria-expanded={isOpen}
                            onClick={() => {
                              selectGroup(groupIndex);
                              setOpenLane((current) => (current === lane.id ? null : lane.id));
                            }}
                          >
                            <span className="evidence-carousel-lane-label">{lane.label}</span>
                            <span className="evidence-carousel-lane-fact">
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
                </div>
              </article>
            );
          })}
        </div>

        <div className="evidence-carousel-dots" role="tablist" aria-label="Signal categories">
          {EVIDENCE_GROUPS.map((group, index) => (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-label={group.label}
              aria-selected={activeGroup === index}
              className={`evidence-carousel-dot${activeGroup === index ? " is-active" : ""}`}
              onClick={() => selectGroup(index, { scroll: true })}
            />
          ))}
        </div>
      </div>

      {openDetail && openLane ? (
        <div className="evidence-carousel-detail" aria-label={`${openDetail.label} detail`}>
          <div className="evidence-carousel-detail-bar">
            <strong>{openDetail.label}</strong>
            <button
              type="button"
              className="evidence-carousel-detail-close"
              onClick={() => setOpenLane(null)}
            >
              Close
            </button>
          </div>
          <div className="evidence-lane-panel evidence-carousel-detail-body">
            {laneDetail(openLane, ticker)}
          </div>
        </div>
      ) : null}
    </section>
  );
}

"use client";

import {
  AlertTriangle,
  ChevronDown,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import {
  isInsiderQuietMessage,
  notableSignalNotes,
  qualityHighlightsFromFactors,
  rankConvictionSignals,
  signalDisagreement,
  signalStateLabel,
  signalToneFromScore,
  synthesizeConvictionSignals,
  type ConvictionQualityHighlight,
  type ConvictionSignalCategory,
  type ConvictionSignalDisplay,
  type ConvictionSignalTone,
} from "@/lib/conviction/signal-display";
import type { ConvictionScoreView } from "@/lib/conviction/score/view";
import { inkBoxClass, inkChipClass, type InkTone } from "@/lib/display/ink-tone";

const SIGNAL_LABELS: Record<ConvictionSignalCategory, string> = {
  institutional: "Institutional",
  insider: "Insider buying",
  technicals: "Technicals",
  short_interest: "Short interest",
};

const SIGNAL_ORDER = Object.keys(SIGNAL_LABELS) as ConvictionSignalCategory[];

const SIGNAL_DETAIL: Record<ConvictionSignalCategory, string> = {
  institutional: "See Institutional activity below for the tracked-manager 13F moves behind this read.",
  insider: "Only open-market purchases count. Sales, grants, and 10b5-1 activity are ignored.",
  technicals: "See the SMA gauges and price trend below for the chart structure behind this read.",
  short_interest: "Short-interest level and change come from the latest FINRA settlement.",
};

function inkToneForSignal(tone: ConvictionSignalTone): InkTone {
  if (tone === "positive") return "up";
  if (tone === "negative") return "down";
  return "quiet";
}

function unavailableSignal(
  category: ConvictionSignalCategory,
  headline: string,
  status: "loading" | "unavailable" = "unavailable",
): ConvictionSignalDisplay {
  return {
    category,
    label: SIGNAL_LABELS[category],
    tone: "unavailable",
    status,
    headline,
    detail: headline,
    strength: 0,
  };
}

function initialSignals(): ConvictionSignalDisplay[] {
  return SIGNAL_ORDER.map((category) =>
    unavailableSignal(
      category,
      `Checking ${SIGNAL_LABELS[category].toLowerCase()} evidence…`,
      "loading",
    ),
  );
}

function signalsFromView(view: ConvictionScoreView): ConvictionSignalDisplay[] {
  const byCategory = new Map(view.categories.map((category) => [category.category, category]));

  return SIGNAL_ORDER.map((category) => {
    const source = byCategory.get(category);
    if (!source) {
      return unavailableSignal(category, `${SIGNAL_LABELS[category]} evidence is unavailable.`);
    }

    // Purchases-only mega-caps: treat empty buying as Quiet, not missing data.
    if (
      category === "insider"
      && !source.hasData
      && isInsiderQuietMessage(source.explanation)
    ) {
      return {
        category,
        label: SIGNAL_LABELS[category],
        tone: "neutral",
        status: "quiet",
        headline: "No open-market insider purchases in the current window.",
        detail: SIGNAL_DETAIL.insider,
        strength: 8,
      };
    }

    const status = !source.hasData
      ? "unavailable"
      : source.isStale ? "stale" : "available";

    return {
      category,
      label: SIGNAL_LABELS[category],
      tone: signalToneFromScore(source.score, source.hasData, source.isStale),
      status,
      headline: source.explanation,
      detail: source.isStale
        ? "This evidence is shown for context but is too old to count as current."
        : SIGNAL_DETAIL[category],
      strength: source.hasData ? Math.abs(source.score) : 0,
    };
  });
}

function ConvictionSignalsBuildMotion() {
  return (
    <div
      className="conviction-signals-build rising-build"
      role="status"
      aria-live="polite"
      aria-label="Building conviction signals"
    >
      <div className="conviction-signals-build-top">
        <div>
          <span className="conviction-signals-build-eyebrow">Building signals</span>
          <p>Reading institutional, insider, technical, and short-interest evidence…</p>
        </div>
        <div className="rising-build-meter" aria-hidden="true">
          <span /><span /><span /><span />
        </div>
      </div>
      <div className="conviction-signal-strip conviction-signal-strip-build" aria-hidden="true">
        <i /><i /><i /><i />
      </div>
      <div className="conviction-signals-build-grid" aria-hidden="true">
        {SIGNAL_ORDER.map((category) => (
          <div className="rising-build-card conviction-signals-build-card" key={category}>
            <span className="rising-scan-line" />
            <div className="rising-build-row">
              <span className="rising-build-chip" />
              <span className="rising-build-title" />
              <span className="rising-build-score" />
            </div>
            <span className="rising-build-copy" />
            <span className="rising-build-copy short" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DirectionIcon({ tone }: Pick<ConvictionSignalDisplay, "tone">) {
  if (tone === "positive") return <TrendingUp aria-hidden="true" />;
  if (tone === "negative") return <TrendingDown aria-hidden="true" />;
  return <Minus aria-hidden="true" />;
}

export function ConvictionSignalsCard({ ticker }: { ticker: string }) {
  const [signals, setSignals] = useState<ConvictionSignalDisplay[]>(initialSignals);
  const [qualityHighlights, setQualityHighlights] = useState<ConvictionQualityHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<ConvictionSignalCategory>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setSignals(initialSignals());
    setQualityHighlights([]);
    setExpanded(new Set());
    setLoading(true);

    async function load() {
      try {
        const view = await fetchJsonWithTimeout<ConvictionScoreView>(
          `/api/conviction/score?ticker=${encodeURIComponent(ticker)}`,
          45_000,
          controller.signal,
        );
        if (!cancelled) {
          setSignals(signalsFromView(view));
          setQualityHighlights(qualityHighlightsFromFactors(view.qualityFactors ?? []));
        }
      } catch {
        if (!cancelled) {
          setSignals(SIGNAL_ORDER.map((category) =>
            unavailableSignal(category, `${SIGNAL_LABELS[category]} evidence could not be loaded.`),
          ));
          setQualityHighlights([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker]);

  const strongestSignals = useMemo(() => rankConvictionSignals(signals), [signals]);
  const disagreement = useMemo(() => signalDisagreement(signals), [signals]);
  const synthesis = useMemo(() => synthesizeConvictionSignals(signals), [signals]);
  const notes = useMemo(() => notableSignalNotes(signals), [signals]);
  const availableCount = signals.filter((signal) =>
    signal.status === "available" || signal.status === "quiet",
  ).length;
  const bullishCount = signals.filter((signal) => signal.status === "available" && signal.tone === "positive").length;
  const bearishCount = signals.filter((signal) => signal.status === "available" && signal.tone === "negative").length;
  const quietCount = signals.filter((signal) =>
    (signal.status === "available" && signal.tone === "neutral")
    || signal.status === "quiet",
  ).length;

  const toggleSignal = (category: ConvictionSignalCategory) => {
    // TODO: Add a full-trail action for `/companies/${ticker}/evidence/${category}` when that route exists.
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  return (
    <section className="conviction-signals-card" aria-label="Conviction signals">
      <div className="conviction-signals-header">
        <h2 className="conviction-signals-title">Conviction signals</h2>
        <span className="conviction-signals-meta">
          {loading ? "Updating" : `${availableCount} of ${signals.length} live`}
        </span>
      </div>

      <div className="conviction-signals-body">
        {loading ? <ConvictionSignalsBuildMotion /> : null}

        {!loading ? (
          <>
        <p className="conviction-signals-synthesis">{synthesis}</p>

        <div className="conviction-signal-balance" aria-label={`${bullishCount} bullish, ${bearishCount} bearish, and ${quietCount} quiet signals`}>
          <strong>{bullishCount} bullish</strong>
          <span aria-hidden="true">·</span>
          <strong>{bearishCount} bearish</strong>
          <span aria-hidden="true">·</span>
          <span>{quietCount} quiet</span>
        </div>

        <div className="conviction-signal-strip" aria-hidden="true">
          {signals.map((signal) => (
            <i className={`signal-tone-${signal.tone} signal-status-${signal.status}`} key={signal.category} />
          ))}
        </div>

        <div className="conviction-signal-legend">
          {signals.map((signal) => (
            <div className={`conviction-signal-legend-item signal-tone-${signal.tone} signal-status-${signal.status}`} key={signal.category}>
              <span><i aria-hidden="true" />{signal.label}</span>
              <strong>{signalStateLabel(signal)}</strong>
            </div>
          ))}
        </div>

        {notes.length > 0 ? (
          <div className="conviction-signal-notes" aria-label="What stands out">
            <span className="conviction-signal-notes-label">What stands out</span>
            <ul>
              {notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {qualityHighlights.length > 0 ? (
          <div className="conviction-signal-quality" aria-label="Business context">
            <span className="conviction-signal-notes-label">Business context</span>
            <ul>
              {qualityHighlights.map((item) => (
                <li key={item.factor}>
                  <strong>{item.factor}</strong>
                  <span>{item.explanation}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {disagreement ? (
          <div className="conviction-signal-warning" role="note">
            <AlertTriangle aria-hidden="true" />
            <p>
              <strong>Signals disagree.</strong>{" "}
              {disagreement.positive.join(" and ")} lean bullish, while{" "}
              {disagreement.negative.join(" and ")} lean bearish.
            </p>
          </div>
        ) : null}

        <div className="conviction-why-heading">
          <span>Signal detail</span>
          <small>Tap to expand</small>
        </div>

        {strongestSignals.length > 0 ? (
          <div className="conviction-signal-cards">
            {strongestSignals.map((signal) => {
              const isExpanded = expanded.has(signal.category);
              const detailId = `conviction-signal-${ticker}-${signal.category}`;
              return (
                <article
                  className={`conviction-signal-card ${inkBoxClass(inkToneForSignal(signal.tone))} signal-tone-${signal.tone} signal-status-${signal.status}`}
                  key={signal.category}
                >
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={detailId}
                    onClick={() => toggleSignal(signal.category)}
                  >
                    <span className="conviction-signal-icon"><DirectionIcon tone={signal.tone} /></span>
                    <span className="conviction-signal-copy">
                      <span className="conviction-signal-card-top">
                        <span className={inkChipClass(inkToneForSignal(signal.tone))}>
                          {signal.label}
                        </span>
                        <span className={inkChipClass(inkToneForSignal(signal.tone))}>
                          {signalStateLabel(signal)}
                        </span>
                        {signal.status === "stale" ? (
                          <span className={inkChipClass("amber")}>Stale</span>
                        ) : null}
                      </span>
                      <strong>{signal.headline}</strong>
                    </span>
                    <ChevronDown className={isExpanded ? "expanded" : ""} aria-hidden="true" />
                  </button>
                  {isExpanded ? (
                    <div className="conviction-signal-detail" id={detailId}>
                      <p>{signal.detail}</p>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="conviction-signals-empty">
            No current signals are available for this company yet.
          </p>
        )}
          </>
        ) : null}
      </div>
    </section>
  );
}

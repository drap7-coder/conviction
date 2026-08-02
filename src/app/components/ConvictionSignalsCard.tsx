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
  rankConvictionSignals,
  signalDisagreement,
  signalStateLabel,
  signalToneFromScore,
  type ConvictionSignalCategory,
  type ConvictionSignalDisplay,
} from "@/lib/conviction/signal-display";
import type { ConvictionScoreView } from "@/lib/conviction/score/view";

const SIGNAL_LABELS: Record<ConvictionSignalCategory, string> = {
  institutional: "Institutional",
  insider: "Insider buying",
  technicals: "Technicals",
  short_interest: "Short interest",
};

const SIGNAL_ORDER = Object.keys(SIGNAL_LABELS) as ConvictionSignalCategory[];

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
        : "Open the matching evidence section below to inspect the underlying filings and market data.",
      strength: source.hasData ? Math.abs(source.score) : 0,
    };
  });
}

function DirectionIcon({ tone }: Pick<ConvictionSignalDisplay, "tone">) {
  if (tone === "positive") return <TrendingUp aria-hidden="true" />;
  if (tone === "negative") return <TrendingDown aria-hidden="true" />;
  return <Minus aria-hidden="true" />;
}

export function ConvictionSignalsCard({ ticker }: { ticker: string }) {
  const [signals, setSignals] = useState<ConvictionSignalDisplay[]>(initialSignals);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<ConvictionSignalCategory>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setSignals(initialSignals());
    setExpanded(new Set());
    setLoading(true);

    async function load() {
      try {
        const view = await fetchJsonWithTimeout<ConvictionScoreView>(
          `/api/conviction/score?ticker=${encodeURIComponent(ticker)}`,
          45_000,
          controller.signal,
        );
        if (!cancelled) setSignals(signalsFromView(view));
      } catch {
        if (!cancelled) {
          setSignals(SIGNAL_ORDER.map((category) =>
            unavailableSignal(category, `${SIGNAL_LABELS[category]} evidence could not be loaded.`),
          ));
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
  const availableCount = signals.filter((signal) => signal.status === "available").length;
  const bullishCount = signals.filter((signal) => signal.status === "available" && signal.tone === "positive").length;
  const bearishCount = signals.filter((signal) => signal.status === "available" && signal.tone === "negative").length;

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
        <div className="conviction-signal-balance" aria-label={`${bullishCount} bullish and ${bearishCount} bearish signals`}>
          <strong>{bullishCount} bullish</strong>
          <span aria-hidden="true">·</span>
          <strong>{bearishCount} bearish</strong>
          <span aria-hidden="true">·</span>
          <span>{availableCount} current</span>
        </div>

        <div className="conviction-signal-strip" aria-hidden="true">
          {signals.map((signal) => (
            <i className={`signal-tone-${signal.tone} signal-status-${signal.status}`} key={signal.category} />
          ))}
        </div>

        <div className="conviction-signal-legend">
          {signals.map((signal) => (
            <div className={`conviction-signal-legend-item signal-tone-${signal.tone}`} key={signal.category}>
              <span><i aria-hidden="true" />{signal.label}</span>
              <strong>{signalStateLabel(signal)}</strong>
            </div>
          ))}
        </div>

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
          <span>Strongest signals</span>
          <small>Tap to expand</small>
        </div>

        {strongestSignals.length > 0 ? (
          <div className="conviction-signal-cards">
            {strongestSignals.map((signal) => {
              const isExpanded = expanded.has(signal.category);
              const detailId = `conviction-signal-${ticker}-${signal.category}`;
              return (
                <article className={`conviction-signal-card signal-tone-${signal.tone}`} key={signal.category}>
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={detailId}
                    onClick={() => toggleSignal(signal.category)}
                  >
                    <span className="conviction-signal-icon"><DirectionIcon tone={signal.tone} /></span>
                    <span className="conviction-signal-copy">
                      <span className="conviction-signal-card-label">
                        {signal.label}
                        {signal.status === "stale" ? <em>Stale</em> : null}
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
            {loading ? "Checking available evidence sources…" : "No current signals are available for this company yet."}
          </p>
        )}
      </div>
    </section>
  );
}

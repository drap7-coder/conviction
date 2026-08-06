"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import { InstitutionalConvictionSection } from "@/app/components/InstitutionalConvictionSection";
import { InsiderActivitySection } from "@/app/components/InsiderActivitySection";
import { TechnicalsDetailSection } from "@/app/components/TechnicalsDetailSection";
import { ShortInterestDetailSection } from "@/app/components/ShortInterestDetailSection";
import {
  isInsiderQuietMessage,
  qualityHighlightsFromFactors,
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

const SIGNAL_LABELS: Record<ConvictionSignalCategory, string> = {
  institutional: "Institutional",
  insider: "Insider",
  technicals: "Technicals",
  short_interest: "Short interest",
};

const SIGNAL_ORDER = Object.keys(SIGNAL_LABELS) as ConvictionSignalCategory[];

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
    unavailableSignal(category, "Checking…", "loading"),
  );
}

function signalsFromView(view: ConvictionScoreView): ConvictionSignalDisplay[] {
  const byCategory = new Map(view.categories.map((category) => [category.category, category]));

  return SIGNAL_ORDER.map((category) => {
    const source = byCategory.get(category);
    if (!source) {
      return unavailableSignal(category, "Unavailable");
    }

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
      label: SIGNAL_LABELS[category],
      tone: signalToneFromScore(source.score, source.hasData, source.isStale),
      status,
      headline: compactHeadline(category, source.explanation || "No detail"),
      detail: source.explanation,
      strength: source.hasData ? Math.abs(source.score) : 0,
    };
  });
}

function toneClass(tone: ConvictionSignalTone, status: ConvictionSignalDisplay["status"]): string {
  if (status === "quiet") return "quiet";
  if (status === "unavailable" || status === "loading") return "unavailable";
  if (status === "stale") return "stale";
  return tone;
}

function signalDetail(category: ConvictionSignalCategory, ticker: string): ReactNode {
  switch (category) {
    case "institutional":
      return <InstitutionalConvictionSection ticker={ticker} priority="primary" hideHeader />;
    case "insider":
      return <InsiderActivitySection ticker={ticker} hideHeader />;
    case "technicals":
      return <TechnicalsDetailSection ticker={ticker} />;
    case "short_interest":
      return <ShortInterestDetailSection ticker={ticker} />;
    default:
      return null;
  }
}

export function ConvictionSignalsCard({
  ticker,
  moreEvidence,
}: {
  ticker: string;
  /** Optional stacked evidence that used to live in the deleted Evidence row. */
  moreEvidence?: ReactNode;
}) {
  const [signals, setSignals] = useState<ConvictionSignalDisplay[]>(initialSignals);
  const [qualityHighlights, setQualityHighlights] = useState<ConvictionQualityHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCategory, setOpenCategory] = useState<ConvictionSignalCategory | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setSignals(initialSignals());
    setQualityHighlights([]);
    setLoading(true);
    setOpenCategory(null);

    async function load() {
      try {
        const view = await fetchJsonWithTimeout<ConvictionScoreView>(
          `/api/conviction/score?ticker=${encodeURIComponent(ticker)}`,
          45_000,
          controller.signal,
        );
        if (!cancelled) {
          setSignals(signalsFromView(view));
          setQualityHighlights(qualityHighlightsFromFactors(view.qualityFactors ?? [], 2));
        }
      } catch {
        if (!cancelled) {
          setSignals(SIGNAL_ORDER.map((category) =>
            unavailableSignal(category, "Could not load"),
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

  const synthesis = useMemo(() => synthesizeConvictionSignals(signals), [signals]);
  const disagreement = useMemo(() => signalDisagreement(signals), [signals]);
  const qualityLine = useMemo(() => {
    if (qualityHighlights.length === 0) return null;
    return qualityHighlights
      .map((item) => item.explanation.replace(/\.$/, ""))
      .join(" · ");
  }, [qualityHighlights]);

  return (
    <section className="conviction-signals-card" aria-label="Conviction signals">
      <div className="conviction-signals-header">
        <h2 className="conviction-signals-title">Conviction signals</h2>
        <span className="conviction-signals-meta">
          {loading ? "Updating" : "Live"}
        </span>
      </div>

      <div className="conviction-signals-body">
        {loading ? (
          <div className="conviction-signals-loading" role="status" aria-live="polite">
            <p className="conviction-signals-synthesis conviction-signals-synthesis-loading">
              Reading ownership, insider, chart, and short-interest evidence…
            </p>
            <ul className="conviction-signal-list" aria-hidden="true">
              {SIGNAL_ORDER.map((category) => (
                <li className="conviction-signal-row is-loading" key={category}>
                  <span className="conviction-signal-name">{SIGNAL_LABELS[category]}</span>
                  <span className="conviction-signal-state">…</span>
                  <span className="conviction-signal-chevron" aria-hidden="true">›</span>
                  <span className="conviction-signal-fact" />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            <p className="conviction-signals-synthesis">{synthesis}</p>

            <div className="conviction-signal-list">
              {signals.map((signal) => {
                const isOpen = openCategory === signal.category;
                return (
                  <details
                    className={`conviction-signal-row tone-${toneClass(signal.tone, signal.status)}`}
                    key={signal.category}
                    open={isOpen}
                  >
                    <summary
                      className="conviction-signal-summary"
                      onClick={(event) => {
                        event.preventDefault();
                        setOpenCategory((current) =>
                          current === signal.category ? null : signal.category,
                        );
                      }}
                    >
                      <span className="conviction-signal-name">{signal.label}</span>
                      <span className="conviction-signal-state">{signalStateLabel(signal)}</span>
                      <span className="conviction-signal-chevron" aria-hidden="true">›</span>
                      <span className="conviction-signal-fact">{signal.headline}</span>
                    </summary>
                    <div className="conviction-signal-panel">
                      {signalDetail(signal.category, ticker)}
                    </div>
                  </details>
                );
              })}
            </div>

            {disagreement ? (
              <p className="conviction-signal-disagreement" role="note">
                Disagree: {disagreement.positive.join(", ")} bullish · {disagreement.negative.join(", ")} bearish
              </p>
            ) : null}

            {qualityLine ? (
              <p className="conviction-signal-quality-line">{qualityLine}</p>
            ) : null}

            {moreEvidence ? (
              <div className="conviction-signals-more">
                {moreEvidence}
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

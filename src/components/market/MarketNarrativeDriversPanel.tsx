"use client";

import Link from "next/link";
import { SignalBlock } from "@/components/display/SignalBlock";
import { inkChipClass, inkToneFromSemantic } from "@/lib/display/ink-tone";
import type { MarketNarrativeTheme, NarrativeHeat } from "@/lib/market/market-narratives";
import { isFiniteNumber } from "@/lib/display/format";

function heatLabel(heat: NarrativeHeat): string {
  if (heat === "surging") return "Surging";
  if (heat === "building") return "Building";
  if (heat === "quiet") return "Quiet";
  return "Steady";
}

function heatTone(heat: NarrativeHeat): string {
  if (heat === "surging") return "amber";
  if (heat === "building") return "positive";
  return "quiet";
}

function formatMove(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatHeadlineDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = new Date(`${raw}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return raw;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * What’s driving the move for a Pulse heatmap group — market narratives
 * as SignalBlock cards (replaces the old bottom narrative card grid).
 */
export function MarketNarrativeDriversPanel({
  themes,
  groupLabel,
}: {
  themes: MarketNarrativeTheme[];
  groupLabel: string;
}) {
  if (themes.length === 0) {
    return (
      <section className="bcn-module move-drivers-panel" aria-label="What’s driving the move">
        <div className="bcn-header">
          <span className="bcn-eyebrow">Narratives</span>
          <h2 className="bcn-title">What’s driving the move</h2>
          <p className="bcn-lede">
            Themes carrying attention across {groupLabel.toLowerCase()}.
          </p>
        </div>
        <div className="bcn-list" role="region" aria-label="What’s driving the move cards">
          <div className="bcn-item">
            <SignalBlock
              compact
              conclusion="No live narrative for this set yet"
              evidence="Attention and headline feeds are quiet or temporarily unavailable."
              badge={{ label: "Quiet", tone: "quiet" }}
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bcn-module move-drivers-panel" aria-label="What’s driving the move">
      <div className="bcn-header">
        <span className="bcn-eyebrow">Narratives</span>
        <h2 className="bcn-title">What’s driving the move</h2>
        <p className="bcn-lede">
          Themes carrying attention across {groupLabel.toLowerCase()}.
        </p>
      </div>
      <div
        className="bcn-list"
        role="region"
        aria-roledescription="carousel"
        aria-label={`${groupLabel} narratives`}
        tabIndex={0}
      >
        {themes.map((theme) => {
          const lead = [...theme.assets]
            .filter((asset) => asset.changePercent !== null)
            .sort((a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0))[0] ?? null;
          const linked = theme.assets
            .map((asset) => `${asset.ticker} ${formatMove(asset.changePercent)}`)
            .join(" · ");
          const toneChip = inkChipClass(
            inkToneFromSemantic(theme.marketTone === "mixed" ? "mixed" : theme.marketTone),
          );
          const conclusion = theme.headline?.title ?? theme.summary;
          const evidence = theme.headline ? theme.summary : (linked || "Linked markets are mixed.");
          const href = theme.headline?.url
            ?? (lead ? `/companies/${encodeURIComponent(lead.ticker)}` : null);

          const card = (
            <SignalBlock
              compact
              eyebrow={theme.label}
              conclusion={conclusion}
              evidence={evidence}
              dateLabel={formatHeadlineDate(theme.headline?.date) ?? `${theme.velocity.toFixed(1)}× attention`}
              source="material_news"
              badge={{ label: heatLabel(theme.heat), tone: heatTone(theme.heat) }}
            >
              <p className="signal-block-why">
                <span className={toneChip}>
                  {theme.marketTone === "positive"
                    ? "Constructive"
                    : theme.marketTone === "negative"
                      ? "Adverse"
                      : "Mixed"}
                </span>
                {" "}
                {linked}
              </p>
            </SignalBlock>
          );

          if (theme.headline?.url) {
            return (
              <a
                key={theme.id}
                href={theme.headline.url}
                className="bcn-item"
                target="_blank"
                rel="noopener noreferrer"
              >
                {card}
              </a>
            );
          }

          if (href) {
            return (
              <Link key={theme.id} href={href} className="bcn-item">
                {card}
              </Link>
            );
          }

          return (
            <div key={theme.id} className="bcn-item">
              {card}
            </div>
          );
        })}
      </div>
      <p className="bcn-footnote">
        Attention vs baseline from open chatter · tone tags reflect session reaction.
      </p>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import {
  heatBand,
  heatChipColors,
  heatTileColor,
  type HeatBand,
} from "@/lib/display/heat-color";
import {
  buildSparklineGeometry,
  sparklineGlow,
  sparklineStroke,
  sparklineToneFromChange,
} from "@/lib/display/sparkline";
import { fmtDollarPrice } from "@/lib/display/format";

export interface HeatTileProps {
  /** Primary large label — instrument/company name. */
  label: string;
  /** Small subtitle under the name — usually the ticker symbol. */
  subtitle?: string | null;
  changePercent: number | null | undefined;
  /** Accessible name — usually company/market name + move. */
  ariaLabel: string;
  href?: string | null;
  className?: string;
  style?: CSSProperties;
  /**
   * Live polish: ambient glow, ping, hover lift, update flash, sparkline.
   * On by default for heatmap surfaces.
   */
  live?: boolean;
  /** Recent closes (≈15) for the sparkline — from quote poll, not a new API. */
  sparkline?: number[] | null;
  /** Optional last price shown in the tile foot (watchlist quote grid). */
  price?: number | null;
  /** Show the pulsing live/status dot. Off for the watchlist quote grid. */
  showLiveDot?: boolean;
}

function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (Math.abs(value) < 0.05) return "FLAT";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function accentFromBand(band: HeatBand): "up" | "down" | "flat" {
  if (band.startsWith("up")) return "up";
  if (band.startsWith("down")) return "down";
  return "flat";
}

/** Shared magnitude-scaled heat tile — dark fill + name + ticker + % chip. */
export function HeatTile({
  label,
  subtitle = null,
  changePercent,
  ariaLabel,
  href = null,
  className,
  style,
  live = true,
  sparkline = null,
  price = null,
  showLiveDot = true,
}: HeatTileProps) {
  const band: HeatBand = heatBand(changePercent);
  const accent = accentFromBand(band);
  const chip = heatChipColors(changePercent);
  const tone = sparklineToneFromChange(changePercent);
  const [flashing, setFlashing] = useState(false);
  const prevChangeRef = useRef<number | null | undefined>(changePercent);

  useEffect(() => {
    if (!live) return;
    const prev = prevChangeRef.current;
    prevChangeRef.current = changePercent;
    if (prev === undefined) return;
    if (prev === changePercent) return;
    if (
      (prev == null && changePercent == null)
      || (typeof prev === "number"
        && typeof changePercent === "number"
        && Math.abs(prev - changePercent) < 0.0001)
    ) {
      return;
    }
    setFlashing(true);
    const timer = window.setTimeout(() => setFlashing(false), 360);
    return () => window.clearTimeout(timer);
  }, [changePercent, live]);

  const geometry = useMemo(
    () => (live && sparkline && sparkline.length >= 2
      ? buildSparklineGeometry(sparkline, 120, 36)
      : null),
    [live, sparkline],
  );

  const classes = [
    "heat-tile",
    `heat-tile-${band}`,
    live ? "heat-tile--live" : null,
    live ? `heat-tile--${accent}` : null,
    flashing ? "is-updating" : null,
    className,
  ].filter(Boolean).join(" ");

  const tileStyle: CSSProperties = {
    ...style,
    background: heatTileColor(changePercent),
    ...(live
      ? ({
          "--heat-glow": sparklineGlow(tone),
          "--heat-accent": sparklineStroke(tone),
        } as CSSProperties)
      : null),
  };

  const body: ReactNode = (
    <>
      {live ? (
        <>
          <span className="heat-tile-glow" aria-hidden="true" />
          {showLiveDot ? (
            <span className="heat-tile-live-dot" aria-hidden="true">
              <i className="heat-tile-live-ping" />
              <i className="heat-tile-live-core" />
            </span>
          ) : null}
        </>
      ) : null}

      <span className="heat-tile-copy">
        <span className="heat-tile-name">{label}</span>
        {subtitle ? <span className="heat-tile-symbol">{subtitle}</span> : null}
      </span>

      {geometry ? (
        <svg
          className={`heat-tile-sparkline tone-${tone}`}
          viewBox="0 0 120 36"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            className="heat-tile-sparkline-line"
            d={geometry.path}
            fill="none"
            stroke={sparklineStroke(tone)}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <circle
            className="heat-tile-sparkline-dot"
            cx={geometry.lastX}
            cy={geometry.lastY}
            r="2.4"
            fill={sparklineStroke(tone)}
          />
        </svg>
      ) : null}

      {price != null ? (
        <span className="heat-tile-foot">
          <span className="heat-tile-price tnum">{fmtDollarPrice(price)}</span>
          <strong
            className="heat-tile-pct"
            style={{ background: chip.background, color: chip.color }}
          >
            {fmtPct(changePercent)}
          </strong>
        </span>
      ) : (
        <strong
          className="heat-tile-pct"
          style={{ background: chip.background, color: chip.color }}
        >
          {fmtPct(changePercent)}
        </strong>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={classes}
        style={tileStyle}
        aria-label={ariaLabel}
      >
        {body}
      </Link>
    );
  }

  return (
    <div
      className={classes}
      style={tileStyle}
      aria-label={ariaLabel}
    >
      {body}
    </div>
  );
}

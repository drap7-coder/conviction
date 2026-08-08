"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import {
  heatBand,
  heatChipColors,
  heatTileColor,
  type HeatBand,
} from "@/lib/display/heat-color";

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
}

function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (Math.abs(value) < 0.05) return "FLAT";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
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
}: HeatTileProps) {
  const band: HeatBand = heatBand(changePercent);
  const chip = heatChipColors(changePercent);
  const classes = [
    "heat-tile",
    `heat-tile-${band}`,
    className,
  ].filter(Boolean).join(" ");
  const tileStyle: CSSProperties = {
    ...style,
    background: heatTileColor(changePercent),
  };

  const body = (
    <>
      <span className="heat-tile-copy">
        <span className="heat-tile-name">{label}</span>
        {subtitle ? <span className="heat-tile-symbol">{subtitle}</span> : null}
      </span>
      <strong
        className="heat-tile-pct"
        style={{ background: chip.background, color: chip.color }}
      >
        {fmtPct(changePercent)}
      </strong>
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

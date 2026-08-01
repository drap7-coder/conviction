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
  /** Primary label shown in the ticker pill (ticker symbol or short name). */
  label: string;
  changePercent: number | null | undefined;
  /** Accessible name — usually company/market name + move. */
  ariaLabel: string;
  href?: string | null;
  /** Optional “What’s driving the move” line shown on hover. */
  driverText?: string | null;
  className?: string;
  style?: CSSProperties;
}

function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (Math.abs(value) < 0.05) return "FLAT";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/** Shared magnitude-scaled heat tile — dark fill + ticker pill + % chip. */
export function HeatTile({
  label,
  changePercent,
  ariaLabel,
  href = null,
  driverText = null,
  className,
  style,
}: HeatTileProps) {
  const band: HeatBand = heatBand(changePercent);
  const chip = heatChipColors(changePercent);
  const classes = [
    "heat-tile",
    `heat-tile-${band}`,
    driverText ? "heat-tile-has-driver" : null,
    className,
  ].filter(Boolean).join(" ");
  const tileStyle: CSSProperties = {
    ...style,
    background: heatTileColor(changePercent),
  };

  const body = (
    <>
      <span className="heat-tile-ticker">{label}</span>
      <strong
        className="heat-tile-pct"
        style={{ background: chip.background, color: chip.color }}
      >
        {fmtPct(changePercent)}
      </strong>
      {driverText ? (
        <span className="heat-tile-tooltip" role="tooltip">
          <span className="heat-tile-tooltip-label">What’s driving the move</span>
          <span className="heat-tile-tooltip-text">{driverText}</span>
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={classes}
        style={tileStyle}
        aria-label={driverText ? `${ariaLabel}. ${driverText}` : ariaLabel}
        title={driverText ?? undefined}
      >
        {body}
      </Link>
    );
  }

  return (
    <div
      className={classes}
      style={tileStyle}
      aria-label={driverText ? `${ariaLabel}. ${driverText}` : ariaLabel}
      title={driverText ?? undefined}
    >
      {body}
    </div>
  );
}

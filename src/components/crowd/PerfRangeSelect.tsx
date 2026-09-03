"use client";

import {
  H2H_PERF_RANGE_OPTIONS,
  parseH2HPerfRange,
  type H2HPerfRange,
} from "@/lib/competitions/perf-range";

/** Shared Today / Weekly / Monthly / YTD control for Crowd Standings + H2H. */
export function PerfRangeSelect({
  value,
  onChange,
  className,
}: {
  value: H2HPerfRange;
  onChange: (range: H2HPerfRange) => void;
  className?: string;
}) {
  return (
    <label className={`h2h-range-select${className ? ` ${className}` : ""}`}>
      <span className="h2h-range-select-icon" aria-hidden="true">
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
          <rect
            x="2.5"
            y="3.5"
            width="11"
            height="10"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.25"
          />
          <path d="M5 2.25v2.5M11 2.25v2.5M2.5 6.5h11" stroke="currentColor" strokeWidth="1.25" />
        </svg>
      </span>
      <select
        value={value}
        aria-label="Performance range"
        onChange={(event) => onChange(parseH2HPerfRange(event.target.value))}
      >
        {H2H_PERF_RANGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

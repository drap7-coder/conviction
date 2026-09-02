"use client";

import {
  H2H_PERF_RANGE_OPTIONS,
  parseH2HPerfRange,
  type H2HPerfRange,
} from "@/lib/competitions/perf-range";

/** Shared Daily / Weekly / Monthly / YTD control for Crowd Standings + H2H. */
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
      <span className="h2h-range-select-label">Performance</span>
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

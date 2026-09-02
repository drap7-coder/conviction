"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SchoolLogo } from "@/components/crowd/SchoolLogo";
import {
  DEFAULT_H2H_PERF_RANGE,
  parseH2HPerfRange,
  type H2HPerfRange,
} from "@/lib/competitions/perf-range";
import type {
  HeadToHeadPayload,
  HeadToHeadSchoolOption,
} from "@/lib/competitions/types";

function formatReturn(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function returnTone(value: number | null): "up" | "down" | "quiet" {
  if (value === null) return "quiet";
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "quiet";
}

function schoolById(
  schools: HeadToHeadSchoolOption[],
  groupId: string | null | undefined,
): HeadToHeadSchoolOption | null {
  if (!groupId) return null;
  return schools.find((school) => school.groupId === groupId) ?? null;
}

function SchoolSideSelect({
  label,
  value,
  schools,
  otherValue,
  onChange,
}: {
  label: string;
  value: string;
  schools: HeadToHeadSchoolOption[];
  otherValue: string;
  onChange: (groupId: string) => void;
}) {
  const selected = schoolById(schools, value);
  const accent = selected?.accentColor ?? selected?.primaryColor ?? "#115740";

  return (
    <label className="h2h-school-select" style={{ ["--h2h-accent" as string]: accent }}>
      <span className="h2h-school-select-label">{label}</span>
      <span className="h2h-school-select-control">
        {selected ? (
          <SchoolLogo
            name={selected.name}
            domain={selected.domain}
            ncaaId={selected.ncaaId}
            accentColor={accent}
            size={28}
          />
        ) : null}
        <select
          value={value}
          aria-label={label}
          onChange={(event) => onChange(event.target.value)}
        >
          {schools.map((school) => (
            <option
              key={school.groupId}
              value={school.groupId}
              disabled={school.groupId === otherValue}
            >
              {school.name}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

/** Continuous campus vs campus scoreboard — period My Pick averages. */
export function HeadToHeadMatchCard({
  range = DEFAULT_H2H_PERF_RANGE,
  initialPayload = null,
}: {
  /** Shared Standings performance window (default YTD). */
  range?: H2HPerfRange;
  /** From parent `/api/crowd/standings` — skips the first self-fetch when present. */
  initialPayload?: HeadToHeadPayload | null;
}) {
  const [data, setData] = useState<HeadToHeadPayload | null>(initialPayload);
  const [sideA, setSideA] = useState<string>(initialPayload?.groupA?.groupId ?? "");
  const [sideB, setSideB] = useState<string>(initialPayload?.groupB?.groupId ?? "");

  async function reload(nextA?: string, nextB?: string, nextRange?: H2HPerfRange) {
    const a = nextA ?? sideA;
    const b = nextB ?? sideB;
    const perfRange = nextRange ?? range;
    const params = new URLSearchParams();
    if (a) params.set("a", a);
    if (b) params.set("b", b);
    params.set("range", perfRange);
    const qs = params.toString();
    const res = await fetch(`/api/competitions/active?${qs}`, {
      cache: "no-store",
      credentials: "include",
    });
    if (!res.ok) return;
    const payload = (await res.json()) as HeadToHeadPayload;
    setData(payload);
    if (payload.groupA?.groupId) setSideA(payload.groupA.groupId);
    if (payload.groupB?.groupId) setSideB(payload.groupB.groupId);
  }

  useEffect(() => {
    if (initialPayload) {
      setData(initialPayload);
      if (initialPayload.groupA?.groupId) setSideA(initialPayload.groupA.groupId);
      if (initialPayload.groupB?.groupId) setSideB(initialPayload.groupB.groupId);
      return;
    }
    void reload(undefined, undefined, range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, initialPayload]);

  const schools = data?.schools ?? [];

  if (data === null) {
    return (
      <section className="surface-shell h2h-card h2h-card--empty" aria-label="Head to head">
        <p className="crowd-empty">Loading head-to-head…</p>
      </section>
    );
  }

  if (schools.length < 2) {
    return (
      <section className="surface-shell h2h-card h2h-card--empty" aria-label="Head to head">
        <p className="crowd-empty">
          Join a school community to open head-to-head.
        </p>
      </section>
    );
  }

  const { groupA, groupB, statusLabel, viewer } = data;
  const selectedA = schoolById(schools, sideA);
  const selectedB = schoolById(schools, sideB);
  const accentA = groupA?.accentColor ?? groupA?.primaryColor ?? selectedA?.accentColor ?? "#115740";
  const accentB = groupB?.accentColor ?? groupB?.primaryColor ?? selectedB?.accentColor ?? "#D6001C";
  const activeRange = parseH2HPerfRange(data.range ?? range);

  async function changeSide(which: "a" | "b", groupId: string) {
    const nextA = which === "a" ? groupId : sideA;
    const nextB = which === "b" ? groupId : sideB;
    if (!nextA || !nextB || nextA === nextB) return;
    setSideA(nextA);
    setSideB(nextB);
    await reload(nextA, nextB, activeRange);
  }

  return (
    <section className="surface-shell h2h-card" aria-label="Head to head">
      <div className="h2h-card-head">
        <div className="h2h-rivalry h2h-rivalry--selectors">
          <SchoolSideSelect
            label="Your side"
            value={sideA}
            schools={schools}
            otherValue={sideB}
            onChange={(groupId) => void changeSide("a", groupId)}
          />
          <span className="h2h-vs">vs</span>
          <SchoolSideSelect
            label="Opponent"
            value={sideB}
            schools={schools}
            otherValue={sideA}
            onChange={(groupId) => void changeSide("b", groupId)}
          />
        </div>
        <span className={`h2h-status${statusLabel === "Live" ? " is-live" : ""}`}>
          {statusLabel || "Live"}
        </span>
      </div>

      {data.available && groupA && groupB ? (
        <div className="h2h-scoreboard">
          <div className="h2h-side" style={{ ["--h2h-accent" as string]: accentA }}>
            <strong className={`h2h-return is-${returnTone(groupA.avgReturnPct)}`}>
              {formatReturn(groupA.avgReturnPct)}
            </strong>
            <span className="h2h-picks">
              {groupA.pickCount} {groupA.pickCount === 1 ? "pick" : "picks"}
            </span>
          </div>
          <div className="h2h-side" style={{ ["--h2h-accent" as string]: accentB }}>
            <strong className={`h2h-return is-${returnTone(groupB.avgReturnPct)}`}>
              {formatReturn(groupB.avgReturnPct)}
            </strong>
            <span className="h2h-picks">
              {groupB.pickCount} {groupB.pickCount === 1 ? "pick" : "picks"}
            </span>
          </div>
        </div>
      ) : (
        <p className="h2h-note">Pick two schools to compare campus scores.</p>
      )}

      <div className="h2h-action">
        {viewer.kind === "guest" ? (
          <Link href="/signin" className="brief-link">
            Sign in to add your My Pick
          </Link>
        ) : viewer.kind === "not_member" ? (
          <p className="h2h-note">{viewer.message}</p>
        ) : viewer.kind === "member" ? (
          <Link href="/crowd?tab=pick" className="brief-link">
            Update your My Pick
          </Link>
        ) : null}
      </div>
    </section>
  );
}

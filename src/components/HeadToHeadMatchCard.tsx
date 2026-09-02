"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogoDisplay } from "@/app/components/LogoDisplay";
import { SchoolLogo } from "@/components/crowd/SchoolLogo";
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

export function HeadToHeadMatchCard() {
  const [data, setData] = useState<HeadToHeadPayload | null>(null);
  const [sideA, setSideA] = useState<string>("");
  const [sideB, setSideB] = useState<string>("");
  const [ticker, setTicker] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  async function reload(nextA?: string, nextB?: string) {
    const a = nextA ?? sideA;
    const b = nextB ?? sideB;
    const params = new URLSearchParams();
    if (a) params.set("a", a);
    if (b) params.set("b", b);
    const qs = params.toString();
    const res = await fetch(`/api/competitions/active${qs ? `?${qs}` : ""}`, {
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
    void reload();
    // Initial load only — subsequent reloads pass explicit sides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const schools = data?.schools ?? [];

  if (data === null) {
    return (
      <section className="surface-shell h2h-card h2h-card--empty" aria-label="Weekly rivalry">
        <p className="crowd-empty">Loading weekly rivalry…</p>
      </section>
    );
  }

  if (schools.length < 2) {
    return (
      <section className="surface-shell h2h-card h2h-card--empty" aria-label="Weekly rivalry">
        <p className="crowd-empty">
          Join a school community to open head-to-head rivalries.
        </p>
      </section>
    );
  }

  const { competition, groupA, groupB, statusLabel, viewer } = data;
  const selectedA = schoolById(schools, sideA);
  const selectedB = schoolById(schools, sideB);
  const accentA = groupA?.accentColor ?? groupA?.primaryColor ?? selectedA?.accentColor ?? "#115740";
  const accentB = groupB?.accentColor ?? groupB?.primaryColor ?? selectedB?.accentColor ?? "#D6001C";

  async function changeSide(which: "a" | "b", groupId: string) {
    const nextA = which === "a" ? groupId : sideA;
    const nextB = which === "b" ? groupId : sideB;
    if (!nextA || !nextB || nextA === nextB) return;
    setSideA(nextA);
    setSideB(nextB);
    setMessage(null);
    await reload(nextA, nextB);
  }

  async function submitPick() {
    if (viewer.kind !== "can_submit" || !competition) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/competitions/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          competitionId: competition.id,
          groupId: viewer.groupId,
          ticker: ticker.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error ?? "Could not submit pick.");
        return;
      }
      setModalOpen(false);
      setTicker("");
      await reload(sideA, sideB);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface-shell h2h-card" aria-label="Weekly rivalry">
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
          {statusLabel || "Open"}
        </span>
      </div>

      {data.available && groupA && groupB ? (
        <div className="h2h-scoreboard">
          <div className="h2h-side" style={{ ["--h2h-accent" as string]: accentA }}>
            <strong className={`h2h-return is-${returnTone(groupA.avgReturnPct)}`}>
              {formatReturn(groupA.avgReturnPct)}
            </strong>
            <span className="h2h-picks">{groupA.pickCount} picks submitted</span>
          </div>
          <div className="h2h-side" style={{ ["--h2h-accent" as string]: accentB }}>
            <strong className={`h2h-return is-${returnTone(groupB.avgReturnPct)}`}>
              {formatReturn(groupB.avgReturnPct)}
            </strong>
            <span className="h2h-picks">{groupB.pickCount} picks submitted</span>
          </div>
        </div>
      ) : (
        <p className="h2h-note">Pick two schools to compare this week&apos;s picks.</p>
      )}

      <div className="h2h-action">
        {viewer.kind === "guest" ? (
          <Link href="/signin" className="brief-link">
            Sign in to submit a weekly pick
          </Link>
        ) : viewer.kind === "not_member" ? (
          <p className="h2h-note">{viewer.message}</p>
        ) : viewer.kind === "can_submit" ? (
          <>
            <button type="button" className="watchlist-add-button" onClick={() => {
              if (viewer.existingTicker && !ticker) setTicker(viewer.existingTicker);
              setModalOpen(true);
            }}>
              {viewer.existingTicker ? "Change Pick" : "Submit Pick"}
            </button>
            {modalOpen ? (
              <div className="h2h-modal" role="dialog" aria-label="Submit weekly pick">
                <label>
                  Ticker
                  <span className="h2h-ticker-input-row">
                    {ticker.trim() ? (
                      <span className="crowd-logo community-pick-ticker-logo is-compact" aria-hidden="true">
                        <LogoDisplay ticker={ticker.trim()} size="badge" />
                      </span>
                    ) : null}
                    <input
                      value={ticker}
                      onChange={(event) => setTicker(event.target.value.toUpperCase())}
                      placeholder="NVDA"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </span>
                </label>
                <div className="h2h-modal-actions">
                  <button type="button" className="brief-link" onClick={() => setModalOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="watchlist-add-button"
                    disabled={busy || !ticker.trim()}
                    onClick={() => void submitPick()}
                  >
                    {busy ? "Saving…" : "Save pick"}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : viewer.kind === "locked_pick" ? (
          <p className="h2h-note community-pick-ticker-row">
            Your Pick:{" "}
            <span className="crowd-logo community-pick-ticker-logo is-compact" aria-hidden="true">
              <LogoDisplay ticker={viewer.ticker} size="badge" />
            </span>
            <strong>{viewer.ticker}</strong> ({formatReturn(viewer.returnPct)})
          </p>
        ) : null}
        {message ? <p className="h2h-error">{message}</p> : null}
      </div>
    </section>
  );
}

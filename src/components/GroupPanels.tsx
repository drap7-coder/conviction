"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Group, Institution, UserGroupMembership } from "@/lib/groups/types";
import { writeStoredPrimaryColor, SKIP_ONBOARDING_KEY } from "@/components/GroupAccentProvider";

const THEME_SWATCHES = ["#115740", "#0D7377", "#2E5A88", "#5B2C6F", "#C45C26", "#8B1E1E"];

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Ended";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatAvg(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function CompetitionCard({
  standing,
}: {
  standing: import("@/lib/groups/types").CompetitionStanding;
}) {
  const [remaining, setRemaining] = useState(standing.msRemaining);

  useEffect(() => {
    setRemaining(standing.msRemaining);
    const id = window.setInterval(() => {
      setRemaining((ms) => Math.max(0, ms - 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [standing.competition.id, standing.msRemaining]);

  const status = standing.isTie
    ? "Tie"
    : standing.leaderGroupId === standing.groupA.groupId
      ? `${standing.groupA.groupName} leads`
      : standing.leaderGroupId === standing.groupB.groupId
        ? `${standing.groupB.groupName} leads`
        : "Awaiting picks";

  return (
    <article className="crowd-competition" aria-label="Group competition">
      <header className="crowd-competition-head">
        <span className="crowd-competition-eyebrow">This week</span>
        <span
          className={`crowd-competition-status${standing.isTie ? " is-tie" : ""}`}
          style={
            standing.leaderGroupId
              ? {
                  ["--group-accent" as string]:
                    standing.leaderGroupId === standing.groupA.groupId
                      ? standing.groupA.primaryColor ?? undefined
                      : standing.groupB.primaryColor ?? undefined,
                }
              : undefined
          }
        >
          {status}
        </span>
      </header>
      <div className="crowd-competition-grid">
        <div className="crowd-competition-side">
          <strong
            style={
              standing.groupA.primaryColor
                ? { color: standing.groupA.primaryColor }
                : undefined
            }
          >
            {standing.groupA.groupName}
          </strong>
          <span className="tnum crowd-competition-avg">{formatAvg(standing.groupA.avgPctReturn)}</span>
          <small>
            {standing.groupA.pickCount} active pick
            {standing.groupA.pickCount === 1 ? "" : "s"}
          </small>
        </div>
        <div className="crowd-competition-vs" aria-hidden="true">
          vs
        </div>
        <div className="crowd-competition-side is-end">
          <strong
            style={
              standing.groupB.primaryColor
                ? { color: standing.groupB.primaryColor }
                : undefined
            }
          >
            {standing.groupB.groupName}
          </strong>
          <span className="tnum crowd-competition-avg">{formatAvg(standing.groupB.avgPctReturn)}</span>
          <small>
            {standing.groupB.pickCount} active pick
            {standing.groupB.pickCount === 1 ? "" : "s"}
          </small>
        </div>
      </div>
      <footer className="crowd-competition-foot">
        <span>Avg % return · active picks only</span>
        <span className="tnum">Ends in {formatCountdown(remaining)}</span>
      </footer>
      {standing.picksLocked ? (
        <p className="crowd-competition-lock">Picks locked until weekend open.</p>
      ) : (
        <p className="crowd-competition-lock">Pick window open through Monday 9:30 AM ET.</p>
      )}
    </article>
  );
}

type GroupsPayload = {
  authenticated: boolean;
  institutions: Institution[];
  institution: Institution | null;
  groups: Group[];
  memberships: UserGroupMembership[];
  primaryGroup: Group | null;
};

export function GroupSettingsPanel({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<GroupsPayload | null>(null);
  const [institutionId, setInstitutionId] = useState("");
  const [name, setName] = useState("");
  const [themeColor, setThemeColor] = useState(THEME_SWATCHES[0]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function reload() {
    const res = await fetch("/api/groups", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as GroupsPayload;
    setData(json);
    if (!institutionId && json.institutions[0]) {
      setInstitutionId(json.institutions[0].id);
    }
    writeStoredPrimaryColor(json.primaryGroup?.primaryColor ?? null);
    if (json.primaryGroup?.primaryColor) {
      document.documentElement.style.setProperty(
        "--group-accent",
        json.primaryGroup.primaryColor,
      );
    }
  }

  useEffect(() => {
    void reload().catch(() => undefined);
  }, []);

  const memberIds = useMemo(
    () => new Set((data?.memberships ?? []).map((m) => m.groupId)),
    [data],
  );

  const institutionGroups = useMemo(() => {
    if (!data) return [];
    const id = institutionId || data.institutions[0]?.id;
    if (!id) return data.groups;
    return data.groups.filter((group) => group.institutionId === id);
  }, [data, institutionId]);

  const activeInstitution = useMemo(() => {
    if (!data) return null;
    return (
      data.institutions.find((row) => row.id === institutionId) ??
      data.institutions[0] ??
      null
    );
  }, [data, institutionId]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage(json.error ?? "Could not update groups.");
        return;
      }
      await reload();
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <p className="crowd-empty">Loading groups…</p>;
  }

  return (
    <section className={`group-settings${compact ? " is-compact" : ""}`} aria-label="Your groups">
      {!data.authenticated ? (
        <p className="group-settings-note">
          Sign in to join groups under a campus. Guests can still browse Crowd group filters.
        </p>
      ) : null}

      {activeInstitution ? (
        <p className="group-settings-note">
          {activeInstitution.name}
          {activeInstitution.affiliationStatus === "unofficial"
            ? " · Unofficial community — not affiliated with the university"
            : null}
        </p>
      ) : null}

      <ul className="group-settings-list">
        {(data.memberships ?? []).map((membership) => (
          <li key={membership.id}>
            <span
              className="group-badge"
              style={
                membership.group.primaryColor
                  ? { ["--group-accent" as string]: membership.group.primaryColor }
                  : undefined
              }
            >
              {membership.group.name}
              {membership.isPrimary ? " · Primary" : ""}
            </span>
            <span className="group-settings-actions">
              {!membership.isPrimary ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void post({ action: "primary", groupId: membership.groupId })}
                >
                  Make primary
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => void post({ action: "leave", groupId: membership.groupId })}
              >
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>

      {data.authenticated ? (
        <>
          <div className="group-settings-join">
            <label>
              Institution
              <select
                value={institutionId || data.institutions[0]?.id || ""}
                disabled={busy || data.institutions.length <= 1}
                onChange={(event) => setInstitutionId(event.target.value)}
              >
                {data.institutions.map((institution) => (
                  <option key={institution.id} value={institution.id}>
                    {institution.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Join a group
              <select
                defaultValue=""
                disabled={busy}
                onChange={(event) => {
                  const groupId = event.target.value;
                  if (!groupId) return;
                  void post({ action: "join", groupId });
                  event.target.value = "";
                }}
              >
                <option value="">Select…</option>
                {institutionGroups
                  .filter((group) => !memberIds.has(group.id))
                  .map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <form
            className="group-settings-create"
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim()) return;
              void post({
                action: "create",
                institutionId: institutionId || data.institutions[0]?.id,
                name: name.trim(),
                primaryColor: themeColor,
                isPrimary: (data.memberships ?? []).length === 0,
              }).then(() => setName(""));
            }}
          >
            <label>
              Create a group under {activeInstitution?.name ?? "this institution"}
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Finance Club"
                disabled={busy}
              />
            </label>
            <label>
              Theme
              <span className="group-theme-swatches">
                {THEME_SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    className={`group-theme-swatch${themeColor === swatch ? " is-selected" : ""}`}
                    style={{ background: swatch }}
                    aria-label={`Theme ${swatch}`}
                    onClick={() => setThemeColor(swatch)}
                  />
                ))}
              </span>
            </label>
            <button type="submit" disabled={busy || !name.trim()}>
              Add
            </button>
          </form>
          <p className="group-settings-note">
            Institutions are permanent campus containers. You can create as many groups as you want
            underneath — you cannot create another {activeInstitution?.name ?? "institution"}.
          </p>
        </>
      ) : null}

      {message ? <p className="group-settings-message">{message}</p> : null}
    </section>
  );
}

/** Skippable post-signup prompt — does not block registration. */
export function GroupOnboardingPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(SKIP_ONBOARDING_KEY)) return;
    void fetch("/api/groups", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: GroupsPayload | null) => {
        if (!data?.authenticated) return;
        if ((data.memberships ?? []).length > 0) return;
        setOpen(true);
      })
      .catch(() => undefined);
  }, []);

  if (!open) return null;

  return (
    <div className="group-onboarding" role="dialog" aria-label="Join your groups">
      <div className="group-onboarding-card">
        <h2>Join your campus groups</h2>
        <p>
          Pick the groups you belong to and a theme color. You can skip and manage this later under
          Manage → Groups.
        </p>
        <GroupSettingsPanel compact />
        <div className="group-onboarding-actions">
          <button
            type="button"
            className="brief-link"
            onClick={() => {
              window.localStorage.setItem(SKIP_ONBOARDING_KEY, "1");
              setOpen(false);
            }}
          >
            Skip for now
          </button>
          <button
            type="button"
            className="watchlist-add-button"
            onClick={() => {
              window.localStorage.setItem(SKIP_ONBOARDING_KEY, "1");
              setOpen(false);
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import type { Community, UserCommunityMembership } from "@/lib/groups/types";
import { writeStoredPrimaryColor, SKIP_ONBOARDING_KEY } from "@/components/GroupAccentProvider";

const THEME_SWATCHES = ["#115740", "#0D7377", "#2E5A88", "#5B2C6F", "#C45C26", "#8B1E1E"];

type CommunitiesPayload = {
  authenticated: boolean;
  communities: Community[];
  memberships: UserCommunityMembership[];
  primaryCommunity: UserCommunityMembership | null;
  primaryGroup: { primaryColor: string | null } | null;
};

export function CommunitySettingsPanel({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<CommunitiesPayload | null>(null);
  const [themeColor, setThemeColor] = useState(THEME_SWATCHES[0]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function reload() {
    const res = await fetch("/api/groups", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as CommunitiesPayload;
    setData(json);
    const accent =
      json.primaryCommunity?.primaryColor ?? json.primaryGroup?.primaryColor ?? null;
    writeStoredPrimaryColor(accent);
    if (accent) {
      document.documentElement.style.setProperty("--group-accent", accent);
      setThemeColor(accent);
    }
  }

  useEffect(() => {
    void reload().catch(() => undefined);
  }, []);

  const memberIds = useMemo(
    () => new Set((data?.memberships ?? []).map((m) => m.institutionId)),
    [data],
  );

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
        setMessage(json.error ?? "Could not update communities.");
        return;
      }
      await reload();
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return <p className="crowd-empty">Loading communities…</p>;
  }

  return (
    <section
      className={`group-settings${compact ? " is-compact" : ""}`}
      aria-label="Your communities"
    >
      {!data.authenticated ? (
        <p className="group-settings-note">
          Sign in to join a campus or company community. Guests can still browse Crowd filters.
        </p>
      ) : null}

      <ul className="group-settings-list">
        {(data.memberships ?? []).map((membership) => (
          <li key={membership.institutionId}>
            <span
              className="group-badge"
              style={
                membership.primaryColor
                  ? { ["--group-accent" as string]: membership.primaryColor }
                  : undefined
              }
            >
              {membership.institution.name}
              {membership.isPrimary ? " · Primary" : ""}
            </span>
            <span className="group-settings-actions">
              {!membership.isPrimary ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void post({
                      action: "primary",
                      institutionId: membership.institutionId,
                    })
                  }
                >
                  Make primary
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void post({
                    action: "leave",
                    institutionId: membership.institutionId,
                  })
                }
              >
                Leave
              </button>
            </span>
          </li>
        ))}
      </ul>

      {data.authenticated ? (
        <>
          <div className="group-settings-join">
            <label>
              Join a community
              <select
                defaultValue=""
                disabled={busy}
                onChange={(event) => {
                  const institutionId = event.target.value;
                  if (!institutionId) return;
                  void post({
                    action: "join",
                    institutionId,
                    isPrimary: (data.memberships ?? []).length === 0,
                  });
                  event.target.value = "";
                }}
              >
                <option value="">Select…</option>
                {data.communities
                  .filter((community) => !memberIds.has(community.institution.id))
                  .map((community) => (
                    <option key={community.institution.id} value={community.institution.id}>
                      {community.institution.name}
                      {community.institution.affiliationStatus === "unofficial"
                        ? " (unofficial)"
                        : ""}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          {data.memberships.length > 0 ? (
            <div className="group-settings-create">
              <label>
                Theme color
                <span className="group-theme-swatches">
                  {THEME_SWATCHES.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      className={`group-theme-swatch${themeColor === swatch ? " is-selected" : ""}`}
                      style={{ background: swatch }}
                      aria-label={`Theme ${swatch}`}
                      disabled={busy}
                      onClick={() => {
                        setThemeColor(swatch);
                        const primary =
                          data.memberships.find((m) => m.isPrimary) ?? data.memberships[0];
                        if (!primary) return;
                        void post({
                          action: "theme",
                          institutionId: primary.institutionId,
                          primaryColor: swatch,
                        });
                      }}
                    />
                  ))}
                </span>
              </label>
            </div>
          ) : null}

          <p className="group-settings-note">
            Each school or company is one community. Clubs and competitions may return later —
            they are not created from here.
          </p>
        </>
      ) : null}

      {message ? <p className="group-settings-message">{message}</p> : null}
    </section>
  );
}

/** @deprecated Prefer CommunitySettingsPanel — alias kept for Manage imports. */
export const GroupSettingsPanel = CommunitySettingsPanel;

/** Skippable post-signup prompt — does not block registration. */
export function GroupOnboardingPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(SKIP_ONBOARDING_KEY)) return;
    void fetch("/api/groups", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: CommunitiesPayload | null) => {
        if (!data?.authenticated) return;
        if ((data.memberships ?? []).length > 0) return;
        setOpen(true);
      })
      .catch(() => undefined);
  }, []);

  if (!open) return null;

  return (
    <div className="group-onboarding" role="dialog" aria-label="Join your community">
      <div className="group-onboarding-card">
        <h2>Join your community</h2>
        <p>
          Pick your school or company and a theme color. You can skip and manage this later under
          Manage → Community.
        </p>
        <CommunitySettingsPanel compact />
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

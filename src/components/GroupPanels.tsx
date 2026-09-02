"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { InstitutionSearchSuggestion } from "@/lib/groups/institution-directory";
import type { Community, UserCommunityMembership } from "@/lib/groups/types";
import { SchoolLogo } from "@/components/crowd/SchoolLogo";
import { SchoolTypeahead } from "@/components/SchoolTypeahead";
import { writeStoredPrimaryColor, SKIP_ONBOARDING_KEY, hasSessionCookie } from "@/components/GroupAccentProvider";

export const THEME_SWATCHES = ["#115740", "#0D7377", "#2E5A88", "#5B2C6F", "#C45C26", "#8B1E1E", "#D6001C"];

const THEME_SWATCH_LABELS: Record<string, string> = {
  "#115740": "Forest",
  "#0D7377": "Teal",
  "#2E5A88": "Navy",
  "#5B2C6F": "Plum",
  "#C45C26": "Copper",
  "#8B1E1E": "Garnet",
  "#D6001C": "Crimson",
};

type CommunitiesPayload = {
  authenticated: boolean;
  communities: Community[];
  memberships: UserCommunityMembership[];
  primaryCommunity: UserCommunityMembership | null;
  primaryGroup: { primaryColor: string | null } | null;
};

const EMPTY_COMMUNITIES_PAYLOAD: CommunitiesPayload = {
  authenticated: false,
  communities: [],
  memberships: [],
  primaryCommunity: null,
  primaryGroup: null,
};

export function CommunitySettingsPanel({
  compact = false,
  onboarding = false,
  onJoined,
  onChanged,
}: {
  compact?: boolean;
  /** Onboarding: theme before join, search-first UX. */
  onboarding?: boolean;
  onJoined?: () => void;
  /** Fired after any successful membership/theme mutation. */
  onChanged?: () => void;
}) {
  const [data, setData] = useState<CommunitiesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [themeColor, setThemeColor] = useState(THEME_SWATCHES[0]);
  const [schoolQuery, setSchoolQuery] = useState("");
  const [pickedSchool, setPickedSchool] = useState<InstitutionSearchSuggestion | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/groups", { cache: "no-store", credentials: "include" });
      if (!res.ok) {
        throw new Error("Could not load communities. Try again.");
      }
      const json = (await res.json()) as CommunitiesPayload;
      setData(json);
      const accent =
        json.primaryCommunity?.primaryColor ?? json.primaryGroup?.primaryColor ?? null;
      writeStoredPrimaryColor(accent);
      if (accent) {
        document.documentElement.style.setProperty("--group-accent", accent);
        setThemeColor(accent);
      }
      return json;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not load communities. Try again.";
      setLoadError(message);
      setData((current) => current ?? EMPTY_COMMUNITIES_PAYLOAD);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

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
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as CommunitiesPayload & { error?: string };
      if (!res.ok) {
        setMessage(json.error ?? "Could not update communities.");
        return false;
      }
      if (Array.isArray(json.memberships)) {
        setData((current) => ({
          ...(current ?? EMPTY_COMMUNITIES_PAYLOAD),
          authenticated: json.authenticated ?? current?.authenticated ?? true,
          communities: json.communities ?? current?.communities ?? [],
          memberships: json.memberships,
          primaryCommunity: json.primaryCommunity ?? null,
          primaryGroup: json.primaryGroup ?? null,
        }));
        const accent =
          json.primaryCommunity?.primaryColor ?? json.primaryGroup?.primaryColor ?? null;
        if (accent) {
          writeStoredPrimaryColor(accent);
          document.documentElement.style.setProperty("--group-accent", accent);
          setThemeColor(accent);
        }
        onChanged?.();
      } else {
        await reload();
        onChanged?.();
      }
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function joinPickedSchool() {
    if (!pickedSchool) {
      setMessage("Search and pick your school first.");
      return;
    }
    if (memberIds.has(pickedSchool.institutionId)) {
      setMessage("You are already in that community.");
      return;
    }
    const ok = await post({
      action: "join",
      ncaaId: pickedSchool.ncaaId,
      isPrimary: (data?.memberships ?? []).length === 0,
      primaryColor: themeColor,
    });
    if (ok) {
      writeStoredPrimaryColor(themeColor);
      document.documentElement.style.setProperty("--group-accent", themeColor);
      setPickedSchool(null);
      setSchoolQuery("");
      setMessage("Community saved.");
      onJoined?.();
    }
  }

  async function saveThemeForMembership(institutionId: string, swatch: string) {
    setThemeColor(swatch);
    writeStoredPrimaryColor(swatch);
    document.documentElement.style.setProperty("--group-accent", swatch);
    const ok = await post({
      action: "theme",
      institutionId,
      primaryColor: swatch,
    });
    if (ok) setMessage("Theme color saved.");
  }

  function previewTheme(swatch: string) {
    setThemeColor(swatch);
    writeStoredPrimaryColor(swatch);
    document.documentElement.style.setProperty("--group-accent", swatch);
  }

  if (loading && !data) {
    return <p className="crowd-empty">Loading communities…</p>;
  }

  const panelData = data ?? EMPTY_COMMUNITIES_PAYLOAD;

  if (loadError && panelData.memberships.length === 0) {
    return (
      <div className="group-settings group-settings-error">
        <p className="crowd-empty">{loadError}</p>
        <button type="button" className="brief-link" onClick={() => void reload()}>
          Retry
        </button>
      </div>
    );
  }

  const showTheme =
    onboarding || panelData.memberships.length > 0 || Boolean(pickedSchool);
  const showJoinSearch =
    panelData.authenticated &&
    (onboarding || panelData.memberships.length === 0 || !compact);
  const pendingJoin =
    Boolean(pickedSchool) && !memberIds.has(pickedSchool?.institutionId ?? "");
  const themeTarget =
    panelData.memberships.find((m) => m.isPrimary) ?? panelData.memberships[0] ?? null;

  function handleThemePick(swatch: string) {
    if (pendingJoin) {
      previewTheme(swatch);
      return;
    }
    if (themeTarget) {
      void saveThemeForMembership(themeTarget.institutionId, swatch);
      return;
    }
    previewTheme(swatch);
  }

  return (
    <section
      className={`group-settings${compact ? " is-compact" : ""}${onboarding ? " is-onboarding" : ""}`}
      aria-label="Your communities"
    >
      {loadError ? <p className="group-settings-message">{loadError}</p> : null}

      {!panelData.authenticated ? (
        <p className="group-settings-note">
          Sign in to join a campus community. Guests can still browse Crowd filters.
        </p>
      ) : null}

      <ul className="group-settings-list">
        {(panelData.memberships ?? []).map((membership) => (
          <li key={membership.institutionId}>
            <span
              className="group-badge"
              style={
                membership.primaryColor
                  ? { ["--group-accent" as string]: membership.primaryColor }
                  : undefined
              }
            >
              <SchoolLogo
                name={membership.institution.name}
                domain={membership.institution.canonicalDomain}
                ncaaId={membership.institution.ncaaId}
                accentColor={
                  membership.institution.accentColor ?? membership.primaryColor
                }
                size={22}
                className="group-badge-logo"
              />
              {membership.institution.name}
              {membership.isPrimary ? " · Primary" : ""}
            </span>
            {!onboarding ? (
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
            ) : null}
          </li>
        ))}
      </ul>

      {showJoinSearch ? (
        <div className="group-settings-join">
          <label>
            {onboarding ? "Find your school" : "Join another school"}
            <SchoolTypeahead
              value={schoolQuery}
              onChange={setSchoolQuery}
              selectedInstitutionId={pickedSchool?.institutionId}
              onClearSelection={() => setPickedSchool(null)}
              disabled={busy || !panelData.authenticated}
              onSelect={(suggestion) => {
                setPickedSchool(suggestion);
                setSchoolQuery(suggestion.name);
                setMessage(null);
              }}
            />
          </label>
          {pickedSchool ? (
            <p className="group-settings-note">
              {pendingJoin
                ? "Pick a theme color, then save your school below."
                : "You are already in this community."}
            </p>
          ) : null}
        </div>
      ) : null}

      {showTheme && panelData.authenticated ? (
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
                  aria-label={THEME_SWATCH_LABELS[swatch] ?? "Theme color"}
                  aria-pressed={themeColor === swatch}
                  disabled={busy}
                  onClick={() => handleThemePick(swatch)}
                />
              ))}
            </span>
          </label>
          {pendingJoin ? (
            <p className="group-settings-note">
              Color applies when you tap Save &amp; join.
            </p>
          ) : themeTarget ? (
            <p className="group-settings-note">Tap a swatch to save your theme color.</p>
          ) : null}
        </div>
      ) : null}

      {showJoinSearch && pickedSchool && pendingJoin ? (
        <button
          type="button"
          className="watchlist-add-button group-settings-join-btn"
          disabled={busy}
          onClick={() => void joinPickedSchool()}
        >
          {busy ? "Saving…" : `Save & join ${pickedSchool.name}`}
        </button>
      ) : null}

      {!onboarding ? (
        <p className="group-settings-note">
          Search any NCAA school to join its community. You will be the first member if nobody
          from your school has joined yet.
        </p>
      ) : null}

      {message ? <p className="group-settings-message">{message}</p> : null}
    </section>
  );
}

/** @deprecated Prefer CommunitySettingsPanel — alias kept for Manage imports. */
export const GroupSettingsPanel = CommunitySettingsPanel;

function shouldOpenOnboarding(data: CommunitiesPayload | null): boolean {
  if (!data?.authenticated) return false;
  if ((data.memberships ?? []).length > 0) return false;
  return true;
}

/** Skippable post-signup prompt — tap outside to dismiss for this visit. */
export function GroupOnboardingPrompt() {
  const [open, setOpen] = useState(false);

  const evaluate = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(SKIP_ONBOARDING_KEY)) return;
    // Guests never need onboarding — skip the membership probe.
    if (!hasSessionCookie()) return;
    try {
      const res = await fetch("/api/groups", { cache: "no-store", credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as CommunitiesPayload;
      setOpen(shouldOpenOnboarding(data));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void evaluate();
    // Once per mount — do not re-hit /api/groups on every focus/visibility.
  }, [evaluate]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function finish(skipForever: boolean) {
    if (skipForever) window.localStorage.setItem(SKIP_ONBOARDING_KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="group-onboarding"
      role="presentation"
      onClick={() => setOpen(false)}
    >
      <div
        className="group-onboarding-card"
        role="dialog"
        aria-modal="true"
        aria-label="Join your community"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Join your community</h2>
        <p>
          Search your school, pick a color, then join. Tap outside to close — or manage anytime on
          Crowd.
        </p>
        <CommunitySettingsPanel
          compact
          onboarding
          onJoined={() => finish(true)}
        />
        <div className="group-onboarding-actions">
          <button type="button" className="brief-link" onClick={() => finish(true)}>
            Skip for now
          </button>
          <button type="button" className="watchlist-add-button" onClick={() => finish(true)}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

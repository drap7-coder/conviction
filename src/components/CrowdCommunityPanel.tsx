"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { SchoolLogo } from "@/components/crowd/SchoolLogo";
import { CommunitySettingsPanel } from "@/components/GroupPanels";
import type { UserCommunityMembership } from "@/lib/groups/types";

type CommunitiesPayload = {
  authenticated: boolean;
  memberships: UserCommunityMembership[];
  primaryCommunity: UserCommunityMembership | null;
};

const EMPTY_PAYLOAD: CommunitiesPayload = {
  authenticated: false,
  memberships: [],
  primaryCommunity: null,
};

/** Crowd campus hub — join/edit community with optional expanded roster chrome. */
export function CrowdCommunityPanel({ expanded = false }: { expanded?: boolean }) {
  const [data, setData] = useState<CommunitiesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/groups", { cache: "no-store", credentials: "include" });
      if (!res.ok) {
        throw new Error("Could not load your community.");
      }
      const json = (await res.json()) as CommunitiesPayload;
      setData(json);
      return json;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not load your community.";
      setLoadError(message);
      setData((current) => current ?? EMPTY_PAYLOAD);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload().then((json) => {
      if (expanded) {
        setOpen(true);
        return;
      }
      if (json?.authenticated && (json.memberships ?? []).length === 0) {
        setOpen(true);
      }
    });
  }, [expanded, reload]);

  const panelData = data ?? EMPTY_PAYLOAD;
  const primary =
    panelData.primaryCommunity ??
    panelData.memberships?.find((m) => m.isPrimary) ??
    panelData.memberships?.[0] ??
    null;
  const campusAccent =
    primary?.institution.accentColor ?? primary?.primaryColor ?? null;

  let summary = "Loading…";
  if (!loading && loadError && !primary) {
    summary = loadError;
  } else if (!loading && panelData && !panelData.authenticated) {
    summary = "Sign in to join your school community.";
  } else if (!loading && primary) {
    summary = primary.institution.name;
  } else if (!loading) {
    summary = "Pick your school to join the Crowd.";
  }

  return (
    <section
      className={`surface-shell crowd-community-panel${expanded ? " is-expanded" : ""}`}
      aria-label="Your community"
      style={
        campusAccent
          ? ({ ["--campus-accent" as string]: campusAccent } as CSSProperties)
          : undefined
      }
    >
      <div className="crowd-community-head">
        {primary ? (
          <SchoolLogo
            name={primary.institution.name}
            domain={primary.institution.canonicalDomain}
            ncaaId={primary.institution.ncaaId}
            accentColor={campusAccent}
            size={expanded ? 44 : 36}
            className="crowd-community-logo"
          />
        ) : null}
        <div className="crowd-community-copy">
          <p className="crowd-community-eyebrow">
            {expanded ? "My community" : "Your community"}
          </p>
          <p className="crowd-community-summary">{summary}</p>
          {expanded && primary ? (
            <p className="crowd-community-meta">
              {[
                primary.institution.conference,
                primary.institution.canonicalDomain,
                primary.isPrimary ? "Primary campus" : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Campus community"}
            </p>
          ) : null}
        </div>
        <div className="crowd-community-actions">
          {!loading && loadError && !primary ? (
            <button type="button" className="brief-link" onClick={() => void reload()}>
              Retry
            </button>
          ) : !panelData.authenticated && !loading ? (
            <Link className="watchlist-add-button" href="/signin">
              Sign in
            </Link>
          ) : !loading ? (
            <button
              type="button"
              className="brief-link"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? "Close" : primary ? "Edit" : "Join"}
            </button>
          ) : null}
        </div>
      </div>

      {expanded && primary ? (
        <div className="crowd-community-roster" aria-label="Campus members">
          <div className="crowd-community-roster-card">
            <span className="crowd-community-roster-label">Campus</span>
            <strong className="crowd-community-roster-campus">
              <SchoolLogo
                name={primary.institution.name}
                domain={primary.institution.canonicalDomain}
                ncaaId={primary.institution.ncaaId}
                accentColor={campusAccent}
                size={22}
              />
              {primary.institution.name}
            </strong>
          </div>
          <div className="crowd-community-roster-card">
            <span className="crowd-community-roster-label">Accent</span>
            <strong className="crowd-community-swatch" style={{ background: campusAccent ?? undefined }}>
              {campusAccent ?? "—"}
            </strong>
          </div>
          <div className="crowd-community-roster-card">
            <span className="crowd-community-roster-label">Memberships</span>
            <strong>{panelData.memberships.length}</strong>
          </div>
        </div>
      ) : null}

      {open && panelData.authenticated ? (
        <CommunitySettingsPanel
          compact={!expanded}
          onboarding={panelData.memberships.length === 0}
          onJoined={() => {
            void reload();
          }}
        />
      ) : null}

      {expanded && !panelData.authenticated && !loading ? (
        <p className="crowd-hedge">
          Join your school to unlock campus standings, rivalry, and a permanent pick score.
        </p>
      ) : null}
    </section>
  );
}

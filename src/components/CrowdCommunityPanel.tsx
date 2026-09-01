"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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

/** Crowd-native community identity — join or edit without leaving the board. */
export function CrowdCommunityPanel() {
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
      if (json?.authenticated && (json.memberships ?? []).length === 0) {
        setOpen(true);
      }
    });
  }, [reload]);

  const panelData = data ?? EMPTY_PAYLOAD;
  const primary =
    panelData.primaryCommunity ??
    panelData.memberships?.find((m) => m.isPrimary) ??
    panelData.memberships?.[0] ??
    null;

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
    <section className="surface-shell crowd-community-panel" aria-label="Your community">
      <div className="crowd-community-head">
        <div className="crowd-community-copy">
          <p className="crowd-community-eyebrow">Your community</p>
          <p className="crowd-community-summary">{summary}</p>
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

      {open && panelData.authenticated ? (
        <CommunitySettingsPanel
          compact
          onboarding={panelData.memberships.length === 0}
          onJoined={() => {
            void reload();
          }}
        />
      ) : null}
    </section>
  );
}

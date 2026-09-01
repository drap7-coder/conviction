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

/** Crowd-native community identity — join or edit without leaving the board. */
export function CrowdCommunityPanel() {
  const [data, setData] = useState<CommunitiesPayload | null>(null);
  const [open, setOpen] = useState(false);

  const reload = useCallback(async () => {
    const res = await fetch("/api/groups", { cache: "no-store", credentials: "include" });
    if (!res.ok) return null;
    const json = (await res.json()) as CommunitiesPayload;
    setData(json);
    return json;
  }, []);

  useEffect(() => {
    void reload().then((json) => {
      if (json?.authenticated && (json.memberships ?? []).length === 0) {
        setOpen(true);
      }
    });
  }, [reload]);

  const primary =
    data?.primaryCommunity ??
    data?.memberships?.find((m) => m.isPrimary) ??
    data?.memberships?.[0] ??
    null;

  let summary = "Loading…";
  if (data && !data.authenticated) {
    summary = "Sign in to join your school community.";
  } else if (data && primary) {
    summary = primary.institution.name;
  } else if (data) {
    summary = "Pick your school to join the Crowd.";
  }

  return (
    <section className="surface-shell crowd-community-panel" aria-label="Your community">
      <div className="crowd-community-head">
        <div className="crowd-community-copy">
          <p className="crowd-community-eyebrow">Your community</p>
          <div className="crowd-community-summary-row">
            {primary?.institution.accentColor ? (
              <span
                className="crowd-community-badge"
                style={{ ["--campus-accent" as string]: primary.institution.accentColor }}
              >
                {primary.institution.name}
              </span>
            ) : (
              <p className="crowd-community-summary">{summary}</p>
            )}
          </div>
        </div>
        <div className="crowd-community-actions">
          {!data?.authenticated ? (
            <Link className="watchlist-add-button" href="/signin">
              Sign in
            </Link>
          ) : (
            <button
              type="button"
              className="brief-link"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? "Close" : primary ? "Edit" : "Join"}
            </button>
          )}
        </div>
      </div>

      {open && data?.authenticated ? (
        <CommunitySettingsPanel
          compact
          onJoined={() => {
            void reload();
            setOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}

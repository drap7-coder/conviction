"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Community, Group, Institution } from "@/lib/groups/types";
import { writeStoredPrimaryColor, SKIP_ONBOARDING_KEY, applyGroupAccent } from "@/components/GroupAccentProvider";

type InvitePayload = {
  institution: Institution;
  group: Group;
  community: Community;
  unofficial: boolean;
};

export function JoinInviteClient({ code }: { code: string }) {
  const router = useRouter();
  const [invite, setInvite] = useState<InvitePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/join/${encodeURIComponent(code)}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Invite not found.");
        if (!cancelled) setInvite(json as InvitePayload);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Invite not found.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function joinNow() {
    if (!invite) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "invite",
          inviteCode: code,
          isPrimary: true,
        }),
      });
      const json = await res.json();
      if (res.status === 401) {
        router.push(`/signin?callbackUrl=${encodeURIComponent(`/join/${code}`)}`);
        return;
      }
      if (!res.ok) {
        setError(json.error ?? "Could not join.");
        return;
      }
      const color =
        (json.community as Community | undefined)?.primaryColor ??
        invite.community.primaryColor ??
        invite.institution.accentColor;
      writeStoredPrimaryColor(color);
      if (color) applyGroupAccent(color);
      window.localStorage.setItem(SKIP_ONBOARDING_KEY, "1");
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  if (error && !invite) {
    return (
      <main className="join-page">
        <section className="join-card">
          <h1>Invite not found</h1>
          <p>{error}</p>
          <Link href="/pulse">Back to Pulse</Link>
        </section>
      </main>
    );
  }

  if (!invite) {
    return (
      <main className="join-page">
        <section className="join-card">
          <p>Loading invite…</p>
        </section>
      </main>
    );
  }

  const { institution, community, unofficial } = invite;
  const accent = community.primaryColor ?? institution.accentColor;

  return (
    <main className="join-page">
      <section
        className="join-card"
        style={accent ? { ["--group-accent" as string]: accent } : undefined}
      >
        <p className="join-eyebrow">Community</p>
        <h1>Join {institution.name}</h1>
        {unofficial ? (
          <p className="join-hedge">
            Unofficial community workspace — not affiliated with {institution.name}. No official
            logos or protected branding.
          </p>
        ) : null}
        <p className="join-copy">
          Sign in with Google, join the {institution.name} community, and start adding stocks.
        </p>

        {done ? (
          <div className="join-done">
            <p>You&apos;re in the {institution.name} community.</p>
            <nav className="join-actions">
              <Link className="watchlist-add-button" href="/manage?view=portfolio">
                Add stocks
              </Link>
              <Link href="/crowd">See Crowd</Link>
            </nav>
          </div>
        ) : (
          <div className="join-actions">
            <button
              type="button"
              className="watchlist-add-button"
              disabled={busy}
              onClick={() => void joinNow()}
            >
              {busy ? "Joining…" : "Continue with Google / Join"}
            </button>
            <Link href={`/signin?callbackUrl=${encodeURIComponent(`/join/${code}`)}`}>
              Sign in first
            </Link>
          </div>
        )}

        {error ? <p className="join-error">{error}</p> : null}
      </section>
    </main>
  );
}

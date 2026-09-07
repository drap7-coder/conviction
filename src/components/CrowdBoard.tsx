"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CrowdCommunityPanel } from "@/components/CrowdCommunityPanel";
import { CommunityPickCard } from "@/components/CommunityPickCard";
import { YourPicksCard } from "@/components/YourPicksCard";
import { HeadToHeadMatchCard } from "@/components/HeadToHeadMatchCard";
import { SurfaceSlicer } from "@/components/SurfaceSlicer";
import type { HeadToHeadPayload } from "@/lib/competitions/types";
import type { CommunityPicksPayload } from "@/lib/community-picks/types";
import { communityRankingRequirementLabel } from "@/lib/community-picks/constants";
import {
  DEFAULT_H2H_PERF_RANGE,
  type H2HPerfRange,
} from "@/lib/competitions/perf-range";

export type CrowdTab = "pick" | "standings" | "community";

export type CrowdStandingsPayload = {
  headToHead: HeadToHeadPayload;
  community: CommunityPicksPayload;
  range?: H2HPerfRange;
};

const TABS: Array<{ id: CrowdTab; label: string }> = [
  { id: "standings", label: "Standings" },
  { id: "pick", label: "My Pick" },
  { id: "community", label: "My Community" },
];

/** Parse Crowd tab from `?tab=` with legacy `?view=` fallbacks. Default: Standings. */
export function parseCrowdView(value: string | null | undefined): CrowdTab {
  if (value === "standings" || value === "community" || value === "pick") return value;
  // Legacy Crowd aggregations moved to Portfolio.
  if (value === "held" || value === "watched" || value === "rivalry") return "standings";
  return "standings";
}

async function loadCrowdStandings(): Promise<CrowdStandingsPayload> {
  const res = await fetch("/api/crowd/standings", {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw new Error("Could not load standings.");
  return res.json() as Promise<CrowdStandingsPayload>;
}

export function CrowdBoard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = searchParams.get("tab") ?? searchParams.get("view");
  const [tab, setTab] = useState<CrowdTab>(() => parseCrowdView(tabParam));
  const [standings, setStandings] = useState<CrowdStandingsPayload | null>(null);
  const [standingsError, setStandingsError] = useState<string | null>(null);

  useEffect(() => {
    setTab(parseCrowdView(searchParams.get("tab") ?? searchParams.get("view")));
  }, [searchParams]);

  // Redirect legacy held/watched query params to Portfolio.
  useEffect(() => {
    const legacy = searchParams.get("view");
    if (legacy === "held" || legacy === "watched") {
      router.replace(`/portfolio?view=${legacy}`, { scroll: false });
    }
  }, [router, searchParams]);

  // Standings tab: one combined fetch for H2H + community board (shared $100k window).
  useEffect(() => {
    if (tab !== "standings") return;
    let cancelled = false;
    setStandingsError(null);
    void loadCrowdStandings()
      .then((payload) => {
        if (!cancelled) setStandings(payload);
      })
      .catch((reason) => {
        if (!cancelled) {
          setStandings(null);
          setStandingsError(
            reason instanceof Error ? reason.message : "Could not load standings.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const standingsRange = standings?.range ?? DEFAULT_H2H_PERF_RANGE;

  function selectTab(next: CrowdTab) {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("view");
    params.delete("range");
    if (next === "standings") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="crowd-page-body">
      <SurfaceSlicer
        label="Crowd view"
        options={TABS}
        activeId={tab}
        onChange={(id) => selectTab(parseCrowdView(id))}
        role="tablist"
      />

      {tab === "standings" ? (
        <div className="crowd-standings-panel" role="tabpanel" aria-label="Standings">
          <p className="crowd-bankroll-lead">
            Each player starts with <strong>$100,000</strong>. School score is the average student
            balance on that book — more members don&apos;t inflate the dollars.
          </p>
          {standingsError ? (
            <p className="crowd-empty" role="alert">
              {standingsError}
            </p>
          ) : null}
          <HeadToHeadMatchCard
            initialPayload={standings?.headToHead ?? null}
            range={standingsRange}
            waitForParent={!standingsError}
          />
          <CommunityPickCard
            variant="standings"
            range={standingsRange}
            initialPayload={standings?.community ?? null}
          />
          <p className="crowd-hedge">
            Head-to-head and community standings use the same weekly average on each player&apos;s
            $100,000 book. Unranked schools {communityRankingRequirementLabel()}.
          </p>
        </div>
      ) : null}

      {tab === "pick" ? (
        <div className="crowd-pick-panel" role="tabpanel" aria-label="My pick">
          <YourPicksCard />
          <p className="crowd-hedge">
            Each player starts with $100,000 — equal-weight across your five calls. Incomplete boards
            can play immediately; finish all five to join the leaderboard.
          </p>
        </div>
      ) : null}

      {tab === "community" ? (
        <div className="crowd-community-tab" role="tabpanel" aria-label="My community">
          <CrowdCommunityPanel expanded />
        </div>
      ) : null}
    </div>
  );
}

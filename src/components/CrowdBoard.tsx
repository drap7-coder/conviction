"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CrowdCommunityPanel } from "@/components/CrowdCommunityPanel";
import { CommunityPickCard } from "@/components/CommunityPickCard";
import { HeadToHeadMatchCard } from "@/components/HeadToHeadMatchCard";
import { PerfRangeSelect } from "@/components/crowd/PerfRangeSelect";
import { SurfaceSlicer } from "@/components/SurfaceSlicer";
import {
  DEFAULT_H2H_PERF_RANGE,
  parseH2HPerfRange,
  type H2HPerfRange,
} from "@/lib/competitions/perf-range";
import type { HeadToHeadPayload } from "@/lib/competitions/types";
import type { CommunityPicksPayload } from "@/lib/community-picks/types";

export type CrowdTab = "pick" | "standings" | "community";

export type CrowdStandingsPayload = {
  range: H2HPerfRange;
  headToHead: HeadToHeadPayload;
  community: CommunityPicksPayload;
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

async function loadCrowdStandings(range: H2HPerfRange): Promise<CrowdStandingsPayload> {
  const params = new URLSearchParams();
  params.set("range", range);
  const res = await fetch(`/api/crowd/standings?${params.toString()}`, {
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
  const [range, setRange] = useState<H2HPerfRange>(() =>
    parseH2HPerfRange(searchParams.get("range")),
  );
  const [standings, setStandings] = useState<CrowdStandingsPayload | null>(null);
  const [standingsError, setStandingsError] = useState<string | null>(null);

  useEffect(() => {
    setTab(parseCrowdView(searchParams.get("tab") ?? searchParams.get("view")));
    setRange(parseH2HPerfRange(searchParams.get("range")));
  }, [searchParams]);

  // Redirect legacy held/watched query params to Portfolio.
  useEffect(() => {
    const legacy = searchParams.get("view");
    if (legacy === "held" || legacy === "watched") {
      router.replace(`/portfolio?view=${legacy}`, { scroll: false });
    }
  }, [router, searchParams]);

  // Standings tab: one combined fetch for H2H + community board.
  useEffect(() => {
    if (tab !== "standings") return;
    let cancelled = false;
    setStandingsError(null);
    void loadCrowdStandings(range)
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
  }, [tab, range]);

  function selectTab(next: CrowdTab) {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("view");
    if (next === "standings") {
      params.delete("tab");
    } else {
      params.set("tab", next);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function selectRange(next: H2HPerfRange) {
    setRange(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === DEFAULT_H2H_PERF_RANGE) {
      params.delete("range");
    } else {
      params.set("range", next);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <div className="crowd-page-body">
      <div className="crowd-chrome-bar">
        <SurfaceSlicer
          label="Crowd view"
          options={TABS}
          activeId={tab}
          onChange={(id) => selectTab(parseCrowdView(id))}
          role="tablist"
          className="crowd-view-slicer"
        />
        {tab === "standings" ? (
          <PerfRangeSelect value={range} onChange={selectRange} />
        ) : null}
      </div>

      {tab === "standings" ? (
        <div className="crowd-standings-panel" role="tabpanel" aria-label="Standings">
          {standingsError ? (
            <p className="crowd-empty" role="alert">
              {standingsError}
            </p>
          ) : null}
          <HeadToHeadMatchCard range={range} initialPayload={standings?.headToHead ?? null} />
          <CommunityPickCard
            variant="standings"
            range={range}
            initialPayload={standings?.community ?? null}
          />
          <p className="crowd-hedge">
            Head-to-head and community standings use the same Performance window — equal-weight
            My Pick returns for that range. Schools below the member threshold stay unranked on
            the board below.
          </p>
        </div>
      ) : null}

      {tab === "pick" ? (
        <div className="crowd-pick-panel" role="tabpanel" aria-label="My pick">
          <CommunityPickCard variant="pick" />
          <p className="crowd-hedge">
            One current ticker per member. Swapping banks the old pick into your lifetime score.
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

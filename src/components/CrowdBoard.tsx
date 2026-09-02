"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CrowdCommunityPanel } from "@/components/CrowdCommunityPanel";
import { CommunityPickCard } from "@/components/CommunityPickCard";
import { HeadToHeadMatchCard } from "@/components/HeadToHeadMatchCard";
import { SurfaceSlicer } from "@/components/SurfaceSlicer";

export type CrowdTab = "pick" | "standings" | "community";

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

export function CrowdBoard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = searchParams.get("tab") ?? searchParams.get("view");
  const [tab, setTab] = useState<CrowdTab>(() => parseCrowdView(tabParam));

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
          <HeadToHeadMatchCard />
          <CommunityPickCard variant="standings" />
          <p className="crowd-hedge">
            Head-to-head compares each school&apos;s average My Pick lifetime return — continuous,
            not a weekly window. Schools below the member threshold stay unranked on the board
            below.
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

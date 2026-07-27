"use client";

import { Suspense, type ReactNode, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Watchlist from "@/components/Watchlist";
import Portfolio from "@/components/Portfolio";
import { PortfolioDataProvider, PortfolioHero } from "@/components/PortfolioData";

const MY_LIST_VIEWS = [
  { id: "watchlist", label: "Watchlist" },
  { id: "portfolio", label: "Portfolio" },
] as const;

type MyListView = (typeof MY_LIST_VIEWS)[number]["id"];

function parseView(value: string | null): MyListView {
  return value === "portfolio" ? "portfolio" : "watchlist";
}

function MyListShellInner({ publicFeed }: { publicFeed?: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeView = parseView(searchParams.get("view"));

  const setActiveView = useCallback(
    (view: MyListView) => {
      const href = view === "portfolio" ? "/watchlist?view=portfolio" : "/watchlist";
      router.replace(href, { scroll: false });
    },
    [router],
  );

  return (
    <div>
      <div className="page-purpose">
        <span className="page-purpose-eyebrow">My Positions</span>
        <h2 className="page-purpose-title">Watch what you follow, or review what you own.</h2>
      </div>

      {/* Portfolio value always visible */}
      <PortfolioHero />

      <section className="trending-view-picker" aria-label="My list views">
        <div className="trending-view-picker-copy">
          <span>My positions</span>
          <p>Watch what you follow, or review what you own.</p>
        </div>
        <div className="trending-view-tabs" role="tablist" aria-label="Choose a list view">
          {MY_LIST_VIEWS.map((view) => (
            <button
              key={view.id}
              id={`my-list-tab-${view.id}`}
              type="button"
              role="tab"
              aria-label={view.label}
              aria-selected={activeView === view.id}
              aria-controls={`my-list-panel-${view.id}`}
              className={activeView === view.id ? "active" : ""}
              onClick={() => setActiveView(view.id)}
            >
              <strong>{view.label}</strong>
            </button>
          ))}
        </div>
      </section>

      <div
        id="my-list-panel-watchlist"
        role="tabpanel"
        aria-labelledby="my-list-tab-watchlist"
        hidden={activeView !== "watchlist"}
      >
        {activeView === "watchlist" ? (
          <Watchlist hidePurpose>{publicFeed}</Watchlist>
        ) : null}
      </div>

      <div
        id="my-list-panel-portfolio"
        role="tabpanel"
        aria-labelledby="my-list-tab-portfolio"
        hidden={activeView !== "portfolio"}
      >
        {activeView === "portfolio" ? <Portfolio hideHero /> : null}
      </div>
    </div>
  );
}

export default function MyListShell({ publicFeed }: { publicFeed?: ReactNode }) {
  return (
    <Suspense fallback={<div className="page-purpose"><span className="page-purpose-eyebrow">My Positions</span><h2 className="page-purpose-title">Watch what you follow, or review what you own.</h2></div>}>
      <PortfolioDataProvider>
        <MyListShellInner publicFeed={publicFeed} />
      </PortfolioDataProvider>
    </Suspense>
  );
}
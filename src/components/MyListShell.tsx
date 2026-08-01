"use client";

import { Suspense, type ReactNode, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Watchlist from "@/components/Watchlist";
import Portfolio from "@/components/Portfolio";
import { PortfolioDataProvider, PortfolioHero, usePortfolioData } from "@/components/PortfolioData";

const MY_LIST_VIEWS = [
  {
    id: "watchlist",
    label: "Watchlist",
    description: "Companies you follow",
  },
  {
    id: "portfolio",
    label: "Portfolio",
    description: "Holdings you own",
  },
] as const;

type MyListView = (typeof MY_LIST_VIEWS)[number]["id"];

function parseView(value: string | null): MyListView {
  return value === "portfolio" ? "portfolio" : "watchlist";
}

function MyListShellInner({ publicFeed }: { publicFeed?: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeView = parseView(searchParams.get("view"));
  const { data: portfolio } = usePortfolioData();

  const setActiveView = useCallback(
    (view: MyListView) => {
      const href = view === "portfolio" ? "/watchlist?view=portfolio" : "/watchlist";
      router.replace(href, { scroll: false });
    },
    [router],
  );

  // Empty $0 portfolio hero was pushing scored watchlist rows far below the fold.
  const showPortfolioHero =
    activeView === "portfolio" || portfolio.hasData || portfolio.loading;

  return (
    <div className="my-list-shell">
      <section className="pulse-view-picker my-list-view-picker" aria-label="My list views">
        <div className="pulse-view-tabs" role="tablist" aria-label="Choose a list view">
          {MY_LIST_VIEWS.map((view) => (
            <button
              key={view.id}
              id={`my-list-tab-${view.id}`}
              type="button"
              role="tab"
              aria-label={`${view.label}: ${view.description}`}
              aria-selected={activeView === view.id}
              aria-controls={`my-list-panel-${view.id}`}
              className={activeView === view.id ? "active" : ""}
              onClick={() => setActiveView(view.id)}
            >
              <strong>{view.label}</strong>
              <span>{view.description}</span>
            </button>
          ))}
        </div>
      </section>

      {showPortfolioHero ? <PortfolioHero /> : null}

      <div
        id="my-list-panel-watchlist"
        role="tabpanel"
        aria-labelledby="my-list-tab-watchlist"
        hidden={activeView !== "watchlist"}
      >
        {activeView === "watchlist" ? (
          <Watchlist hidePurpose composeFirst>{publicFeed}</Watchlist>
        ) : null}
      </div>

      <div
        id="my-list-panel-portfolio"
        role="tabpanel"
        aria-labelledby="my-list-tab-portfolio"
        hidden={activeView !== "portfolio"}
      >
        {activeView === "portfolio" ? <Portfolio hideHero composeFirst /> : null}
      </div>
    </div>
  );
}

export default function MyListShell({ publicFeed }: { publicFeed?: ReactNode }) {
  return (
    <Suspense
      fallback={
        <section className="pulse-view-picker my-list-view-picker" aria-hidden="true">
          <div className="pulse-view-tabs">
            <button type="button" className="active" disabled>
              <strong>Watchlist</strong>
              <span>Loading your lists…</span>
            </button>
            <button type="button" disabled>
              <strong>Portfolio</strong>
              <span>Holdings you own</span>
            </button>
          </div>
        </section>
      }
    >
      <PortfolioDataProvider>
        <MyListShellInner publicFeed={publicFeed} />
      </PortfolioDataProvider>
    </Suspense>
  );
}

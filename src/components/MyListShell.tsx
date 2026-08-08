"use client";

import { Suspense, type ReactNode, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Watchlist from "@/components/Watchlist";
import Portfolio from "@/components/Portfolio";
import { PortfolioDataProvider, PortfolioHero, usePortfolioData } from "@/components/PortfolioData";
import { ViewSwitcher } from "@/components/ViewSwitcher";

const MY_LIST_VIEWS = [
  {
    id: "watchlist",
    label: "Watchlist",
    tabId: "my-list-tab-watchlist",
    panelId: "my-list-panel-watchlist",
  },
  {
    id: "portfolio",
    label: "Portfolio",
    tabId: "my-list-tab-portfolio",
    panelId: "my-list-panel-portfolio",
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
      <ViewSwitcher
        label="Choose a list view"
        options={[...MY_LIST_VIEWS]}
        activeId={activeView}
        onChange={(id) => setActiveView(id as MyListView)}
      />

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
        <div aria-hidden="true">
          <ViewSwitcher
            label="Choose a list view"
            options={[...MY_LIST_VIEWS]}
            activeId="watchlist"
            onChange={() => {}}
          />
        </div>
      }
    >
      <PortfolioDataProvider>
        <MyListShellInner publicFeed={publicFeed} />
      </PortfolioDataProvider>
    </Suspense>
  );
}

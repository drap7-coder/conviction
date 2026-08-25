"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Watchlist from "@/components/Watchlist";
import { PortfolioManager } from "@/components/PortfolioManager";
import { PortfolioDataProvider } from "@/components/PortfolioData";

const MANAGE_VIEWS = [
  {
    id: "watchlist",
    label: "Watchlist",
    tabId: "manage-tab-watchlist",
    panelId: "manage-panel-watchlist",
  },
  {
    id: "portfolio",
    label: "Portfolio",
    tabId: "manage-tab-portfolio",
    panelId: "manage-panel-portfolio",
  },
] as const;

export type ManageView = (typeof MANAGE_VIEWS)[number]["id"];

function parseManageView(value: string | null | undefined): ManageView {
  return value === "portfolio" ? "portfolio" : "watchlist";
}

function ManageWorkspaceInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [activeView, setActiveView] = useState<ManageView>(() =>
    parseManageView(searchParams.get("view")),
  );

  useEffect(() => {
    const fromQuery = searchParams.get("view");
    if (fromQuery === "watchlist" || fromQuery === "portfolio") {
      setActiveView(fromQuery);
      return;
    }
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (hash === "portfolio" || hash === "watchlist") {
      setActiveView(hash);
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", hash);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [pathname, router, searchParams]);

  function selectView(view: ManageView) {
    setActiveView(view);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="data-manage-workspace">
      <div className="data-manage-switch" role="tablist" aria-label="Manage workspace">
        {MANAGE_VIEWS.map((option) => {
          const selected = activeView === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              id={option.tabId}
              aria-selected={selected}
              aria-controls={option.panelId}
              tabIndex={selected ? 0 : -1}
              className={`data-manage-switch-tab${selected ? " is-active" : ""}`}
              onClick={() => selectView(option.id)}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div
        id="manage-panel-watchlist"
        role="tabpanel"
        aria-labelledby="manage-tab-watchlist"
        hidden={activeView !== "watchlist"}
      >
        {activeView === "watchlist" ? <Watchlist mode="manage" /> : null}
      </div>

      <div
        id="manage-panel-portfolio"
        role="tabpanel"
        aria-labelledby="manage-tab-portfolio"
        hidden={activeView !== "portfolio"}
      >
        {activeView === "portfolio" ? (
          <PortfolioDataProvider>
            <PortfolioManager />
          </PortfolioDataProvider>
        ) : null}
      </div>
    </div>
  );
}

export function ManageWorkspace() {
  return (
    <Suspense fallback={<div className="data-manager-empty">Loading manage workspace…</div>}>
      <ManageWorkspaceInner />
    </Suspense>
  );
}

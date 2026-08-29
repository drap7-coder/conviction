"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Watchlist from "@/components/Watchlist";
import { PortfolioManager } from "@/components/PortfolioManager";
import { PortfolioDataProvider } from "@/components/PortfolioData";
import { SurfaceSlicer, type SurfaceSlicerOption } from "@/components/SurfaceSlicer";

export type ManageView = "watchlist" | "portfolio";

const MANAGE_VIEWS: SurfaceSlicerOption[] = [
  { id: "watchlist", label: "Watchlist" },
  { id: "portfolio", label: "Portfolio" },
];

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

  function selectView(view: string) {
    const next = parseManageView(view);
    setActiveView(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="data-manage-workspace">
      <SurfaceSlicer
        label="Manage workspace"
        options={MANAGE_VIEWS}
        activeId={activeView}
        onChange={selectView}
        role="tablist"
        className="data-manage-slicer"
      />

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

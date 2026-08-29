"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GuestModeBanner } from "@/app/components/GuestModeBanner";
import Watchlist from "@/components/Watchlist";
import { PortfolioManager } from "@/components/PortfolioManager";
import { PortfolioDataProvider } from "@/components/PortfolioData";
import { ProductStage } from "@/components/ProductStage";
import { SurfaceSlicer, type SurfaceSlicerOption } from "@/components/SurfaceSlicer";

export type ManageView = "watchlist" | "portfolio";

const MANAGE_VIEWS: SurfaceSlicerOption[] = [
  { id: "watchlist", label: "Watchlist" },
  { id: "portfolio", label: "Portfolio" },
];

const MANAGE_HERO = {
  watchlist: {
    eyebrow: "Watchlist editor",
    headline: "Edit what you follow.",
    summary: "Add or remove names below. Type a ticker, or use the mic in the field.",
    cta: "Add a name",
  },
  portfolio: {
    eyebrow: "Portfolio editor",
    headline: "Edit what you own.",
    summary: "Add shares and optional cost below. Edit or remove any holding in the list.",
    cta: "Add a holding",
  },
} as const;

function parseManageView(value: string | null | undefined): ManageView {
  return value === "portfolio" ? "portfolio" : "watchlist";
}

function focusManageCompose() {
  const compose = document.getElementById("manage-compose");
  if (!compose) return;
  compose.scrollIntoView({ behavior: "smooth", block: "start" });
  const input = compose.querySelector<HTMLInputElement>("input:not([type='hidden'])");
  window.setTimeout(() => input?.focus(), 280);
}

function ManageWorkspaceInner({
  authenticated,
  authConfigured,
  accountLabel,
}: {
  authenticated: boolean;
  authConfigured: boolean;
  accountLabel: string | null;
}) {
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

  const hero = MANAGE_HERO[activeView];

  return (
    <div className="data-manage-workspace">
      <div className="data-manage-deck">
        <header className="data-manage-hero">
          <ProductStage
            variant="manage"
            aria-label="Manage workspace"
            eyebrow={hero.eyebrow}
            headline={hero.headline}
            summary={hero.summary}
            typewriterHeadline={false}
          >
            <div className="product-stage-actions data-manage-hero-actions">
              <button
                type="button"
                className="data-manage-hero-cta"
                onClick={focusManageCompose}
              >
                {hero.cta}
              </button>
            </div>
          </ProductStage>
          <GuestModeBanner
            authenticated={authenticated}
            authConfigured={authConfigured}
            accountLabel={accountLabel}
          />
        </header>

        <SurfaceSlicer
          label="Manage workspace"
          options={MANAGE_VIEWS}
          activeId={activeView}
          onChange={selectView}
          role="tablist"
          className="data-manage-slicer"
        />
      </div>

      <div
        id="manage-panel-watchlist"
        role="tabpanel"
        aria-labelledby="manage-tab-watchlist"
        hidden={activeView !== "watchlist"}
        className="data-manage-panel"
      >
        {activeView === "watchlist" ? <Watchlist mode="manage" /> : null}
      </div>

      <div
        id="manage-panel-portfolio"
        role="tabpanel"
        aria-labelledby="manage-tab-portfolio"
        hidden={activeView !== "portfolio"}
        className="data-manage-panel"
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

export function ManageWorkspace({
  authenticated,
  authConfigured,
  accountLabel,
}: {
  authenticated: boolean;
  authConfigured: boolean;
  accountLabel: string | null;
}) {
  return (
    <Suspense fallback={<div className="data-manager-empty">Loading manage workspace…</div>}>
      <ManageWorkspaceInner
        authenticated={authenticated}
        authConfigured={authConfigured}
        accountLabel={accountLabel}
      />
    </Suspense>
  );
}

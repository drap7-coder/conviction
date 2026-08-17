"use client";

import { useState } from "react";
import { InvestorBookPanel } from "@/app/components/InvestorBookPanel";
import { PoliticiansMovesPanel } from "@/app/components/PoliticiansMovesPanel";
import { useWatchlistTracking } from "@/app/components/use-watchlist-tracking";
import { ProductStage } from "@/components/ProductStage";
import { ViewSwitcher } from "@/components/ViewSwitcher";

const SMART_MONEY_VIEWS = [
  {
    id: "institutions",
    label: "Institutions",
    tabId: "smart-money-tab-institutions",
    panelId: "smart-money-panel-institutions",
  },
  {
    id: "politicians",
    label: "Politicians",
    tabId: "smart-money-tab-politicians",
    panelId: "smart-money-panel-politicians",
  },
] as const;

type SmartMoneyView = (typeof SMART_MONEY_VIEWS)[number]["id"];

export default function SmartMoneyPage() {
  const [activeView, setActiveView] = useState<SmartMoneyView>("institutions");
  const { trackedTickers, addingTicker, addToWatchlist } = useWatchlistTracking();

  return (
    <div className="smart-money-page">
      <ViewSwitcher
        label="Choose a Smart Money view"
        options={[...SMART_MONEY_VIEWS]}
        activeId={activeView}
        onChange={(id) => setActiveView(id as SmartMoneyView)}
      />

      <ProductStage
        variant="smart-money"
        aria-label="Smart Money overview"
        eyebrow="Smart Money · Disclosed ownership"
        headline="Follow disclosed moves from institutions and lawmakers."
        summary="Compare quarterly holdings and reported trades. Use the evidence as a lead—not a live signal."
        metrics={
          <>
            <div>
              <strong>13F</strong>
              <span>Institutions</span>
            </div>
            <div>
              <strong>STOCK Act</strong>
              <span>Lawmakers</span>
            </div>
            <div>
              <strong>Filed</strong>
              <span>Evidence basis</span>
            </div>
          </>
        }
      />

      <div
        id="smart-money-panel-institutions"
        role="tabpanel"
        aria-labelledby="smart-money-tab-institutions"
        hidden={activeView !== "institutions"}
      >
        {activeView === "institutions" ? (
          <InvestorBookPanel
            trackedTickers={trackedTickers}
            addingTicker={addingTicker}
            onAdd={addToWatchlist}
          />
        ) : null}
      </div>

      <div
        id="smart-money-panel-politicians"
        role="tabpanel"
        aria-labelledby="smart-money-tab-politicians"
        hidden={activeView !== "politicians"}
      >
        {activeView === "politicians" ? (
          <PoliticiansMovesPanel
            trackedTickers={trackedTickers}
            addingTicker={addingTicker}
            onAdd={addToWatchlist}
          />
        ) : null}
      </div>
    </div>
  );
}

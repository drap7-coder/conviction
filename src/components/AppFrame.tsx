"use client";

import { usePathname } from "next/navigation";
import MobileTabBar from "@/components/BottomTabBar";
import { AppHeader } from "@/components/AppHeader";
import { MarketTape } from "@/components/MarketTape";
import { GroupOnboardingPrompt } from "@/components/GroupPanels";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/embed/")) return <>{children}</>;

  return (
    <>
      <div className="app-shell">
        <AppHeader />
        <MarketTape />
        {children}
      </div>
      <MobileTabBar />
      <GroupOnboardingPrompt />
    </>
  );
}

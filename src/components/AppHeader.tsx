"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DesktopNav } from "@/components/BottomTabBar";
import AnimatedTitle from "@/components/AnimatedTitle";
import { GlobalSearchPill } from "@/components/GlobalSearchPill";

/**
 * Client header shell. DesktopNav is mounted only at ≥768px so mobile never
 * pays for desktop nav listeners, menu state, or pathname work in the header.
 */
export function AppHeader() {
  const [showDesktopNav, setShowDesktopNav] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setShowDesktopNav(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <header className="app-header">
      <div className="header-brand-row">
        <Link className="app-brand" href="/pulse" aria-label="IQBulls home">
          <img alt="" aria-hidden="true" className="app-logo" src="/conviction-bull.png" />
          <AnimatedTitle />
        </Link>
        {showDesktopNav ? <DesktopNav /> : null}
        <div className="header-search">
          <GlobalSearchPill />
        </div>
      </div>
    </header>
  );
}

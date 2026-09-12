"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DesktopNav } from "@/components/BottomTabBar";
import AnimatedTitle from "@/components/AnimatedTitle";
import { GlobalSearchPill } from "@/components/GlobalSearchPill";
import { RunningBull } from "@/components/RunningBull";
import { ThemePicker, type AccentTheme } from "@/components/ThemePicker";

/**
 * Client header shell. DesktopNav mounts only at ≥768px so mobile never pays
 * for desktop nav listeners or pathname work in the header.
 */
export function AppHeader() {
  const [showDesktopNav, setShowDesktopNav] = useState(false);
  const pathname = usePathname();
  const [bullToken, setBullToken] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setShowDesktopNav(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const onAccentChange = useCallback((_accent: AccentTheme) => {
    setBullToken((token) => token + 1);
  }, []);

  const replayBull = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (pathname !== "/pulse") return;
    setBullToken((token) => token + 1);
  }, [pathname]);

  return (
    <>
      <header className="app-header">
        <div className="header-brand-row">
          <Link
            className="app-brand"
            href="/pulse"
            aria-label="IQBulls home"
            onClick={replayBull}
          >
            <img alt="" aria-hidden="true" className="app-logo" src="/iqbulls-bull.png" />
            <AnimatedTitle />
          </Link>
          {showDesktopNav ? <DesktopNav /> : null}
          <div className="header-search">
            <GlobalSearchPill />
          </div>
          <ThemePicker onAccentChange={onAccentChange} />
        </div>
      </header>
      <RunningBull playToken={bullToken} />
    </>
  );
}

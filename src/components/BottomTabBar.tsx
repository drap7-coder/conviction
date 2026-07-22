"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navTabs } from "@/lib/nav-config";

function useIsActive(href: string) {
  const pathname = usePathname();
  return pathname === href || pathname.startsWith(href + "/");
}

/* ── Mobile bottom tab bar ── */

export function MobileTabBar() {
  return (
    <nav className="bottom-tab-bar">
      {navTabs.map(({ href, label, icon: Icon }) => {
        const active = useIsActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={`bottom-tab-item ${active ? "active" : ""}`}
          >
            <Icon size={20} />
            <span className="bottom-tab-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/* ── Desktop horizontal nav ── */

export function DesktopNav() {
  return (
    <nav className="desktop-nav">
      {navTabs.map(({ href, label, icon: Icon }) => {
        const active = useIsActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={`desktop-nav-item ${active ? "active" : ""}`}
          >
            <Icon size={16} />
            <span className="desktop-nav-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default MobileTabBar;
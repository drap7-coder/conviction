"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navTabs } from "@/lib/nav-config";

/* ── Mobile bottom tab bar ── */

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav className="bottom-tab-bar">
      {navTabs.map(({ href, label, icon: Icon, tone }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`bottom-tab-item tone-${tone}${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="bottom-tab-icon" aria-hidden="true">
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
            </span>
            <span className="bottom-tab-label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/* ── Desktop horizontal nav ── */

export function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav className="desktop-nav">
      {navTabs.map(({ href, label, icon: Icon, tone }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`desktop-nav-item tone-${tone}${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
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
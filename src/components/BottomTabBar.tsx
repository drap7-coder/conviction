"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navTabs } from "@/lib/nav-config";

export default function BottomTabBar() {
  const pathname = usePathname();

  return (
    <>
      {/* ── Mobile: fixed bottom bar (hidden on desktop) ── */}
      <nav className="bottom-tab-bar">
        {navTabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
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

      {/* ── Desktop: horizontal top nav (hidden on mobile) ── */}
      <nav className="desktop-nav">
        {navTabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
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
    </>
  );
}
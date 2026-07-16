"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchJsonWithTimeout } from "./evidence-request";

export function Nav() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadUnread() {
      try {
        const data = await fetchJsonWithTimeout<{ authenticated: boolean; unreadCount: number }>("/api/activity?limit=0", 5_000);
        if (!cancelled && data.authenticated) {
          setUnreadCount(data.unreadCount ?? 0);
        }
      } catch {
        // unread badge is optional
      }
    }
    void loadUnread();
    return () => { cancelled = true; };
  }, [pathname]);

  const links = [
    { href: "/", label: "Watchlist" },
    { href: "/rising", label: "Trending" },
    { href: "/activity", label: "Activity" },
  ];

  return (
    <nav className="app-nav">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={pathname === link.href ? "active" : ""}
        >
          {link.label}
          {link.href === "/activity" && unreadCount > 0 && (
            <span className="nav-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

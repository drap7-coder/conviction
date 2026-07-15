"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export function Nav() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Watchlist" },
    { href: "/rising", label: "Trending" },
    { href: "/journal", label: "Journal" },
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
        </Link>
      ))}
    </nav>
  );
}

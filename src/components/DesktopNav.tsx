"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navTabs } from "@/lib/nav-config";

export default function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav className="app-nav">
      {navTabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={active ? "active" : ""}
          >
            <Icon size={16} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
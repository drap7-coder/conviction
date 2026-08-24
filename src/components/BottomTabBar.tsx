"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import {
  isNavPathActive,
  isOverflowNavPath,
  menuGroups,
  primaryNavTabs,
} from "@/lib/nav-config";

function SiteMenu({
  open,
  onClose,
  menuId,
  placement,
}: {
  open: boolean;
  onClose: () => void;
  menuId: string;
  placement: "sheet" | "header";
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={`site-menu-root site-menu-root--${placement}`}>
      <button
        type="button"
        className="site-menu-backdrop"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div
        id={menuId}
        className="site-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <header className="site-menu-head">
          <h2>Menu</h2>
          <button type="button" className="site-menu-close" onClick={onClose}>
            Close
          </button>
        </header>
        {menuGroups.map((group) => (
          <section key={group.id} className="site-menu-group" aria-label={group.label}>
            <h3>{group.label}</h3>
            <ul>
              {group.pages.map(({ href, label, icon: Icon, blurb, tone }) => {
                const active = isNavPathActive(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={`site-menu-link tone-${tone}${active ? " is-active" : ""}`}
                      aria-current={active ? "page" : undefined}
                      onClick={onClose}
                    >
                      <span className="site-menu-link-icon" aria-hidden="true">
                        <Icon size={18} strokeWidth={active ? 2.4 : 2} />
                      </span>
                      <span>
                        <strong>{label}</strong>
                        <small>{blurb}</small>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const overflowActive = isOverflowNavPath(pathname);
  const menuActive = open || overflowActive;

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <nav className="bottom-tab-bar" aria-label="Primary">
        {primaryNavTabs.map(({ href, label, icon: Icon, tone }) => {
          const active = isNavPathActive(pathname, href);
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
        <button
          type="button"
          className={`bottom-tab-item tone-ink${menuActive ? " active" : ""}`}
          aria-current={overflowActive ? "page" : undefined}
          aria-expanded={open}
          aria-controls={menuId}
          aria-haspopup="dialog"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="bottom-tab-icon" aria-hidden="true">
            <Menu size={20} strokeWidth={menuActive ? 2.4 : 2} />
          </span>
          <span className="bottom-tab-label">Menu</span>
        </button>
      </nav>
      <SiteMenu
        open={open}
        onClose={() => setOpen(false)}
        menuId={menuId}
        placement="sheet"
      />
    </>
  );
}

export function DesktopNav() {
  const pathname = usePathname();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const overflowActive = isOverflowNavPath(pathname);
  const menuActive = open || overflowActive;

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <nav className="desktop-nav" aria-label="Primary">
      {primaryNavTabs.map(({ href, label, icon: Icon, tone }) => {
        const active = isNavPathActive(pathname, href);
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
      <div className="desktop-nav-menu">
        <button
          type="button"
          className={`desktop-nav-item tone-ink${menuActive ? " active" : ""}`}
          aria-current={overflowActive ? "page" : undefined}
          aria-expanded={open}
          aria-controls={menuId}
          aria-haspopup="dialog"
          onClick={() => setOpen((value) => !value)}
        >
          <Menu size={16} />
          <span className="desktop-nav-label">Menu</span>
        </button>
        <SiteMenu
          open={open}
          onClose={() => setOpen(false)}
          menuId={menuId}
          placement="header"
        />
      </div>
    </nav>
  );
}

export default MobileTabBar;

"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import {
  isNavPathActive,
  isOverflowNavPath,
  menuGroups,
  primaryNavTabs,
} from "@/lib/nav-config";

/** Ignore the leftover click that lands on the overlay/button after open. */
const MENU_OPEN_GUARD_MS = 400;

function useMenuOpen(pathname: string) {
  const [open, setOpen] = useState(false);
  const ignoreUntilRef = useRef(0);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function close() {
    setOpen(false);
  }

  function toggle() {
    const now = Date.now();
    if (now < ignoreUntilRef.current) return;
    setOpen((current) => {
      if (!current) ignoreUntilRef.current = now + MENU_OPEN_GUARD_MS;
      return !current;
    });
  }

  function onBackdropClick() {
    if (Date.now() < ignoreUntilRef.current) return;
    setOpen(false);
  }

  return { open, close, toggle, onBackdropClick };
}

function SiteMenu({
  open,
  onClose,
  onBackdropClick,
  menuId,
  placement,
}: {
  open: boolean;
  onClose: () => void;
  onBackdropClick: () => void;
  menuId: string;
  placement: "sheet" | "header";
}) {
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || authenticated !== null) return;
    const controller = new AbortController();
    fetch("/api/groups", {
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { authenticated?: boolean } | null) => {
        if (payload) setAuthenticated(Boolean(payload.authenticated));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [open, authenticated]);

  if (!open) return null;

  const node = (
    <div className={`site-menu-root site-menu-root--${placement}`}>
      <button
        type="button"
        className="site-menu-backdrop"
        aria-label="Close menu"
        onClick={onBackdropClick}
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
              {(group.id === "account" && authenticated === false
                ? [...group.pages].sort((page) => page.href === "/signin" ? -1 : 1)
                : group.pages
              ).map(({ href, label, icon: Icon, blurb, tone }) => {
                const active = isNavPathActive(pathname, href);
                const disabled = authenticated === false && href === "/manage";
                return (
                  <li key={href}>
                    {disabled ? (
                      <div className={`site-menu-link tone-${tone} is-disabled`} aria-disabled="true">
                      <span className="site-menu-link-icon" aria-hidden="true">
                        <Icon size={18} strokeWidth={2} />
                      </span>
                      <span>
                        <strong>{label}</strong>
                        <small>Sign in to edit synced data.</small>
                      </span>
                      </div>
                    ) : (
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
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );

  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}

export function MobileTabBar() {
  const pathname = usePathname();
  const menuId = useId();
  const { open, close, toggle, onBackdropClick } = useMenuOpen(pathname);
  const overflowActive = isOverflowNavPath(pathname);
  const menuActive = open || overflowActive;

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
          onClick={toggle}
        >
          <span className="bottom-tab-icon" aria-hidden="true">
            <Menu size={20} strokeWidth={menuActive ? 2.4 : 2} />
          </span>
          <span className="bottom-tab-label">Menu</span>
        </button>
      </nav>
      <SiteMenu
        open={open}
        onClose={close}
        onBackdropClick={onBackdropClick}
        menuId={menuId}
        placement="sheet"
      />
    </>
  );
}

export function DesktopNav() {
  const pathname = usePathname();
  const menuId = useId();
  const { open, close, toggle, onBackdropClick } = useMenuOpen(pathname);
  const overflowActive = isOverflowNavPath(pathname);
  const menuActive = open || overflowActive;

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
          onClick={toggle}
        >
          <Menu size={16} />
          <span className="desktop-nav-label">Menu</span>
        </button>
        <SiteMenu
          open={open}
          onClose={close}
          onBackdropClick={onBackdropClick}
          menuId={menuId}
          placement="header"
        />
      </div>
    </nav>
  );
}

export default MobileTabBar;

import { Briefcase, BarChart3, CircleHelp, Home, Info, LogIn, Newspaper, SlidersHorizontal, Users, type LucideIcon } from "lucide-react";

export type NavTone = "teal" | "blue" | "amber" | "rose" | "violet";
export type NavGroup = "daily" | "more" | "about" | "account";

export interface NavPage {
  href: string;
  label: string;
  icon: LucideIcon;
  tone: NavTone;
  group: NavGroup;
  blurb: string;
  /**
   * Daily pages appear on the tab bar by default.
   * Set false to keep a daily page in Menu → Daily only.
   */
  tabBar?: boolean;
}

/** Daily destinations stay on the tab bar. Overflow pages live in Menu. */
export const navPages: NavPage[] = [
  {
    href: "/",
    label: "Home",
    icon: Home,
    tone: "amber",
    group: "daily",
    blurb: "Your daily brief, market context, and your stocks.",
  },
  {
    href: "/pulse",
    label: "Pulse",
    icon: BarChart3,
    tone: "teal",
    group: "daily",
    tabBar: false,
    blurb: "Full tape — markets, movers, crypto, and intl.",
  },
  {
    href: "/crowd",
    label: "Crowd",
    icon: Users,
    tone: "teal",
    group: "more",
    blurb: "Campus competition",
  },
  {
    href: "/portfolio",
    label: "Portfolio",
    icon: Briefcase,
    tone: "blue",
    group: "daily",
    blurb: "Live book, Watchlist, and Study.",
  },
  {
    href: "/news",
    label: "News",
    icon: Newspaper,
    tone: "rose",
    group: "daily",
    blurb: "Brief for the few that matter.",
  },
  {
    href: "/about",
    label: "About",
    icon: Info,
    tone: "blue",
    group: "about",
    blurb: "What IQBulls is.",
  },
  {
    href: "/faq",
    label: "Q&A",
    icon: CircleHelp,
    tone: "violet",
    group: "about",
    blurb: "Common questions about Pulse, Portfolio, and data.",
  },
  {
    href: "/manage",
    label: "Manage",
    icon: SlidersHorizontal,
    tone: "teal",
    group: "account",
    blurb: "Edit your watchlist, portfolio, and community in one place.",
  },
  {
    href: "/signin",
    label: "Sign in",
    icon: LogIn,
    tone: "blue",
    group: "account",
    blurb: "Continue with Google. Your first sign-in creates the account.",
  },
];

/** Tab-bar daily destinations (Home · Portfolio · News). Pulse is Menu → Daily. */
export const primaryNavTabs = navPages.filter(
  (page) => page.group === "daily" && page.tabBar !== false,
);
export const menuNavPages = navPages.filter(
  (page) => page.group !== "daily" || page.tabBar === false,
);

/** Daily tab bar items. New pages go in `menuNavPages` unless they are daily. */
export const navTabs = primaryNavTabs;

export function isNavPathActive(pathname: string, href: string): boolean {
  // `/` must not match every route via startsWith.
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isOverflowNavPath(pathname: string): boolean {
  return menuNavPages.some((page) => isNavPathActive(pathname, page.href));
}

export const menuGroups: Array<{ id: NavGroup; label: string; pages: NavPage[] }> = (
  [
    { id: "account", label: "Your data", pages: navPages.filter((page) => page.group === "account") },
    {
      id: "daily",
      label: "Daily",
      pages: navPages.filter((page) => page.group === "daily"),
    },
    { id: "more", label: "More", pages: navPages.filter((page) => page.group === "more") },
    { id: "about", label: "About", pages: navPages.filter((page) => page.group === "about") },
  ] satisfies Array<{ id: NavGroup; label: string; pages: NavPage[] }>
).filter((group) => group.pages.length > 0);

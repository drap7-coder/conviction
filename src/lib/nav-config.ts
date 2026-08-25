import { List, Briefcase, BarChart3, Globe2, Landmark, LogIn, Newspaper, SlidersHorizontal, type LucideIcon } from "lucide-react";

export type NavTone = "teal" | "blue" | "amber" | "rose" | "violet";
export type NavGroup = "daily" | "more" | "account";

export interface NavPage {
  href: string;
  label: string;
  icon: LucideIcon;
  tone: NavTone;
  group: NavGroup;
  blurb: string;
}

/** Daily destinations stay on the tab bar. Overflow pages live in Menu. */
export const navPages: NavPage[] = [
  {
    href: "/pulse",
    label: "Pulse",
    icon: BarChart3,
    tone: "amber",
    group: "daily",
    blurb: "Indexes, trending names, commodities, sectors, and crypto.",
  },
  {
    href: "/watchlist",
    label: "Watchlist",
    icon: List,
    tone: "teal",
    group: "daily",
    blurb: "The names you follow.",
  },
  {
    href: "/portfolio",
    label: "Portfolio",
    icon: Briefcase,
    tone: "blue",
    group: "daily",
    blurb: "The live book and Study templates.",
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
    href: "/smart-money",
    label: "Smart Money",
    icon: Landmark,
    tone: "violet",
    group: "more",
    blurb: "Institution filings and political trades.",
  },
  {
    href: "/international",
    label: "International",
    icon: Globe2,
    tone: "amber",
    group: "more",
    blurb: "Country ETFs — Japan, China, UK, India, Taiwan, Germany.",
  },
  {
    href: "/manage",
    label: "Manage",
    icon: SlidersHorizontal,
    tone: "teal",
    group: "account",
    blurb: "Edit your watchlist and portfolio in one place.",
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

export const primaryNavTabs = navPages.filter((page) => page.group === "daily");
export const menuNavPages = navPages.filter((page) => page.group !== "daily");

/** Daily tab bar items. New pages go in `menuNavPages` unless they are daily. */
export const navTabs = primaryNavTabs;

export function isNavPathActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isOverflowNavPath(pathname: string): boolean {
  return menuNavPages.some((page) => isNavPathActive(pathname, page.href));
}

export const menuGroups: Array<{ id: NavGroup; label: string; pages: NavPage[] }> = [
  { id: "daily", label: "Daily", pages: primaryNavTabs },
  { id: "more", label: "More", pages: navPages.filter((page) => page.group === "more") },
  { id: "account", label: "Your data", pages: navPages.filter((page) => page.group === "account") },
];

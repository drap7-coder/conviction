import { List, Briefcase, BarChart3, CircleHelp, Info, Landmark, LogIn, Newspaper, SlidersHorizontal, Users, type LucideIcon } from "lucide-react";

export type NavTone = "teal" | "blue" | "amber" | "rose" | "violet";
export type NavGroup = "daily" | "more" | "about" | "account";

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
    blurb: "Markets, sectors, and international boards in one place.",
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
    href: "/crowd",
    label: "Crowd",
    icon: Users,
    tone: "teal",
    group: "more",
    blurb: "Names members hold and watch most.",
  },
  {
    href: "/about",
    label: "About",
    icon: Info,
    tone: "blue",
    group: "about",
    blurb: "What CONVICTION is today.",
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
  { id: "account", label: "Your data", pages: navPages.filter((page) => page.group === "account") },
  { id: "daily", label: "Daily", pages: primaryNavTabs },
  { id: "more", label: "More", pages: navPages.filter((page) => page.group === "more") },
  { id: "about", label: "About", pages: navPages.filter((page) => page.group === "about") },
];

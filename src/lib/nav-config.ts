import { List, Briefcase, BarChart3, Landmark, Newspaper, type LucideIcon } from "lucide-react";

export interface NavTab {
  href: string;
  label: string;
  icon: LucideIcon;
  tone: "teal" | "blue" | "amber" | "rose" | "violet";
}

export const navTabs: NavTab[] = [
  { href: "/pulse", label: "Pulse", icon: BarChart3, tone: "amber" },
  { href: "/watchlist", label: "Watchlist", icon: List, tone: "teal" },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase, tone: "blue" },
  { href: "/news", label: "News", icon: Newspaper, tone: "rose" },
  { href: "/smart-money", label: "Smart Money", icon: Landmark, tone: "violet" },
];

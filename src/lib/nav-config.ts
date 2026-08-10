import { List, Briefcase, BarChart3, Landmark, type LucideIcon } from "lucide-react";

export interface NavTab {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navTabs: NavTab[] = [
  { href: "/watchlist", label: "Watchlist", icon: List },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/pulse", label: "Pulse", icon: BarChart3 },
  { href: "/smart-money", label: "Smart Money", icon: Landmark },
];

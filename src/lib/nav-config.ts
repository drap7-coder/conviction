import { List, BarChart3, Landmark, type LucideIcon } from "lucide-react";

export interface NavTab {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navTabs: NavTab[] = [
  { href: "/watchlist", label: "Watchlist", icon: List },
  { href: "/pulse", label: "Pulse", icon: BarChart3 },
  { href: "/smart-money", label: "Smart Money", icon: Landmark },
];

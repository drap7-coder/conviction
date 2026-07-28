import { List, Building2, TrendingUp, BarChart3, Search, type LucideIcon } from "lucide-react";

export interface NavTab {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navTabs: NavTab[] = [
  { href: "/watchlist", label: "Watchlist", icon: List },
  { href: "/markets", label: "Markets", icon: Search },
  { href: "/industries", label: "Industries", icon: Building2 },
  { href: "/trending", label: "Trending", icon: TrendingUp },
  { href: "/pulse", label: "Pulse", icon: BarChart3 },
];

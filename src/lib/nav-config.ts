import { List, Briefcase, Building2, TrendingUp, BarChart3, type LucideIcon } from "lucide-react";

export interface NavTab {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navTabs: NavTab[] = [
  { href: "/watchlist", label: "Watchlist", icon: List },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/industries", label: "Industries", icon: Building2 },
  { href: "/rising", label: "Trending", icon: TrendingUp },
  { href: "/markets", label: "Market Pulse", icon: BarChart3 },
];
import MyListShell from "@/components/MyListShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Watchlist",
  description:
    "Track the stocks you follow — quotes, ownership moves, and a path into each company dashboard.",
  alternates: {
    canonical: "/watchlist",
  },
};

export default function WatchlistPage() {
  return (
    <div className="watchlist-page">
      <MyListShell />
    </div>
  );
}

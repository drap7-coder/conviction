import MyListShell from "@/components/MyListShell";
import { BuildingConvictionNow } from "@/app/components/BuildingConvictionNow";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Watchlist — CONVICTION",
  description:
    "What changed in the companies you follow — ownership moves, news behind the move, and what deserves a closer look.",
  alternates: {
    canonical: "/watchlist",
  },
};

export default function WatchlistPage() {
  return (
    <div className="watchlist-page">
      <MyListShell publicFeed={<BuildingConvictionNow />} />
    </div>
  );
}

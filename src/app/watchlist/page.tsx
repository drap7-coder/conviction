import MyListShell from "@/components/MyListShell";
import { BuildingConvictionNow } from "@/app/components/BuildingConvictionNow";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Watchlist",
  description:
    "Ownership moves and what’s driving the stocks you follow — institutional filings, insider activity, and catalysts in one watchlist.",
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

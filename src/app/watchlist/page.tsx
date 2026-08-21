import { redirect } from "next/navigation";
import MyListShell from "@/components/MyListShell";
import type { Metadata } from "next";
import "@/app/watchlist.css";

export const metadata: Metadata = {
  title: "Watchlist",
  description:
    "Track the stocks you follow — quotes, ownership moves, and a path into each company dashboard.",
  alternates: {
    canonical: "/watchlist",
  },
};

export default async function WatchlistPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const params = await searchParams;
  const view = Array.isArray(params.view) ? params.view[0] : params.view;
  // Old My List switcher deep-link → dedicated Portfolio tab.
  if (view === "portfolio") {
    redirect("/portfolio");
  }

  return (
    <div className="watchlist-page">
      <MyListShell />
    </div>
  );
}

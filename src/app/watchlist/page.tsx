import { redirect } from "next/navigation";
import MyListShell from "@/components/MyListShell";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import "@/app/watchlist.css";

export const metadata: Metadata = pageMetadata({
  title: "Watchlist",
  description: "See today’s moves and what changed for the stocks you follow.",
  path: "/watchlist",
});

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
    <main className="watchlist-page">
      <h1 className="sr-only">Watchlist</h1>
      <MyListShell />
    </main>
  );
}

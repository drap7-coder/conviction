import { redirect } from "next/navigation";
import MyListShell from "@/components/MyListShell";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import "@/app/watchlist.css";

export const metadata: Metadata = pageMetadata({
  title: "Watchlist",
  description:
    "Follow the names you care about — today’s dollar and percent moves in one quote board.",
  path: "/watchlist",
});

/**
 * Watchlist daily view. Performance slicer (All Assets / Leaders / Laggards)
 * lives in the client Watchlist board — same SurfaceSlicer chrome as Portfolio.
 */
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

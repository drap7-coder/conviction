import { permanentRedirect } from "next/navigation";

/** Legacy daily tab — Watchlist now lives on Portfolio. */
export default function WatchlistPage() {
  permanentRedirect("/portfolio?view=watchlist");
}

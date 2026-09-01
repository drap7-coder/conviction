/**
 * Quiet personal ownership markers for Crowd / Smart Money rows.
 * Client-only intersection with the viewer’s book and watchlist.
 */

export type PersonalTrackingBadge = {
  id: "book" | "watch";
  label: string;
};

/** Compact single pill for dense boards (Crowd). */
export function personalOwnershipLabel(
  ticker: string,
  bookTickers: ReadonlySet<string>,
  watchTickers: ReadonlySet<string>,
): string | null {
  const key = ticker.toUpperCase();
  const inBook = bookTickers.has(key);
  const inWatch = watchTickers.has(key);
  if (inBook && inWatch) return "Owned & Watched";
  if (inBook) return "Owned";
  if (inWatch) return "Watched";
  return null;
}

/** Dual chips for Smart Money holdings — book and watchlist are separate signals. */
export function personalTrackingBadges(
  ticker: string,
  bookTickers: ReadonlySet<string>,
  watchTickers: ReadonlySet<string>,
): PersonalTrackingBadge[] {
  const key = ticker.toUpperCase();
  const badges: PersonalTrackingBadge[] = [];
  if (bookTickers.has(key)) {
    badges.push({ id: "book", label: "In your book" });
  }
  if (watchTickers.has(key)) {
    badges.push({ id: "watch", label: "In your watchlist" });
  }
  return badges;
}

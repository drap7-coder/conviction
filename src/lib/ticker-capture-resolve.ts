import { rankCaptureCandidates } from "@/lib/ticker-capture";

export type CaptureSuggestion = {
  ticker: string;
  name: string;
  cik?: string;
};

async function searchSuggestions(query: string): Promise<CaptureSuggestion[]> {
  const response = await fetch(`/api/companies/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) return [];
  const data = (await response.json()) as { suggestions?: CaptureSuggestion[] };
  return data.suggestions ?? [];
}

/**
 * Resolve free text (voice) to a company suggestion.
 * Prefers exact ticker hits, then first search result for the cleaned query.
 */
export async function resolveCaptureText(
  text: string,
): Promise<{ suggestion: CaptureSuggestion | null; query: string; status: string }> {
  const { tokens, query } = rankCaptureCandidates(text);
  const searchQuery = query || tokens[0] || text.trim();
  if (!searchQuery) {
    return { suggestion: null, query: "", status: "Nothing heard — try again." };
  }

  for (const token of tokens) {
    const hits = await searchSuggestions(token);
    const exact = hits.find((hit) => hit.ticker.toUpperCase() === token);
    if (exact) return { suggestion: exact, query: searchQuery, status: "" };
    if (hits[0] && token.length >= 2) {
      return { suggestion: hits[0], query: searchQuery, status: "" };
    }
  }

  const hits = await searchSuggestions(searchQuery);
  if (hits[0]) return { suggestion: hits[0], query: searchQuery, status: "" };
  return {
    suggestion: null,
    query: searchQuery,
    status: `No match for “${searchQuery}” — type the ticker.`,
  };
}

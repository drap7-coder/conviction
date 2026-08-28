/**
 * Pull ticker-like tokens and spoken company phrases from free text
 * (voice transcripts or OCR). Used by mobile capture on Manage.
 */

const FILLER =
  /\b(add|track|buy|ticker|stock|share|shares|company|the|a|an|my|to|watchlist|portfolio|holding|please|um|uh)\b/gi;

/** Uppercase A–Z / digits / . / - tokens that look like tickers. */
export function extractTickerTokens(text: string): string[] {
  const matches = text.toUpperCase().match(/\b[A-Z][A-Z0-9.]{0,4}\b/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of matches) {
    const token = raw.replace(/\.$/, "");
    if (token.length < 1 || token.length > 5) continue;
    // Skip common English leftovers that survive filler stripping.
    if (["A", "I", "AM", "PM", "USD", "ETF", "THE", "AND", "FOR", "TO"].includes(token)) {
      continue;
    }
    if (seen.has(token)) continue;
    seen.add(token);
    out.push(token);
  }
  return out;
}

/** Clean spoken transcript into a search query (company name or ticker). */
export function cleanSpokenQuery(transcript: string): string {
  return transcript
    .replace(FILLER, " ")
    .replace(/[^a-zA-Z0-9.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function rankCaptureCandidates(text: string): {
  tokens: string[];
  query: string;
} {
  const query = cleanSpokenQuery(text);
  const tokens = extractTickerTokens(query || text);
  return { tokens, query };
}

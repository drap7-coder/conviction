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
 * Resolve free text (voice or OCR) to a company suggestion.
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

/** OCR an image file with tesseract (lazy-loaded). */
export async function recognizeImageText(file: Blob): Promise<string> {
  // Prefer Chrome's Shape Detection TextDetector when present (no download).
  if (typeof window !== "undefined" && "TextDetector" in window) {
    try {
      const Detector = (window as unknown as {
        TextDetector: new () => { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> };
      }).TextDetector;
      const detector = new Detector();
      const bitmap = await createImageBitmap(file);
      const results = await detector.detect(bitmap);
      bitmap.close();
      const joined = results.map((row) => row.rawValue).join(" ").trim();
      if (joined) return joined;
    } catch {
      // Fall through to tesseract.
    }
  }

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    // Keep logs quiet in production.
    logger: () => undefined,
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text ?? "";
  } finally {
    await worker.terminate();
  }
}

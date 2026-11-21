import { getLogoDomain } from "@/lib/market/logos";

const CACHE_CONTROL = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000";

function badgeSvg(ticker: string): string {
  const initial = ticker.replace(/[^A-Z0-9]/g, "").slice(0, 1) || "?";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img"><rect width="64" height="64" rx="14" fill="#e8f1ed"/><rect x="1" y="1" width="62" height="62" rx="13" fill="none" stroke="#b8ccc3" stroke-width="2"/><text x="32" y="34" text-anchor="middle" dominant-baseline="middle" fill="#176b58" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" font-size="30" font-weight="700">${initial}</text></svg>`;
}

function fallback(ticker: string): Response {
  return new Response(badgeSvg(ticker), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": CACHE_CONTROL,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ ticker: string }> },
) {
  const { ticker: rawTicker } = await context.params;
  const ticker = rawTicker.toUpperCase();
  const domain = getLogoDomain(ticker);
  if (!domain) return fallback(ticker);

  try {
    const response = await fetch(
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
      {
        cache: "force-cache",
        next: { revalidate: 604800 },
        signal: AbortSignal.timeout(2500),
      },
    );
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.startsWith("image/")) return fallback(ticker);

    const image = await response.arrayBuffer();
    if (image.byteLength < 64 || image.byteLength > 512_000) return fallback(ticker);

    return new Response(image, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": CACHE_CONTROL,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return fallback(ticker);
  }
}

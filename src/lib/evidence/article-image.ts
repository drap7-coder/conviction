// Resolve the article photo for a News headline.
// Prefer in-feed RSS images (handled by news-rss). This module is the
// hero-only fallback: og:image / twitter:image on the article page,
// unwrapping Google News RSS wrappers when needed.

const FETCH_HEADERS = {
  "User-Agent": "Conviction/1.0 (research tool; nathandrapkin@gmail.com)",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.8",
};

const REVALIDATE_SECONDS = 300;
const FETCH_TIMEOUT_MS = 4_000;
const BATCH_EXECUTE_URL = "https://news.google.com/_/DotsSplashUi/data/batchexecute";

export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function isGoogleNewsUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "news.google.com" || host.endsWith(".news.google.com");
  } catch {
    return false;
  }
}

/** Drop tracking pixels and the Google News brand tile — never a stand-in article photo. */
export function isUsableArticleImage(url: string): boolean {
  if (!isHttpUrl(url)) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const href = url.toLowerCase();
    if (host === "news.google.com" || host.endsWith(".news.google.com")) return false;
    if (host.endsWith("googleusercontent.com") && /s0-w300|gn_logo|google-news/.test(href)) {
      return false;
    }
    if (/\b(1x1|pixel\.gif|spacer\.gif|tracking)\b/.test(href)) return false;
    return true;
  } catch {
    return false;
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function metaContent(tag: string, key: string): string | null {
  const hasKey = new RegExp(
    `(?:property|name|itemprop)\\s*=\\s*["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`,
    "i",
  ).test(tag);
  if (!hasKey) return null;
  const quoted = /content\s*=\s*["']([^"']+)["']/i.exec(tag);
  const raw = quoted?.[1] ?? /content\s*=\s*([^\s>]+)/i.exec(tag)?.[1] ?? null;
  return raw ? decodeHtmlEntities(raw.trim()) : null;
}

export function extractOpenGraphImage(html: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const found: Partial<Record<string, string>> = {};
  for (const tag of tags) {
    for (const key of ["og:image:secure_url", "og:image", "twitter:image", "twitter:image:src"]) {
      const value = metaContent(tag, key);
      if (value) found[key] = value;
    }
  }
  const candidates = [
    found["og:image:secure_url"],
    found["og:image"],
    found["twitter:image"],
    found["twitter:image:src"],
  ];
  for (const candidate of candidates) {
    if (candidate && isUsableArticleImage(candidate)) return candidate;
  }
  return null;
}

async function fetchHtml(url: string): Promise<{ url: string; html: string } | null> {
  try {
    const response = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: "follow",
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !/html|xml|text\//i.test(contentType)) return null;
    return { url: response.url, html: await response.text() };
  } catch {
    return null;
  }
}

function googleNewsArticleId(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    const match = /\/(?:rss\/)?articles\/([^/?#]+)/i.exec(path);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function parseBatchexecuteUrl(body: string): string | null {
  let text = body;
  if (text.startsWith(")]}'")) {
    text = text.slice(4).trimStart();
    const newline = text.indexOf("\n");
    if (newline !== -1 && /^\d+$/.test(text.slice(0, newline).trim())) {
      text = text.slice(newline + 1);
    }
  }
  try {
    const envelopes = JSON.parse(text) as unknown;
    if (!Array.isArray(envelopes)) return null;
    for (const env of envelopes) {
      if (!Array.isArray(env) || env[0] !== "wrb.fr" || env[1] !== "Fbv4je") continue;
      const payload = typeof env[2] === "string" ? JSON.parse(env[2]) as unknown : env[2];
      if (Array.isArray(payload) && payload[0] === "garturlres" && typeof payload[1] === "string") {
        return isHttpUrl(payload[1]) ? payload[1] : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** Follow a news.google.com RSS wrapper to the publisher article URL. */
export async function unwrapGoogleNewsUrl(url: string): Promise<string | null> {
  if (!isGoogleNewsUrl(url)) return url;
  const articleId = googleNewsArticleId(url);
  const page = await fetchHtml(url);
  if (!page || !articleId) return null;
  const signature = /data-n-a-sg="([^"]+)"/i.exec(page.html)?.[1];
  const timestamp = /data-n-a-ts="([^"]+)"/i.exec(page.html)?.[1];
  if (!signature || !timestamp) return null;

  const rpcInner = JSON.stringify([
    "garturlreq",
    [
      ["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1],
      "X",
      "X",
      1,
      [1, 1, 1],
      1,
      1,
      null,
      0,
      0,
      null,
      0,
    ],
    articleId,
    Number(timestamp),
    signature,
  ]);
  const form = new URLSearchParams({
    "f.req": JSON.stringify([[["Fbv4je", rpcInner, null, "generic"]]]),
  });

  try {
    const response = await fetch(BATCH_EXECUTE_URL, {
      method: "POST",
      headers: {
        ...FETCH_HEADERS,
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Referer: "https://news.google.com/",
      },
      body: form.toString(),
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const dest = parseBatchexecuteUrl(await response.text());
    if (!dest || isGoogleNewsUrl(dest)) return null;
    return dest;
  } catch {
    return null;
  }
}

/**
 * Fetch og:image / twitter:image for one article URL.
 * Google News wrappers are unwrapped first. Timeouts do not throw.
 */
export async function resolveArticleImageUrl(
  articleUrl: string | null | undefined,
  options: { unwrapGoogle?: boolean } = {},
): Promise<string | null> {
  if (!articleUrl || !isHttpUrl(articleUrl)) return null;
  const unwrapGoogle = options.unwrapGoogle ?? true;
  let target = articleUrl;
  if (isGoogleNewsUrl(articleUrl)) {
    if (!unwrapGoogle) return null;
    const unwrapped = await unwrapGoogleNewsUrl(articleUrl);
    if (!unwrapped) return null;
    target = unwrapped;
  }
  const page = await fetchHtml(target);
  if (!page) return null;
  return extractOpenGraphImage(page.html);
}

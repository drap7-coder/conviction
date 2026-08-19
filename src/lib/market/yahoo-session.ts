import { fetchWithTimeout } from "@/lib/request-timeout";

const YAHOO_UA =
  "Mozilla/5.0 (compatible; Conviction/1.0; +https://github.com/drap7-coder/conviction)";

const FC_URL = "https://fc.yahoo.com";
const CRUMB_URL = "https://query1.finance.yahoo.com/v1/test/getcrumb";

type YahooSession = {
  cookie: string;
  crumb: string;
  expiresAt: number;
};

let cachedSession: YahooSession | null = null;

function parseSetCookieHeader(value: string | null): string[] {
  if (!value) return [];
  return value.split(/,(?=\s*[^;,=\s]+=[^;,]+)/g).map((part) => part.trim().split(";")[0]).filter(Boolean);
}

function mergeCookies(existing: string, setCookies: string[]): string {
  const jar = new Map<string, string>();
  for (const pair of [...existing.split("; ").filter(Boolean), ...setCookies]) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    jar.set(pair.slice(0, idx), pair.slice(idx + 1));
  }
  return Array.from(jar.entries()).map(([key, val]) => `${key}=${val}`).join("; ");
}

async function mintYahooSession(): Promise<YahooSession | null> {
  try {
    const bootstrap = await fetchWithTimeout(
      FC_URL,
      {
        headers: {
          "User-Agent": YAHOO_UA,
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
      },
      8_000,
    );

    let cookie = mergeCookies("", parseSetCookieHeader(bootstrap.headers.get("set-cookie")));
    if (!cookie) {
      // Some environments still get a cookie jar entry even on 404.
      cookie = bootstrap.headers.get("set-cookie")?.split(";")[0] ?? "";
    }

    const crumbRes = await fetchWithTimeout(
      CRUMB_URL,
      {
        headers: {
          "User-Agent": YAHOO_UA,
          Accept: "text/plain",
          ...(cookie ? { Cookie: cookie } : {}),
        },
      },
      8_000,
    );

    if (!crumbRes.ok) return null;
    const crumb = (await crumbRes.text()).trim();
    if (!crumb || /too many requests/i.test(crumb)) return null;

    cookie = mergeCookies(cookie, parseSetCookieHeader(crumbRes.headers.get("set-cookie")));
    if (!cookie) return null;

    return {
      cookie,
      crumb,
      expiresAt: Date.now() + 15 * 60_000,
    };
  } catch {
    return null;
  }
}

/** Yahoo quoteSummary / v7 quote require a paired cookie + crumb. Cached ~15 min. */
export async function getYahooSession(): Promise<YahooSession | null> {
  if (cachedSession && cachedSession.expiresAt > Date.now()) {
    return cachedSession;
  }
  cachedSession = await mintYahooSession();
  return cachedSession;
}

export function yahooRequestHeaders(session: YahooSession | null): HeadersInit {
  return {
    "User-Agent": YAHOO_UA,
    Accept: "application/json",
    ...(session ? { Cookie: session.cookie } : {}),
  };
}

export function withYahooCrumb(url: string, session: YahooSession | null): string {
  if (!session?.crumb) return url;
  const parsed = new URL(url);
  parsed.searchParams.set("crumb", session.crumb);
  return parsed.toString();
}

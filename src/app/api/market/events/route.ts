import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { fetchEarningsWindow, upcomingOfficialEvents } from "@/lib/portfolio/event-calendar";

export const revalidate = 43_200;

const loadEarnings = unstable_cache(
  async (startDate: string) => fetchEarningsWindow(new Date(`${startDate}T12:00:00Z`)),
  ["portfolio-earnings-window-v1"],
  { revalidate: 43_200 },
);

function easternDate(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function GET(request: NextRequest) {
  const tickers = Array.from(new Set((request.nextUrl.searchParams.get("tickers") ?? "")
    .split(",")
    .map((ticker) => ticker.trim().toUpperCase())
    .filter((ticker) => /^[A-Z0-9.^-]{1,12}$/.test(ticker))))
    .slice(0, 30);
  if (tickers.length === 0) return NextResponse.json({ error: "tickers query parameter is required" }, { status: 400 });

  const wanted = new Set(tickers);
  const earnings = await loadEarnings(easternDate());
  const events = [...upcomingOfficialEvents(), ...earnings.events.filter((event) => event.ticker && wanted.has(event.ticker))]
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .slice(0, 8);
  return NextResponse.json({ events, earningsCoverage: { complete: earnings.complete, through: earnings.through }, fetchedAt: new Date().toISOString() }, {
    headers: { "Cache-Control": "public, s-maxage=43200, stale-while-revalidate=86400" },
  });
}

import { NextRequest, NextResponse } from "next/server";
import {
  clearInstitutionalCache,
  getInstitutionalAccumulationForCompany,
  summarizeInstitutionalEvidence,
} from "@/lib/sec/institutional";
import { getWatchlist } from "@/lib/watchlist/persist";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function filingRecencyScore(filingDate: string): number {
  const ageDays = Math.max(
    0,
    (Date.now() - new Date(`${filingDate}T00:00:00Z`).getTime()) / 86_400_000,
  );
  return Math.max(0, 30 - ageDays);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get("refresh") === "1";
  const entries = (await getWatchlist()).filter((entry) => entry.status === "active");
  if (refresh) clearInstitutionalCache();

  const ideas = [];
  for (const entry of entries) {
    const result = await getInstitutionalAccumulationForCompany(
      entry.ticker,
      entry.companyName,
    );
    const summary = summarizeInstitutionalEvidence(result.results);
    if (summary.positiveCount === 0) continue;

    const latestFilingDate = result.results.reduce(
      (latest, item) => (item.filingDate > latest ? item.filingDate : latest),
      "1970-01-01",
    );
    const shareAccumulationScore = Math.min(
      30,
      Math.max(0, summary.aggregateShareChange) / 100_000,
    );
    const score =
      summary.newPositions.length * 100 +
      summary.increased.length * 40 +
      shareAccumulationScore +
      filingRecencyScore(latestFilingDate);

    ideas.push({
      ticker: entry.ticker,
      name: entry.companyName,
      score,
      aggregateShareChange: summary.aggregateShareChange,
      newPositions: summary.newPositions.length,
      increased: summary.increased.length,
      reduced: summary.reduced.length,
      exited: summary.exited.length,
      latestFilingDate,
      topSignals: [...summary.newPositions, ...summary.increased].slice(0, 3),
    });
  }

  ideas.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    ideas,
    total: ideas.length,
    source: "sec-13f",
    fetchedAt: new Date().toISOString(),
  });
}

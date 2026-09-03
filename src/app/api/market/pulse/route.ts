import { NextResponse } from "next/server";
import {
  loadPulseData,
  type DataStatus,
  type PulseData,
  type PulseGlobalMarket,
  type PulseIndicator,
  type PulseSector,
} from "@/lib/market/pulse-data";

/** Re-export types for existing `@/app/api/market/pulse/route` imports. */
export type { DataStatus, PulseData, PulseGlobalMarket, PulseIndicator, PulseSector };

export const revalidate = 300;

export async function GET() {
  const payload = await loadPulseData();

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}

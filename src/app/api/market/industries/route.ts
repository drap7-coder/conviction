import { NextResponse } from "next/server";
import { getIndustriesSnapshot } from "@/lib/market/industries-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getIndustriesSnapshot();
  return NextResponse.json(snapshot);
}

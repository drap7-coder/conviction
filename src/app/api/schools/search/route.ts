import { NextRequest, NextResponse } from "next/server";
import { searchNcaaSchools } from "@/lib/groups/ncaa-catalog";

export const dynamic = "force-dynamic";

/** NCAA directory search — all catalog schools are joinable. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ suggestions: [] });
  }
  const suggestions = searchNcaaSchools(q, 10);
  return NextResponse.json({ suggestions });
}

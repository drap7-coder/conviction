import { NextRequest, NextResponse } from "next/server";
import { ensureCommunitySchema } from "@/lib/db/ensure-community-schema";
import { searchInstitutionDirectory } from "@/lib/groups/institution-directory";

export const dynamic = "force-dynamic";

/** Canonical institution directory search — all NCAA schools, any activation state. */
export async function GET(request: NextRequest) {
  await ensureCommunitySchema().catch(() => undefined);

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions = await searchInstitutionDirectory(q, 10);
  return NextResponse.json({ suggestions });
}

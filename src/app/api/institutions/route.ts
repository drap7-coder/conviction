import { NextResponse } from "next/server";
import {
  ensureSeedGroups,
  ensureSeedInstitutions,
  getInstitutionBySlug,
  listCommunities,
  listInstitutions,
} from "@/lib/groups/store";

export const dynamic = "force-dynamic";

/** Public catalog of canonical communities (not user-created). */
export async function GET(request: Request) {
  await ensureSeedInstitutions().catch(() => undefined);
  await ensureSeedGroups().catch(() => undefined);

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug")?.trim().toLowerCase() ?? "";

  if (slug) {
    const institution = await getInstitutionBySlug(slug);
    if (!institution) {
      return NextResponse.json({ error: "Community not found." }, { status: 404 });
    }
    const communities = await listCommunities();
    const community = communities.find((c) => c.institution.id === institution.id);
    return NextResponse.json({ institution, community });
  }

  const [institutions, communities] = await Promise.all([
    listInstitutions(),
    listCommunities(),
  ]);
  return NextResponse.json({ institutions, communities });
}

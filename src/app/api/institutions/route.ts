import { NextResponse } from "next/server";
import {
  ensureSeedGroups,
  ensureSeedInstitutions,
  getInstitutionBySlug,
  listGroupsForInstitution,
  listInstitutions,
} from "@/lib/groups/store";

export const dynamic = "force-dynamic";

/** Public catalog of canonical institutions (not user-created). */
export async function GET(request: Request) {
  await ensureSeedInstitutions().catch(() => undefined);
  await ensureSeedGroups().catch(() => undefined);

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug")?.trim().toLowerCase() ?? "";

  if (slug) {
    const institution = await getInstitutionBySlug(slug);
    if (!institution) {
      return NextResponse.json({ error: "Institution not found." }, { status: 404 });
    }
    const groups = await listGroupsForInstitution(institution.id);
    return NextResponse.json({ institution, groups });
  }

  const institutions = await listInstitutions();
  return NextResponse.json({ institutions });
}

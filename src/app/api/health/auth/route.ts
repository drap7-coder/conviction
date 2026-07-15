import { NextResponse } from "next/server";
import { checkDatabaseReadiness, isAuthConfigured, yesNo } from "@/lib/auth-readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const database = await checkDatabaseReadiness();

  return NextResponse.json({
    authConfigured: yesNo(isAuthConfigured()),
    databaseConfigured: yesNo(database.databaseConfigured),
    databaseReachable: yesNo(database.databaseReachable),
    requiredTablesPresent: yesNo(database.requiredTablesPresent),
    guestModeAvailable: "yes",
  });
}

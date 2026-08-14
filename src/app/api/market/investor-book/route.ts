import { NextRequest, NextResponse } from "next/server";
import {
  clearInstitutionalCache,
  findInstitutionalManager,
  getInstitutionalManagerBook,
  listInstitutionalManagers,
} from "@/lib/sec/institutional";
import { isRequestTimeout, withTimeout } from "@/lib/request-timeout";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CACHE_CONTROL =
  "public, max-age=300, s-maxage=21600, stale-while-revalidate=604800";

export async function GET(request: NextRequest) {
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const managerQuery =
    request.nextUrl.searchParams.get("manager")
    ?? request.nextUrl.searchParams.get("cik")
    ?? "";

  if (refresh) clearInstitutionalCache();

  if (!managerQuery.trim()) {
    return NextResponse.json(
      {
        managers: listInstitutionalManagers().map((manager) => ({
          cik: manager.cik,
          manager: manager.manager,
          displayName: manager.displayName,
          slug: manager.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        })),
        status: "success",
        source: "sec-13f",
      },
      { headers: { "Cache-Control": CACHE_CONTROL } },
    );
  }

  const resolved = findInstitutionalManager(managerQuery);
  if (!resolved) {
    return NextResponse.json(
      {
        book: null,
        status: "error",
        message: "Unknown investor. Choose a tracked manager.",
        managers: listInstitutionalManagers().map((manager) => ({
          cik: manager.cik,
          displayName: manager.displayName,
        })),
      },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const book = await withTimeout(
      getInstitutionalManagerBook(resolved.cik, { forceRefresh: refresh }),
      48_000,
    );

    if (!book) {
      return NextResponse.json(
        {
          book: null,
          status: "empty",
          message: "No recent 13F filing was available for this investor.",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { book, status: "success" },
      {
        headers: {
          "Cache-Control": refresh ? "no-store" : CACHE_CONTROL,
        },
      },
    );
  } catch (error) {
    const timedOut = isRequestTimeout(error);
    return NextResponse.json(
      {
        book: null,
        status: timedOut ? "timeout" : "error",
        message: timedOut
          ? "This investor’s filing is taking longer than usual."
          : "Investor book could not be loaded.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}

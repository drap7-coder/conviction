import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatBuildId, isDebugQuery, resolvePublicBuildId } from "@/lib/build-id";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("build id", () => {
  it("prefers NEXT_PUBLIC_BUILD_ID, then Vercel SHA, then dev", () => {
    expect(
      resolvePublicBuildId({
        NEXT_PUBLIC_BUILD_ID: "abc1234deadbeef",
        VERCEL_GIT_COMMIT_SHA: "ffffffffffff",
      }),
    ).toBe("abc1234deadbeef");
    expect(
      resolvePublicBuildId({
        VERCEL_GIT_COMMIT_SHA: "bafee8f0123456789",
      }),
    ).toBe("bafee8f0123456789");
    expect(resolvePublicBuildId({})).toBe("dev");
  });

  it("shortens a SHA for the footer and leaves dev alone", () => {
    expect(formatBuildId("bafee8f0123456789")).toBe("bafee8f");
    expect(formatBuildId("dev")).toBe("dev");
    expect(formatBuildId("")).toBe("dev");
  });

  it("only shows the marker for ?debug=1", () => {
    expect(isDebugQuery("1")).toBe(true);
    expect(isDebugQuery("true")).toBe(false);
    expect(isDebugQuery("0")).toBe(false);
    expect(isDebugQuery(null)).toBe(false);
  });

  it("bakes Vercel SHA into NEXT_PUBLIC_BUILD_ID at build time", () => {
    const config = read("next.config.ts");
    expect(config).toContain("VERCEL_GIT_COMMIT_SHA");
    expect(config).toContain("NEXT_PUBLIC_BUILD_ID");

    const layout = read("src/app/layout.tsx");
    expect(layout).toContain("BuildDebugMarker");
    expect(layout).toContain("Suspense");

    const marker = read("src/components/BuildDebugMarker.tsx");
    expect(marker).toContain('searchParams.get("debug")');
    expect(marker).toContain("buildId");
    expect(read("src/app/layout.tsx")).toContain("resolvePublicBuildId()");
  });
});

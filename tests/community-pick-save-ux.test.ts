import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("community pick save UX", () => {
  it("shows explicit Save Pick and Confirm Swap actions with validation", () => {
    const source = read("src/components/CommunityPickCard.tsx");
    expect(source).toContain('"Save Pick"');
    expect(source).toContain('"Confirm Swap"');
    expect(source).toContain("disabled={busy || !canSubmit}");
    expect(source).toContain("community-pick-success");
    expect(source).toContain("loadCommunityPicksPayload");
  });

  it("styles the pick editor action as a full-width primary button", () => {
    const css = read("src/app/globals.css");
    expect(css).toContain(".community-pick-editor");
    expect(css).toContain(".community-pick-action");
    expect(css).toContain("width: 100%");
  });
});

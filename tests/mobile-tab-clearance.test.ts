import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("mobile bottom tab clearance", () => {
  it("keeps scroll-end padding and pointer-events pass-through on the tab bar", () => {
    const css = read("src/app/globals.css");

    expect(css).toContain("--mobile-bottom-clearance:");
    expect(css).toContain("env(safe-area-inset-bottom, 64px)");
    expect(css).toMatch(
      /\.app-shell\s*\{[\s\S]*?padding-bottom:\s*calc\(var\(--mobile-page-gutter\) \+ var\(--mobile-bottom-clearance\)\)/,
    );
    expect(css).toMatch(
      /@media \(max-width: 767px\)\s*\{[\s\S]*?\.app-shell\s*\{[\s\S]*?var\(--mobile-bottom-clearance\)/,
    );
    expect(css).toMatch(/\.bottom-tab-bar\s*\{[\s\S]*?pointer-events:\s*none/);
    expect(css).toMatch(/\.bottom-tab-item\s*\{[\s\S]*?pointer-events:\s*auto/);
  });
});

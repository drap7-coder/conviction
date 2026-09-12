import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("daily workspace orientation", () => {
  it("uses one shared at-a-glance pattern across daily surfaces", () => {
    for (const file of [
      "src/components/market/PulseDashboard.tsx",
      "src/components/CrowdBoard.tsx",
      "src/components/Portfolio.tsx",
      "src/components/market/PulseNewsFeed.tsx",
    ]) {
      expect(read(file)).toContain("WorkspaceViewContext");
    }
  });

  it("gives the context pattern responsive and theme-token styling", () => {
    const css = read("src/app/globals.css");
    expect(css).toContain(".workspace-view-context");
    expect(css).toContain("--pulse-context-accent");
    expect(css).toContain(".workspace-view-context.tone-news");
  });
});

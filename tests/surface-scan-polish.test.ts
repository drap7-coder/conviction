import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("surface scan polish", () => {
  it("keeps section header marks neutral, not day direction", () => {
    const board = read("src/components/market/IndexScoreboard.tsx");
    const css = read("src/app/globals.css");

    expect(board).toContain("pulse-day-status--mark");
    expect(board).not.toContain("groupDayTone");
    expect(board).not.toContain("pulse-day-status--down");
    expect(css).toContain(".pulse-day-status--mark");
    expect(css).toContain("var(--accent)");
  });

  it("scales Portfolio hero glow by day-move magnitude", () => {
    const portfolio = read("src/components/Portfolio.tsx");
    const stage = read("src/components/ProductStage.tsx");
    const css = read("src/app/globals.css");

    expect(portfolio).toContain("dayMoveIntensity");
    expect(portfolio).toContain("intensity={stageIntensity}");
    expect(stage).toContain("ProductStageIntensity");
    expect(stage).toContain("intensity-${intensity}");
    expect(css).toContain("intensity-mild");
    expect(css).toContain("intensity-medium");
    expect(css).toContain("--pf-glow-a");
  });

  it("anchors Index and Crowd rows with dividers plus zebra", () => {
    const css = read("src/app/globals.css");

    expect(css).toContain(".pulse-index-rows > li:nth-child(even) .pulse-index-row");
    expect(css).toContain(".crowd-list > li:nth-child(even) .crowd-row");
    expect(css).toContain("color-mix(in srgb, #ffffff 5%, transparent)");
    expect(css).toContain("color-mix(in srgb, #ffffff 12%, transparent)");
  });

  it("uses tabular mono figures on Pulse, Crowd, and Portfolio numerics", () => {
    const css = read("src/app/globals.css");
    const portfolioCss = read("src/app/portfolio.css");

    expect(css).toMatch(/\.session-quote\s*\{[^}]*font-family:\s*var\(--font-mono\)/s);
    expect(css).toMatch(/\.session-quote\s*\{[^}]*font-variant-numeric:\s*tabular-nums/s);
    expect(css).toMatch(/\.crowd-rank\s*\{[^}]*font-variant-numeric:\s*tabular-nums/s);
    expect(css).toMatch(/\.product-stage--portfolio\.product-stage--metrics-above \.product-stage-metrics > \.is-lead strong\s*\{[^}]*font-variant-numeric:\s*tabular-nums/s);
    expect(css).toMatch(/\.pulse-gauge-readout strong\s*\{[^}]*font-variant-numeric:\s*tabular-nums/s);
    expect(portfolioCss).toMatch(/\.portfolio-page \.pf-day-strip-figures strong\s*\{[^}]*font-family:\s*var\(--font-mono\)/s);
    expect(portfolioCss).toMatch(/\.portfolio-page \.pf-day-strip-figures strong\s*\{[^}]*font-variant-numeric:\s*tabular-nums/s);
  });

  it("polishes tape separators, teal slicer, and centered gauge labels", () => {
    const css = read("src/app/globals.css");

    expect(css).toMatch(/\.market-tape\s*\{[^}]*border-top:\s*1px solid/s);
    expect(css).toMatch(/\.market-tape-item \+ \.market-tape-item\s*\{[^}]*border-left:\s*0/s);
    expect(css).toContain(".market-tape-item + .market-tape-item::before");
    expect(css).toContain('content: "·"');
    expect(css).toMatch(/\.market-tape-symbol\s*\{[^}]*font-weight:\s*800/s);
    expect(css).toMatch(/\.surface-slicer-pill\.is-active\s*\{[^}]*var\(--accent\)/s);
    expect(css).toMatch(/\.surface-slicer\s*\{[^}]*border-radius:\s*14px/s);
    expect(css).toMatch(/\.pulse-gauge-kicker\s*\{[^}]*text-align:\s*center/s);
    expect(css).toMatch(/\.pulse-gauge-card\s*\{[^}]*justify-items:\s*center/s);
  });

  it("boots nav as IQBulls. then settles to IQBulls without a case flip", () => {
    const title = read("src/components/AnimatedTitle.tsx");
    const css = read("src/app/globals.css");
    const layout = read("src/app/layout.tsx");

    expect(title).toContain('const BOOT_BODY = "IQBulls"');
    expect(title).toContain('const BOOT_FINAL = "IQBulls."');
    expect(title).toContain('const SETTLED_TEXT = "IQBulls"');
    expect(title).toContain("prefersReducedMotion");
    expect(title).toContain("iqbulls-boot-sound");
    expect(title).toContain("typewriter-period");
    expect(title).toContain("boot-sound-toggle");
    expect(title).toContain('SOUND_PREF_KEY) === "on"');
    expect(title).not.toContain("accent-dot");
    expect(title).not.toContain('SETTLED_TEXT = "CONVICTION"');
    expect(title).not.toContain('BOOT_BODY = "conviction"');
    expect(title).not.toContain('BOOT_BODY = "iqbulls"');
    expect(css).toMatch(/\.app-title\s*\{[^}]*text-transform:\s*none/s);
    expect(css).not.toMatch(/\.app-title\s*\{[^}]*text-transform:\s*uppercase/s);
    expect(css).toContain(".typewriter-period");
    expect(css).toContain(".boot-sound-toggle");
    expect(layout).toContain('src="/conviction-bull.png"');
    expect(layout).toContain("<AnimatedTitle");
    expect(layout).toContain('icon: "/icon.png"');
    expect(layout).toContain('aria-label="IQBulls home"');
  });
});

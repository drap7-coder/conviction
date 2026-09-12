import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("site theme option", () => {
  it("mounts an accessible theme control in the shared header", () => {
    const header = read("src/components/AppHeader.tsx");
    const picker = read("src/components/ThemePicker.tsx");
    expect(header).toContain("<ThemeToggle");
    expect(picker).toContain("aria-label");
    expect(picker).toContain("iqbulls-theme");
    expect(picker).toContain("iqbulls-accent");
    expect(header).not.toContain("AccentPicker");
  });

  it("applies the saved theme before hydration and defines a cream palette", () => {
    expect(read("src/app/layout.tsx")).toContain('strategy="beforeInteractive"');
    const css = read("src/app/globals.css");
    expect(css).toContain('html[data-theme="cream"]');
    expect(css).toContain("--bg: #f4eddf");
    expect(css).toContain(".theme-toggle");
  });

  it("persists surface and accent without a FOUC boot script", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain("iqbulls-theme");
    expect(layout).toContain("iqbulls-accent");
    expect(read("src/components/ThemePicker.tsx")).toContain("Bull Green");
    expect(read("src/components/ThemePicker.tsx")).toContain("AccentPicker");
    expect(read("src/app/globals.css")).toContain('html[data-accent="pink"]');
    expect(read("src/app/globals.css")).toContain("--green:");
  });

  it("runs the bull animation only from Manage accent personalization", () => {
    expect(read("src/components/RunningBull.tsx")).toContain("prefers-reduced-motion");
    expect(read("src/app/globals.css")).toContain("running-bull-layer");
    expect(read("src/components/ThemePicker.tsx")).toContain("RunningBull");
    expect(read("src/components/AppHeader.tsx")).not.toContain("RunningBull");
  });
});

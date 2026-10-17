import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("dark-only site appearance", () => {
  it("sets dark mode before hydration and ignores saved light mode", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain('data-theme="dark"');
    expect(layout).toContain("localStorage.removeItem('iqbulls-theme')");
    expect(layout).not.toContain("dataset.theme='cream'");
    expect(read("src/components/AppHeader.tsx")).not.toContain("ThemeToggle");
    expect(read("src/components/ThemePicker.tsx")).not.toContain("applySurfaceTheme");
  });
  it("shares green surfaces without recoloring financial data", () => {
    const css = read("src/app/dark-surface.css");
    expect(read("src/app/layout.tsx")).toContain('import "./dark-surface.css"');
    expect(css).toContain("--bg: #091310");
    expect(css).toContain("--chart-surface:");
    expect(css).not.toMatch(/--(?:green|red):/);
    expect(css).not.toContain("filter:");
  });
  it("retains accent personalization", () => {
    expect(read("src/components/ThemePicker.tsx")).toContain("AccentPicker");
    expect(read("src/app/layout.tsx")).toContain("iqbulls-accent");
  });
  it("keeps muted and quiet text above 4.5:1 on green panels", () => {
    const css = read("src/app/dark-surface.css");
    const color = (token: string) => css.match(new RegExp(`${token}: (#[0-9a-f]{6})`))![1];
    const luminance = (hex: string) => {
      const rgb = hex.slice(1).match(/../g)!.map((part) => {
        const value = parseInt(part, 16) / 255;
        return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
      });
      return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
    };
    for (const text of ["--muted", "--quiet"]) {
      for (const panel of ["--card", "--card-soft", "--surface-elevated"]) {
        expect((luminance(color(text)) + .05) / (luminance(color(panel)) + .05)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

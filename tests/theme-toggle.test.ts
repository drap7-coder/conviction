import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("site theme option", () => {
  it("mounts an accessible theme control in the shared header", () => {
    const header = read("src/components/AppHeader.tsx");
    const toggle = read("src/components/ThemeToggle.tsx");
    expect(header).toContain("<ThemeToggle />");
    expect(toggle).toContain("aria-label");
    expect(toggle).toContain("iqbulls-theme");
  });

  it("applies the saved theme before hydration and defines a cream palette", () => {
    expect(read("src/app/layout.tsx")).toContain('strategy="beforeInteractive"');
    const css = read("src/app/globals.css");
    expect(css).toContain('html[data-theme="cream"]');
    expect(css).toContain("--bg: #f4eddf");
    expect(css).toContain(".theme-toggle");
  });
});

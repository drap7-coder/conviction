import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function extractBlock(src: string, startPat: RegExp): Record<string, string> {
  const match = startPat.exec(src);
  if (!match) return {};
  let i = match.index + match[0].length - 1;
  let depth = 0;
  for (let j = i; j < src.length; j += 1) {
    if (src[j] === "{") depth += 1;
    else if (src[j] === "}") {
      depth -= 1;
      if (depth === 0) {
        const body = src.slice(i + 1, j);
        return Object.fromEntries(
          Array.from(body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)).map((row) => [
            row[1],
            row[2].trim(),
          ]),
        );
      }
    }
  }
  return {};
}

function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const channels = [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrastRatio(fg: string, bg: string): number {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("readability contrast for quiet labels", () => {
  const globals = read("src/app/globals.css");
  const workspace = read("src/app/workspace-design.css");
  const dark = extractBlock(globals, /:root\s*\{/);
  const cream = extractBlock(globals, /html\[data-theme=["']cream["']\]\s*\{/);

  it("keeps --quiet ≥ 4.5:1 on --card in both themes", () => {
    expect(contrastRatio(dark["--quiet"]!, dark["--card"]!)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(cream["--quiet"]!, cream["--card"]!)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps --muted ≥ 4.5:1 on --card in both themes", () => {
    expect(contrastRatio(dark["--muted"]!, dark["--card"]!)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(cream["--muted"]!, cream["--card"]!)).toBeGreaterThanOrEqual(4.5);
  });

  it("does not fade session/previous-close labels with opacity", () => {
    expect(globals).toContain(".session-quote-reference");
    expect(globals).toMatch(/\.session-quote-reference \{[\s\S]*?color: var\(--quiet\);/);
    // The shared extended/reference rule must not reintroduce opacity fade.
    const block = globals.match(
      /\.session-quote-extended,\s*\.session-quote-reference \{([\s\S]*?)\}/,
    )?.[1];
    expect(block).toBeTruthy();
    expect(block).not.toMatch(/opacity\s*:/);
    expect(block).toMatch(/font-size:\s*0\.68rem/);
  });

  it("keeps shared scoreboard row density across Markets/Movers/Crypto/Intl", () => {
    expect(workspace).toContain("Shared scoreboard density");
    expect(workspace).toMatch(
      /\.pulse-index-row,\s*\.pulse-index-board--sessions \.pulse-index-row \{[\s\S]*?padding:\s*12px;/,
    );
    expect(workspace).toContain("min-height: 44px");
  });
});

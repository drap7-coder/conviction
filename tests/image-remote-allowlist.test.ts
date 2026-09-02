import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  hostMatchesImagePattern,
  isNextImageRemoteAllowed,
  NEXT_IMAGE_REMOTE_HOST_PATTERNS,
  nextImageRemotePatterns,
} from "@/lib/media/next-image-hosts";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("Next image remote allowlist", () => {
  it("drops the unrestricted HTTPS wildcard from next.config", () => {
    const config = read("next.config.ts");
    expect(config).toContain("nextImageRemotePatterns");
    expect(config).not.toMatch(/hostname:\s*"\*\*"/);
    expect(read("src/lib/media/next-image-hosts.ts")).not.toContain('"**"');
  });

  it("keeps a bounded publisher CDN allowlist", () => {
    expect(NEXT_IMAGE_REMOTE_HOST_PATTERNS).toContain("**.yimg.com");
    expect(NEXT_IMAGE_REMOTE_HOST_PATTERNS).toContain("**.reuters.com");
    expect(NEXT_IMAGE_REMOTE_HOST_PATTERNS).not.toContain("**");
    expect(nextImageRemotePatterns().every((row) => row.protocol === "https")).toBe(true);
  });

  it("matches nested CDN hosts and rejects arbitrary domains", () => {
    expect(hostMatchesImagePattern("s.yimg.com", "**.yimg.com")).toBe(true);
    expect(hostMatchesImagePattern("media.yimg.com", "**.yimg.com")).toBe(true);
    expect(hostMatchesImagePattern("evil.example", "**.yimg.com")).toBe(false);
    expect(isNextImageRemoteAllowed("https://s.yimg.com/photo.jpg")).toBe(true);
    expect(isNextImageRemoteAllowed("https://evil.example/photo.jpg")).toBe(false);
    expect(isNextImageRemoteAllowed("http://s.yimg.com/photo.jpg")).toBe(false);
  });

  it("falls back to native img for News heroes outside the allowlist", () => {
    const feed = read("src/components/market/PulseNewsFeed.tsx");
    expect(feed).toContain("isNextImageRemoteAllowed");
    expect(feed).toContain("optimizeImage");
    expect(feed).toContain("next/image");
    expect(feed).toContain("<img");
    expect(feed).toContain("skip /_next/image");
  });
});

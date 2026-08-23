import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractOpenGraphImage,
  isUsableArticleImage,
  resolveArticleImageUrl,
  unwrapGoogleNewsUrl,
} from "@/lib/evidence/article-image";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("extractOpenGraphImage", () => {
  it("prefers og:image over twitter:image", () => {
    const html = `
      <meta name="twitter:image" content="https://cdn.example.com/tw.jpg" />
      <meta property="og:image" content="https://cdn.example.com/og.jpg" />
    `;
    expect(extractOpenGraphImage(html)).toBe("https://cdn.example.com/og.jpg");
  });

  it("falls back to twitter:image and decodes entities", () => {
    const html = `<meta name="twitter:image" content="https://s.yimg.com/os/photo.jpg?w=800&amp;h=450" />`;
    expect(extractOpenGraphImage(html)).toBe("https://s.yimg.com/os/photo.jpg?w=800&h=450");
  });

  it("rejects the Google News brand tile", () => {
    const splash = "https://lh3.googleusercontent.com/abc=s0-w300-rw";
    expect(isUsableArticleImage(splash)).toBe(false);
    expect(extractOpenGraphImage(`<meta property="og:image" content="${splash}" />`)).toBeNull();
  });
});

describe("resolveArticleImageUrl", () => {
  it("reads og:image from a publisher page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      `<meta property="og:image" content="https://s.yimg.com/os/hero.jpg" />`,
      { status: 200, headers: { "content-type": "text/html" } },
    )));

    await expect(resolveArticleImageUrl("https://finance.yahoo.com/news/example.html"))
      .resolves.toBe("https://s.yimg.com/os/hero.jpg");
  });

  it("unwraps a Google News wrapper then reads the article og:image", async () => {
    const googleUrl = "https://news.google.com/rss/articles/CBMiEXAMPLE?oc=5";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("news.google.com/rss/articles")) {
        return new Response(
          `<div data-n-a-sg="Ae5Wzi_sig" data-n-a-ts="1787493382"></div>`,
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      if (url.includes("batchexecute")) {
        expect(init?.method).toBe("POST");
        return new Response(
          `)]}'\n\n[["wrb.fr","Fbv4je","[\\"garturlres\\",\\"https://finance.yahoo.com/news/unwrapped.html\\",1]",null,null,null,"generic"]]`,
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("finance.yahoo.com/news/unwrapped.html")) {
        return new Response(
          `<meta property="og:image" content="https://s.yimg.com/os/unwrapped.jpg" />`,
          { status: 200, headers: { "content-type": "text/html" } },
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(resolveArticleImageUrl(googleUrl)).resolves.toBe("https://s.yimg.com/os/unwrapped.jpg");
    await expect(unwrapGoogleNewsUrl(googleUrl)).resolves.toBe("https://finance.yahoo.com/news/unwrapped.html");
  });

  it("does not unwrap Google News when unwrapGoogle is false", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(resolveArticleImageUrl(
      "https://news.google.com/rss/articles/CBMiEXAMPLE?oc=5",
      { unwrapGoogle: false },
    )).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

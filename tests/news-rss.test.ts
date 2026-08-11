import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRssNews } from "@/lib/evidence/news-rss";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RSS news metadata", () => {
  it("preserves the publish time and separates the publisher from the headline", async () => {
    const xml = `
      <rss><channel><item>
        <title><![CDATA[Nvidia expands its AI infrastructure push - Reuters]]></title>
        <link>https://example.com/nvidia</link>
        <description><![CDATA[The company announced a new infrastructure partnership.]]></description>
        <pubDate>Mon, 10 Aug 2026 20:40:37 +0000</pubDate>
        <source url="https://reuters.com">Reuters</source>
      </item></channel></rss>
    `;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(xml, { status: 200 })));

    const events = await fetchRssNews("NVDA", 1);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      title: "Nvidia expands its AI infrastructure push",
      date: "2026-08-10T20:40:37.000Z",
      metadata: { publisher: "Reuters" },
    });
  });
});

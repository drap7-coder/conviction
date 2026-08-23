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

  it("extracts the largest media:content image and prefers it over description img", async () => {
    const xml = `
      <rss><channel><item>
        <title><![CDATA[Nvidia books another AI order]]></title>
        <link>https://example.com/nvidia-ai</link>
        <description><![CDATA[<img src="https://example.com/small.jpg" /> The company booked another cluster.]]></description>
        <pubDate>Sun, 23 Aug 2026 12:00:00 +0000</pubDate>
        <source url="https://reuters.com">Reuters</source>
        <media:content url="https://s.yimg.com/tiny.jpg" type="image/jpeg" width="86" height="86" />
        <media:content url="https://s.yimg.com/hero.jpg" type="image/jpeg" width="600" height="338" />
        <enclosure url="https://example.com/audio.mp3" type="audio/mpeg" />
      </item></channel></rss>
    `;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(xml, { status: 200 })));

    const events = await fetchRssNews("NVDA", 1);

    expect(events[0]?.metadata?.imageUrl).toBe("https://s.yimg.com/hero.jpg");
  });

  it("falls back to enclosure, thumbnail, then the first description image", async () => {
    const enclosureXml = `
      <rss><channel><item>
        <title>Oil jumps</title>
        <link>https://example.com/oil</link>
        <enclosure url="https://media.example.com/oil.png" type="image/png" />
      </item></channel></rss>
    `;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(enclosureXml, { status: 200 })));
    expect((await fetchRssNews("USO", 1))[0]?.metadata?.imageUrl).toBe("https://media.example.com/oil.png");

    const thumbXml = `
      <rss><channel><item>
        <title>Bitcoin rally</title>
        <link>https://example.com/btc</link>
        <media:thumbnail url="https://media.example.com/btc-thumb.webp" />
      </item></channel></rss>
    `;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(thumbXml, { status: 200 })));
    expect((await fetchRssNews("BTC-USD", 1))[0]?.metadata?.imageUrl).toBe("https://media.example.com/btc-thumb.webp");

    const plainThumbXml = `
      <rss><channel><item>
        <title>Silver climbs</title>
        <link>https://example.com/silver</link>
        <thumbnail url="https://media.example.com/silver.jpg" />
      </item></channel></rss>
    `;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(plainThumbXml, { status: 200 })));
    expect((await fetchRssNews("SLV", 1))[0]?.metadata?.imageUrl).toBe("https://media.example.com/silver.jpg");

    const descXml = `
      <rss><channel><item>
        <title>Tariffs widen</title>
        <link>https://example.com/trade</link>
        <description><![CDATA[Story <img src="https://media.example.com/trade.jpg?w=800&amp;h=450" alt="Trade"> body]]></description>
      </item></channel></rss>
    `;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(descXml, { status: 200 })));
    expect((await fetchRssNews("MCHI", 1))[0]?.metadata?.imageUrl).toBe("https://media.example.com/trade.jpg?w=800&h=450");
  });

  it("omits imageUrl when the feed has no usable photo", async () => {
    const xml = `
      <rss><channel><item>
        <title>Rates hold</title>
        <link>https://example.com/fed</link>
        <enclosure url="https://example.com/briefing.mp3" type="audio/mpeg" />
      </item></channel></rss>
    `;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(xml, { status: 200 })));

    const events = await fetchRssNews("TLT", 1);
    expect(events[0]?.metadata?.imageUrl).toBeNull();
  });

  it("does not mistake a headline clause for a publisher when RSS omits the source", async () => {
    const xml = `
      <rss><channel><item>
        <title><![CDATA[Markets Slide - TSLA, INTC, and NFLX In Focus]]></title>
        <link>https://example.com/markets</link>
        <pubDate>Mon, 10 Aug 2026 23:02:45 +0000</pubDate>
      </item></channel></rss>
    `;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(xml, { status: 200 })));

    const events = await fetchRssNews("INTC", 1);

    expect(events[0]?.metadata?.publisher).toBe("Yahoo Finance");
    expect(events[0]?.title).toBe("Markets Slide - TSLA, INTC, and NFLX In Focus");
  });
});

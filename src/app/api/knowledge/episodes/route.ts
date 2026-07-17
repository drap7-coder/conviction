import { NextResponse } from "next/server";
import { fetchKnowledgePodcastEpisodes } from "@/lib/knowledge/provider";

// Simple in-memory cache
let cache: { data: unknown; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export async function GET() {
  // Return cached data if still valid
  if (cache && Date.now() < cache.expiresAt) {
    return NextResponse.json(cache.data);
  }

  try {
    const episodes = await fetchKnowledgePodcastEpisodes();
    const data = { episodes };

    cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
    return NextResponse.json(data);
  } catch (err) {
    console.error("[knowledge-api] Failed to fetch episodes:", err);
    return NextResponse.json(
      { episodes: [], error: "Failed to load podcast episodes." },
      { status: 200 },
    );
  }
}
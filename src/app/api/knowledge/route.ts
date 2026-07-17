import { NextResponse } from "next/server";
import { getKnowledgePodcasts } from "@/lib/knowledge/podcasts";

export async function GET() {
  try {
    return NextResponse.json({ items: await getKnowledgePodcasts() });
  } catch {
    return NextResponse.json({ items: [] });
  }
}

import { NextResponse } from "next/server";
import { getKnowledgeBooks } from "@/lib/knowledge/books";
import { getKnowledgePodcasts } from "@/lib/knowledge/podcasts";

export async function GET() {
  const results = await Promise.allSettled([
    getKnowledgePodcasts(),
    getKnowledgeBooks(),
  ]);
  const items = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  return NextResponse.json({ items });
}

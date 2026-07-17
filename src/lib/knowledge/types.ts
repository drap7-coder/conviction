export interface KnowledgeLatestItem {
  title: string;
  duration: string | null;
  publishedAt: string | null;
  canonicalUrl: string;
}

export interface KnowledgeItem {
  id: string;
  kind: "podcast" | "book";
  title: string;
  creator: string;
  artworkUrl: string | null;
  canonicalUrl: string;
  description: string;
  latestItem?: KnowledgeLatestItem;
}

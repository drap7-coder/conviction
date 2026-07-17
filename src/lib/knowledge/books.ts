import { KNOWLEDGE_BOOKS, type KnowledgeBookDefinition } from "./catalog";
import type { KnowledgeItem } from "./types";

interface BookMetadata {
  title: string;
  creator: string;
  artworkUrl: string | null;
  description: string | null;
}

interface GoogleVolumeInfo {
  title?: string;
  authors?: string[];
  description?: string;
  imageLinks?: {
    extraLarge?: string;
    large?: string;
    medium?: string;
    thumbnail?: string;
    smallThumbnail?: string;
  };
}

interface OpenLibraryBook {
  title?: string;
  authors?: Array<{ name?: string }>;
  cover?: { large?: string; medium?: string; small?: string };
  excerpts?: Array<{ text?: string }>;
}

const FRESH_MS = 60 * 60 * 1000;
const STALE_MS = 24 * 60 * 60 * 1000;
let cache: { items: KnowledgeItem[]; fetchedAt: number } | null = null;

async function fetchJson<T>(url: URL): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Conviction-Knowledge/1.0",
      },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Book provider returned ${response.status}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

function secureArtwork(url: string | undefined) {
  if (!url) return null;
  return url.replace(/^http:\/\//i, "https://");
}

async function fetchGoogleBook(isbn: string): Promise<BookMetadata | null> {
  if (!process.env.GOOGLE_BOOKS_API_KEY) return null;

  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", `isbn:${isbn}`);
  url.searchParams.set("maxResults", "1");
  url.searchParams.set("printType", "books");
  url.searchParams.set("projection", "full");
  url.searchParams.set("key", process.env.GOOGLE_BOOKS_API_KEY);

  const data = await fetchJson<{ items?: Array<{ volumeInfo?: GoogleVolumeInfo }> }>(url);
  const info = data.items?.[0]?.volumeInfo;
  if (!info?.title) return null;
  const images = info.imageLinks;

  return {
    title: info.title,
    creator: info.authors?.join(" & ") ?? "",
    artworkUrl: secureArtwork(
      images?.extraLarge
      ?? images?.large
      ?? images?.medium
      ?? images?.thumbnail
      ?? images?.smallThumbnail,
    ),
    description: info.description ?? null,
  };
}

async function fetchOpenLibraryBook(isbn: string): Promise<BookMetadata | null> {
  const key = `ISBN:${isbn}`;
  const url = new URL("https://openlibrary.org/api/books");
  url.searchParams.set("bibkeys", key);
  url.searchParams.set("jscmd", "data");
  url.searchParams.set("format", "json");

  const data = await fetchJson<Record<string, OpenLibraryBook>>(url);
  const book = data[key];
  if (!book?.title) return null;

  return {
    title: book.title,
    creator: book.authors?.map((author) => author.name).filter(Boolean).join(" & ") ?? "",
    artworkUrl: secureArtwork(book.cover?.large ?? book.cover?.medium ?? book.cover?.small),
    description: book.excerpts?.[0]?.text ?? null,
  };
}

async function resolveBook(book: KnowledgeBookDefinition): Promise<KnowledgeItem> {
  const google = await fetchGoogleBook(book.isbn).catch(() => null);
  const metadata = google ?? await fetchOpenLibraryBook(book.isbn).catch(() => null);
  if (!metadata) throw new Error(`No book metadata found for ${book.isbn}`);

  return {
    id: book.id,
    kind: "book",
    title: book.title,
    creator: book.creator,
    artworkUrl: metadata.artworkUrl,
    canonicalUrl: book.canonicalUrl,
    description: book.description,
  };
}

function curatedFallback(): KnowledgeItem[] {
  return KNOWLEDGE_BOOKS.map((book) => ({
    id: book.id,
    kind: "book",
    title: book.title,
    creator: book.creator,
    artworkUrl: null,
    canonicalUrl: book.canonicalUrl,
    description: book.description,
  }));
}

export async function getKnowledgeBooks(): Promise<KnowledgeItem[]> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < FRESH_MS) return cache.items;

  const results = await Promise.allSettled(KNOWLEDGE_BOOKS.map(resolveBook));
  const resolved = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);

  if (resolved.length === KNOWLEDGE_BOOKS.length) {
    cache = { items: resolved, fetchedAt: now };
    return resolved;
  }
  if (cache && now - cache.fetchedAt < STALE_MS) return cache.items;

  const resolvedById = new Map(resolved.map((item) => [item.id, item]));
  return curatedFallback().map((item) => resolvedById.get(item.id) ?? item);
}

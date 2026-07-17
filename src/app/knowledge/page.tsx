"use client";

import { useEffect, useState } from "react";
import { KNOWLEDGE_BOOKS } from "@/lib/knowledge/catalog";
import type { KnowledgeItem } from "@/lib/knowledge/types";

interface KnowledgeShow {
  id: string;
  name: string;
  host: string;
  description: string;
  url: string;
  mark: string;
}

function KnowledgeArtwork({
  url,
  title,
  mark,
  kind,
}: {
  url?: string | null;
  title: string;
  mark: string;
  kind: "AUDIO" | "LIBRARY";
}) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      // Provider artwork hosts vary, so a native image is intentionally used.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`${title} artwork`}
        className="knowledge-provider-art"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <>
      <span className="knowledge-art-kicker">CONVICTION / {kind}</span>
      <span className="knowledge-art-mark">{mark}</span>
      <span className="knowledge-art-title">{title}</span>
    </>
  );
}

const SHOWS: KnowledgeShow[] = [
  {
    id: "invest-like-the-best",
    name: "Invest Like the Best",
    host: "Patrick O'Shaughnessy",
    description:
      "Conversations with the world's best investors about the principles, frameworks, and evidence that drive their process. The definitive podcast for evidence-based investing.",
    url: "https://open.spotify.com/show/0aUs0ExITwFqZYUqMqE5Hm",
    mark: "ILT",
  },
  {
    id: "compound-and-friends",
    name: "Compound and Friends",
    host: "Josh Brown & Michael Batnick",
    description:
      "Weekly market roundtable blending data, behavioral finance, and historical context. A sharp, evidence-driven take on what's moving markets and why.",
    url: "https://open.spotify.com/show/6b1J28qKgQJ5WuQ7q7QljA",
    mark: "C&F",
  },
  {
    id: "we-study-billionaires",
    name: "We Study Billionaires",
    host: "Stig Brodersen, Preston Pysh & Clay Finck",
    description:
      "Deep dives into the strategies of the world's greatest investors — Buffett, Munger, Dalio, and more. Rigorous, data-backed analysis of what actually works.",
    url: "https://open.spotify.com/show/5I0TJq0WCMY0kUhFk1cRhQ",
    mark: "WSB",
  },
  {
    id: "the-acquirers-podcast",
    name: "The Acquirers Podcast",
    host: "Tobias Carlisle",
    description:
      "Deep value investing and quantitative analysis. Carlisle dissects academic research, screens, and the evidence behind factor-based and contrarian strategies.",
    url: "https://open.spotify.com/show/6f6b1J28qKgQJ5WuQ7q7QljA",
    mark: "AQ",
  },
  {
    id: "capital-allocators",
    name: "Capital Allocators",
    host: "Ted Seides",
    description:
      "Inside the minds of the world's top capital allocators — endowment CIOs, pension fund managers, and family office leaders. The institutional perspective on conviction and portfolio construction.",
    url: "https://open.spotify.com/show/0aUs0ExITwFqZYUqMqE5Hm",
    mark: "CA",
  },
];

export default function KnowledgePage() {
  const [items, setItems] = useState<Record<string, KnowledgeItem>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/knowledge")
      .then((response) => response.json())
      .then((data: { items?: KnowledgeItem[] }) => {
        if (cancelled) return;
        setItems(Object.fromEntries((data.items ?? []).map((item) => [item.id, item])));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="knowledge-page">
      <div className="knowledge-header">
        <h2 className="section-title">Knowledge Hub</h2>
        <p className="knowledge-subtitle">Curated resources for evidence-based investing.</p>
      </div>

      {/* Shows section — static, curated, no runtime dependencies */}
      <div className="knowledge-section">
        <h3 className="knowledge-section-title">Shows</h3>
        <div className="knowledge-show-grid">
          {SHOWS.map((show) => (
            (() => {
              const live = items[show.id];
              return (
            <a
              key={show.name}
              href={live?.latestItem?.canonicalUrl ?? live?.canonicalUrl ?? show.url}
              target="_blank"
              rel="noopener noreferrer"
              className="knowledge-show-card group"
            >
              <div className="knowledge-show-art-wrap">
                <KnowledgeArtwork url={live?.artworkUrl} title={show.name} mark={show.mark} kind="AUDIO" />
              </div>
              <div className="knowledge-show-body">
                <span className="knowledge-show-name">{show.name}</span>
                <span className="knowledge-show-host">{show.host}</span>
                {live?.latestItem ? (
                  <p className="knowledge-show-latest">
                    Latest: {live.latestItem.title}
                    {live.latestItem.duration ? ` · ${live.latestItem.duration}` : ""}
                  </p>
                ) : null}
                <p className="knowledge-show-desc">{show.description}</p>
                <span className="knowledge-show-action">
                  [LISTEN]
                </span>
              </div>
            </a>
              );
            })()
          ))}
        </div>
      </div>

      {/* Books section — terminal card style */}
      <div className="knowledge-section">
        <h3 className="knowledge-section-title">Foundational books</h3>
        <div className="knowledge-book-grid">
          {KNOWLEDGE_BOOKS.map((book) => {
            const live = items[book.id];
            return (
            <a
              key={book.id}
              href={live?.canonicalUrl ?? book.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="knowledge-book-card group"
            >
              <div className="knowledge-book-cover-wrap">
                <KnowledgeArtwork
                  url={live?.artworkUrl}
                  title={live?.title ?? book.title}
                  mark={book.mark}
                  kind="LIBRARY"
                />
              </div>
              <div className="knowledge-book-body">
                <span className="knowledge-book-tag">Book</span>
                <h3 className="knowledge-book-title">{live?.title ?? book.title}</h3>
                <p className="knowledge-book-author">{live?.creator ?? book.creator}</p>
                <p className="knowledge-book-desc">{live?.description ?? book.description}</p>
                <span className="knowledge-book-action">
                  [READ ON AMAZON]
                </span>
              </div>
            </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

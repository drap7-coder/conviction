"use client";

import { useEffect, useState } from "react";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import type { PodcastEpisode } from "@/lib/knowledge/types";

interface KnowledgeBook {
  title: string;
  author: string;
  url: string;
  description: string;
}

const BOOKS: KnowledgeBook[] = [
  {
    title: "Superforecasting",
    author: "Philip Tetlock & Dan Gardner",
    url: "https://www.amazon.com/Superforecasting-Science-Prediction-Philip-Tetlock/dp/0804136696",
    description:
      "The art and science of prediction. How to quantify uncertainty, weigh competing signals, and calibrate conviction — the theoretical bedrock of evidence-based investing.",
  },
  {
    title: "The Outsiders",
    author: "William N. Thorndike",
    url: "https://www.amazon.com/Outsiders-Unconventional-Radically-Rational-Blueprint/dp/1422162672",
    description:
      "Eight unconventional CEOs and their radically rational approach to capital allocation. Essential reading for understanding the institutional signals your 13F data is tracking.",
  },
];

export default function KnowledgePage() {
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchJsonWithTimeout<{ episodes: PodcastEpisode[] }>(
          "/api/knowledge/episodes",
          10_000,
        );
        if (!cancelled) {
          setEpisodes(data.episodes ?? []);
        }
      } catch {
        // silent — episodes will be empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="knowledge-page">
      <div className="knowledge-header">
        <h2 className="section-title">Knowledge Hub</h2>
        <p className="knowledge-subtitle">Curated resources for evidence-based investing.</p>
      </div>

      {/* Podcast episodes section */}
      <div className="knowledge-section">
        <h3 className="knowledge-section-title">Latest episodes</h3>
        {loading ? (
          <div className="knowledge-loading">
            <span className="knowledge-loading-dot" />
            <span className="knowledge-loading-dot" />
            <span className="knowledge-loading-dot" />
          </div>
        ) : episodes.length === 0 ? (
          <p className="knowledge-empty">Podcast episodes are temporarily unavailable.</p>
        ) : (
          <div className="knowledge-rail" aria-label="Latest podcast episodes">
            {episodes.map((ep) => (
              <a
                key={ep.id}
                href={ep.linkUrl}
                target="_blank"
                rel="noreferrer"
                className="knowledge-episode-card"
              >
                {ep.artworkUrl ? (
                  <img
                    src={ep.artworkUrl}
                    alt=""
                    className="knowledge-episode-art"
                    loading="lazy"
                  />
                ) : (
                  <div className="knowledge-episode-art knowledge-episode-art-fallback">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                  </div>
                )}
                <div className="knowledge-episode-body">
                  <span className="knowledge-episode-show">{ep.showName}</span>
                  <span className="knowledge-episode-title">{ep.title}</span>
                  <span className="knowledge-episode-meta">
                    {ep.duration}{ep.duration ? " · " : ""}{ep.showName}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Books section */}
      <div className="knowledge-section">
        <h3 className="knowledge-section-title">Foundational books</h3>
        <div className="knowledge-grid">
          {BOOKS.map((book) => (
            <a
              key={book.title}
              href={book.url}
              target="_blank"
              rel="noreferrer"
              className="knowledge-card"
            >
              <div className="knowledge-card-tag">Book</div>
              <h3 className="knowledge-card-title">{book.title}</h3>
              <p className="knowledge-card-author">{book.author}</p>
              <p className="knowledge-card-desc">{book.description}</p>
              <div className="knowledge-card-action">
                <span>Read</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 17l9.2-9.2M17 17V7H7" />
                </svg>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
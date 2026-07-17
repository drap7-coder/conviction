import Link from "next/link";

interface KnowledgeItem {
  title: string;
  source: string;
  url: string;
  description: string;
  category: "featured" | "podcast" | "book";
}

const ITEMS: KnowledgeItem[] = [
  {
    title: "Compound and Friends",
    source: "Podcast",
    url: "https://podcasts.apple.com/us/podcast/compound-friends/id1552554625",
    description:
      "Market news meets professional-grade analysis. The anchor podcast for understanding institutional logic and market structure through conversational but deeply analytical discussion.",
    category: "featured",
  },
  {
    title: "Invest Like the Best",
    source: "Podcast",
    url: "https://podcasts.apple.com/us/podcast/invest-like-the-best-with-patrick-oshaughnessy/id1154105909",
    description:
      "Patrick O'Shaughnessy interviews the world's best capital allocators on the mental models and structural advantages that drive long-term success. The gold standard for high-conviction thinking.",
    category: "podcast",
  },
  {
    title: "Superforecasting",
    source: "Book",
    url: "https://www.amazon.com/Superforecasting-Science-Prediction-Philip-Tetlock/dp/0804136696",
    description:
      "The art and science of prediction. How to quantify uncertainty, weigh competing signals, and calibrate conviction — the theoretical bedrock of evidence-based investing.",
    category: "book",
  },
  {
    title: "The Outsiders",
    source: "Book",
    url: "https://www.amazon.com/Outsiders-Unconventional-Radically-Rational-Blueprint/dp/1422162672",
    description:
      "Eight unconventional CEOs and their radically rational approach to capital allocation. Essential reading for understanding the institutional signals your 13F data is tracking.",
    category: "book",
  },
];

export default function KnowledgePage() {
  const featured = ITEMS.find((i) => i.category === "featured")!;
  const secondary = ITEMS.filter((i) => i.category !== "featured");

  return (
    <div className="knowledge-page">
      <div className="knowledge-header">
        <h2 className="section-title">Knowledge Hub</h2>
        <p className="knowledge-subtitle">Curated resources for evidence-based investing.</p>
      </div>

      <Link
        href={featured.url}
        target="_blank"
        rel="noreferrer"
        className="knowledge-featured-card"
      >
        <div className="knowledge-featured-tag">{featured.source}</div>
        <h3 className="knowledge-featured-title">{featured.title}</h3>
        <p className="knowledge-featured-desc">{featured.description}</p>
        <div className="knowledge-featured-action">
          <span>Listen</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 17l9.2-9.2M17 17V7H7" />
          </svg>
        </div>
      </Link>

      <div className="knowledge-grid">
        {secondary.map((item) => (
          <Link
            key={item.title}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="knowledge-card"
          >
            <div className="knowledge-card-tag">{item.source}</div>
            <h3 className="knowledge-card-title">{item.title}</h3>
            <p className="knowledge-card-desc">{item.description}</p>
            <div className="knowledge-card-action">
              <span>{item.source === "Podcast" ? "Listen" : "Read"}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 17l9.2-9.2M17 17V7H7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
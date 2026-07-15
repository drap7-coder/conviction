import Link from "next/link";

export default function JournalPage() {
  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Decision journal</h2>
        <span className="section-count">Private</span>
      </div>

      <div className="empty-state">
        <p>No thesis entries yet.</p>
        <small>
          Journal entries will be private notes tied to saved companies. Start from the watchlist.
        </small>
        <div className="mt-16">
          <Link href="/" className="auth-button">
            Back to watchlist
          </Link>
        </div>
      </div>
    </div>
  );
}

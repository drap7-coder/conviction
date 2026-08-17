import Link from "next/link";
import { UtilityPageLead } from "@/components/UtilityPageLead";

export default function JournalPage() {
  return (
    <div>
      <UtilityPageLead
        eyebrow="Decision journal · Private"
        title="Write the reason down."
        summary="Keep the thesis, the evidence, and what would change your mind beside every saved company."
      />

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

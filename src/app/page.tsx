import { BriefingDate } from "@/components/market/BriefingDate";
import styles from "@/components/market/HomeEditorial.module.css";
import { HomeOverview } from "@/components/market/HomeOverview";

/**
 * IQBulls Home — editorial market perspective, distinct from the full market tape.
 * Full Markets / Movers / Crypto / Intl stays on /pulse.
 */
export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.masthead}>
        <div><h1>Daily Briefing</h1><BriefingDate /></div>
      </header>
      <HomeOverview />
    </main>
  );
}

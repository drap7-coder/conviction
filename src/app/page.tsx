import { BriefingDate } from "@/components/market/BriefingDate";
import Image from "next/image";
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
        <div className={styles.brandLockup}>
          <Image src="/iqbulls-bull.png" width={48} height={48} alt="" className={styles.brandMark} />
          <div><h1>IQBulls Daily Briefing</h1><BriefingDate /></div>
        </div>
        <p>What happened. Why it matters. What to watch.</p>
      </header>
      <HomeOverview />
    </main>
  );
}

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
          <h1>IQBulls / The daily perspective</h1>
        </div>
        <p>Understand the market. Build your conviction.</p>
      </header>
      <HomeOverview />
    </main>
  );
}

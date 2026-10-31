"use client";

import { useEffect, useState } from "react";
import { briefingEdition } from "@/lib/market/home-editorial";
import styles from "./HomeEditorial.module.css";

/** Client date prevents a statically built page from retaining its build date. */
export function BriefingDate() {
  const [edition, setEdition] = useState<ReturnType<typeof briefingEdition> | null>(null);
  useEffect(() => {
    const update = () => setEdition(briefingEdition(new Date()));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return <p className={styles.edition}>{edition ? <><time dateTime={edition.iso}>{edition.label}</time><span>{edition.weekend ? "Weekend edition · latest available market session" : "Daily edition · dates in Eastern Time"}</span></> : "Daily edition · Eastern Time"}</p>;
}

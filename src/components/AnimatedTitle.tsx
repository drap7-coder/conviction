"use client";

import { useEffect, useState } from "react";

const FULL_TEXT = "CONVICTION.";
const STORAGE_KEY = "conviction-title-revealed";

export default function AnimatedTitle() {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const [skip, setSkip] = useState(true);

  useEffect(() => {
    // Check if we've already played the animation
    let alreadySeen = true;
    try {
      alreadySeen = localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      // localStorage unavailable, skip
    }
    if (alreadySeen) {
      setDisplayed(FULL_TEXT);
      setDone(true);
      return;
    }

    setSkip(false);
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(FULL_TEXT.slice(0, i));
      if (i >= FULL_TEXT.length) {
        clearInterval(interval);
        setDone(true);
        try {
          localStorage.setItem(STORAGE_KEY, "true");
        } catch {
          // best-effort
        }
      }
    }, 120);

    return () => clearInterval(interval);
  }, []);

  if (skip) {
    return <h1 className="app-title">CONVICTION<span className="accent-dot">.</span></h1>;
  }

  return (
    <h1 className="app-title typewriter">
      {displayed}
      {!done && <span className="typewriter-cursor" />}
    </h1>
  );
}
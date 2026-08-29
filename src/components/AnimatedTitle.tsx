"use client";

import { useEffect, useState } from "react";

/** First-visit boot types lowercase with period; settled nav drops the period. */
const BOOT_TEXT = "conviction.";
const SETTLED_TEXT = "CONVICTION";
const STORAGE_KEY = "conviction-title-revealed";
const SOUND_PREF_KEY = "conviction-boot-sound";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Soft click tick for the boot typewriter — opt-in via localStorage. */
function playBootTick(): void {
  try {
    if (localStorage.getItem(SOUND_PREF_KEY) !== "on") return;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.value = 0.035;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.045);
    osc.stop(ctx.currentTime + 0.05);
    window.setTimeout(() => {
      void ctx.close();
    }, 80);
  } catch {
    // Audio is optional chrome — never block boot.
  }
}

export default function AnimatedTitle() {
  const [displayed, setDisplayed] = useState(SETTLED_TEXT);
  const [done, setDone] = useState(true);
  const [skip, setSkip] = useState(true);

  useEffect(() => {
    let alreadySeen = true;
    try {
      alreadySeen = localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      // localStorage unavailable — settle immediately
    }

    if (alreadySeen || prefersReducedMotion()) {
      setDisplayed(SETTLED_TEXT);
      setDone(true);
      setSkip(true);
      if (!alreadySeen) {
        try {
          localStorage.setItem(STORAGE_KEY, "true");
        } catch {
          // best-effort
        }
      }
      return;
    }

    setSkip(false);
    setDone(false);
    setDisplayed("");
    let i = 0;
    const interval = window.setInterval(() => {
      i++;
      setDisplayed(BOOT_TEXT.slice(0, i));
      playBootTick();
      if (i >= BOOT_TEXT.length) {
        window.clearInterval(interval);
        setDone(true);
        window.setTimeout(() => {
          setDisplayed(SETTLED_TEXT);
          setSkip(true);
        }, 420);
        try {
          localStorage.setItem(STORAGE_KEY, "true");
        } catch {
          // best-effort
        }
      }
    }, 110);

    return () => window.clearInterval(interval);
  }, []);

  if (skip) {
    return <span className="app-title">{displayed || SETTLED_TEXT}</span>;
  }

  return (
    <span className="app-title typewriter" aria-label={SETTLED_TEXT}>
      {displayed}
      {!done && <span className="typewriter-cursor" aria-hidden="true" />}
    </span>
  );
}

"use client";

import { useEffect, useState, type MouseEvent } from "react";

/** Header chrome display mark — spaced for the typewriter; SEO SITE_NAME stays IQBulls. */
const BOOT_BODY = "IQ Bulls";
const BOOT_FINAL = "IQ Bulls.";
const SETTLED_TEXT = "IQ Bulls";
const STORAGE_KEY = "iqbulls-title-revealed";
const SOUND_PREF_KEY = "iqbulls-boot-sound";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function readSoundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_PREF_KEY) === "on";
  } catch {
    return false;
  }
}

/** Soft click tick — opt-in only; fail silently if audio is blocked. */
function playBootTick(soundOn: boolean): void {
  if (!soundOn) return;
  try {
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
  const [body, setBody] = useState(SETTLED_TEXT);
  const [phase, setPhase] = useState<"settled" | "typing" | "blink">("settled");
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    setSoundOn(readSoundOn());

    let alreadySeen = true;
    try {
      alreadySeen = localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      // localStorage unavailable — settle immediately
    }

    if (alreadySeen) {
      setBody(SETTLED_TEXT);
      setPhase("settled");
      return;
    }

    // First visit: reduced motion skips typing, shows final boot frame, then settles.
    if (prefersReducedMotion()) {
      setBody(BOOT_BODY);
      setPhase("blink");
      try {
        localStorage.setItem(STORAGE_KEY, "true");
      } catch {
        // best-effort
      }
      const settleTimer = window.setTimeout(() => {
        setBody(SETTLED_TEXT);
        setPhase("settled");
      }, 900);
      return () => window.clearTimeout(settleTimer);
    }

    setBody("");
    setPhase("typing");
    let i = 0;
    let settleTimer: number | undefined;
    const interval = window.setInterval(() => {
      i += 1;
      setBody(BOOT_BODY.slice(0, i));
      playBootTick(readSoundOn());
      if (i >= BOOT_BODY.length) {
        window.clearInterval(interval);
        setPhase("blink");
        try {
          localStorage.setItem(STORAGE_KEY, "true");
        } catch {
          // best-effort
        }
        settleTimer = window.setTimeout(() => {
          setBody(SETTLED_TEXT);
          setPhase("settled");
        }, 1100);
      }
    }, 110);

    return () => {
      window.clearInterval(interval);
      if (settleTimer) window.clearTimeout(settleTimer);
    };
  }, []);

  function toggleSound(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const next = !soundOn;
    setSoundOn(next);
    try {
      localStorage.setItem(SOUND_PREF_KEY, next ? "on" : "off");
    } catch {
      // best-effort
    }
    if (next) playBootTick(true);
  }

  const booting = phase === "typing" || phase === "blink";
  const showPeriodCursor = phase === "blink";

  if (phase === "settled") {
    return <span className="app-title">{SETTLED_TEXT}</span>;
  }

  return (
    <span className="app-title-boot">
      <span
        className={`app-title typewriter${phase === "typing" ? " is-typing" : ""}`}
        aria-label={BOOT_FINAL}
      >
        <span className="app-title-boot-body">{body}</span>
        {showPeriodCursor ? (
          <span className="typewriter-period" aria-hidden="true">
            .
          </span>
        ) : phase === "typing" ? (
          <span className="typewriter-cursor" aria-hidden="true" />
        ) : null}
      </span>
      {booting ? (
        <button
          type="button"
          className={`boot-sound-toggle${soundOn ? " is-on" : ""}`}
          aria-label={soundOn ? "Mute boot sound" : "Unmute boot sound"}
          aria-pressed={soundOn}
          title={soundOn ? "Mute" : "Sound off (click to enable)"}
          onClick={toggleSound}
        >
          {soundOn ? (
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path
                fill="currentColor"
                d="M2 6.5h2.2L7.5 4v8L4.2 9.5H2zm7.2.2a2.4 2.4 0 0 1 0 2.6l-.8-.6a1.4 1.4 0 0 0 0-1.4zm1.7-1.7a4.2 4.2 0 0 1 0 6l-.85-.55a3.2 3.2 0 0 0 0-4.9z"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path
                fill="currentColor"
                d="M2 6.5h2.2L7.5 4v8L4.2 9.5H2zm9.4-2.1.7.7-1.6 1.6 1.6 1.6-.7.7-1.6-1.6-1.6 1.6-.7-.7 1.6-1.6-1.6-1.6.7-.7 1.6 1.6z"
              />
            </svg>
          )}
        </button>
      ) : null}
    </span>
  );
}

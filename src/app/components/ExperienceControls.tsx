"use client";

import { useEffect, useRef, useState } from "react";

type Theme = "dark" | "light";

const THEME_KEY = "conviction-theme";
const SOUND_KEY = "conviction-sound";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const saved = window.localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function createTick(audioContext: AudioContext) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(920, audioContext.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(620, audioContext.currentTime + 0.045);

  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.028, audioContext.currentTime + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.065);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.07);
}

export function ExperienceControls() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(false);

  useEffect(() => {
    const initialTheme = getInitialTheme();
    const initialSound = window.localStorage.getItem(SOUND_KEY) === "on";

    setTheme(initialTheme);
    setSoundEnabled(initialSound);
    soundEnabledRef.current = initialSound;
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!soundEnabledRef.current) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const interactive = target.closest("a, button, summary, input, select, textarea");
      if (!interactive) return;

      try {
        audioRef.current ??= new AudioContext();
        if (audioRef.current.state === "suspended") {
          void audioRef.current.resume();
        }
        createTick(audioRef.current);
      } catch {
        // Audio feedback is optional; interaction should never depend on it.
      }
    };

    window.addEventListener("click", handleClick, { capture: true });
    return () => window.removeEventListener("click", handleClick, { capture: true });
  }, []);

  const nextTheme = theme === "dark" ? "light" : "dark";

  function toggleTheme() {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem(THEME_KEY, nextTheme);
  }

  function toggleSound() {
    const nextSound = !soundEnabled;
    setSoundEnabled(nextSound);
    window.localStorage.setItem(SOUND_KEY, nextSound ? "on" : "off");
  }

  return (
    <div className="experience-controls" aria-label="Display and sound controls">
      <button
        type="button"
        className="control-button"
        onClick={toggleTheme}
        aria-label={`Switch to ${nextTheme} mode`}
        title={`Switch to ${nextTheme} mode`}
      >
        <span aria-hidden="true">{theme === "dark" ? "☾" : "☀"}</span>
        <span>{theme === "dark" ? "Dark" : "Light"}</span>
      </button>
      <button
        type="button"
        className={`control-button ${soundEnabled ? "active" : ""}`}
        onClick={toggleSound}
        aria-pressed={soundEnabled}
        aria-label={soundEnabled ? "Turn sound off" : "Turn sound on"}
        title={soundEnabled ? "Turn sound off" : "Turn sound on"}
      >
        <span aria-hidden="true">{soundEnabled ? "♪" : "×"}</span>
        <span>Sound</span>
      </button>
    </div>
  );
}

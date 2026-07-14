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
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const subOscillator = audioContext.createOscillator();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(520, now);
  oscillator.frequency.exponentialRampToValueAtTime(390, now + 0.055);

  subOscillator.type = "triangle";
  subOscillator.frequency.setValueAtTime(260, now);
  subOscillator.frequency.exponentialRampToValueAtTime(210, now + 0.07);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1200, now);
  filter.frequency.exponentialRampToValueAtTime(720, now + 0.08);
  filter.Q.setValueAtTime(0.8, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.018, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.003, now + 0.035);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

  oscillator.connect(filter);
  subOscillator.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  subOscillator.start(now + 0.012);
  oscillator.stop(now + 0.075);
  subOscillator.stop(now + 0.095);
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

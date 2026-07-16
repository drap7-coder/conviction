"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

export function WatchlistSettingsMenu() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
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

  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
    }
  }, [open, handleOutsideClick]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      buttonRef.current?.focus();
    }
  }

  return (
    <div className="watchlist-settings" ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        className="settings-gear"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Watchlist settings"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </button>

      {open && (
        <div
          className="settings-popover"
          role="dialog"
          aria-label="Settings"
          onKeyDown={handleKeyDown}
        >
          <button
            type="button"
            className="settings-option"
            onClick={toggleTheme}
            aria-label={`Switch to ${nextTheme} mode`}
          >
            <span aria-hidden="true">{theme === "dark" ? "☾" : "☀"}</span>
            <span>{theme === "dark" ? "Dark mode" : "Light mode"}</span>
          </button>
          <button
            type="button"
            className={`settings-option ${soundEnabled ? "active" : ""}`}
            onClick={toggleSound}
            aria-pressed={soundEnabled}
            aria-label={soundEnabled ? "Turn sound off" : "Turn sound on"}
          >
            <span aria-hidden="true">{soundEnabled ? "♪" : "×"}</span>
            <span>Interface sound</span>
          </button>
        </div>
      )}
    </div>
  );
}
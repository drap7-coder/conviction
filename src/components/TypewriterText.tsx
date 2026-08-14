"use client";

import { useEffect, useState } from "react";

type TypewriterTag = "h1" | "h2" | "span";

/**
 * Types text on arrival for page-top impact.
 * Replays when `text` changes. Honors prefers-reduced-motion.
 */
export function TypewriterText({
  text,
  as: Tag = "span",
  className,
  msPerChar = 32,
  startDelay = 90,
}: {
  text: string;
  as?: TypewriterTag;
  className?: string;
  msPerChar?: number;
  startDelay?: number;
}) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!text) {
      setDisplayed("");
      setDone(true);
      return;
    }

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      setDisplayed(text);
      setDone(true);
      return;
    }

    setDisplayed("");
    setDone(false);
    let i = 0;
    let interval: number | undefined;
    const timeout = window.setTimeout(() => {
      interval = window.setInterval(() => {
        i += 1;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          if (interval !== undefined) window.clearInterval(interval);
          setDone(true);
        }
      }, msPerChar);
    }, startDelay);

    return () => {
      window.clearTimeout(timeout);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [text, msPerChar, startDelay]);

  return (
    <Tag className={className ? `${className} typewriter-line` : "typewriter-line"} aria-label={text}>
      <span aria-hidden="true">
        {displayed}
        {!done ? <span className="typewriter-cursor" /> : null}
      </span>
    </Tag>
  );
}

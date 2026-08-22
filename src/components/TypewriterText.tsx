"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type TypewriterTag = "h1" | "h2" | "span";

/** Back up to a word boundary and add an ellipsis when a typed headline overflows. */
export function trimHeadlineToFit(visible: string): string {
  const trimmed = visible.trimEnd();
  if (!trimmed) return "…";
  const cut = trimmed.replace(/\s+\S+$/u, "").replace(/[\s.,;:!?—–-]+$/u, "");
  return `${cut || trimmed}…`;
}

/**
 * Types text on arrival for page-top impact.
 * Replays when `text` changes. Honors prefers-reduced-motion.
 * When `maxLines` is set, stop typing once the painted box would grow past that.
 */
export function TypewriterText({
  text,
  as: Tag = "span",
  className,
  msPerChar = 32,
  startDelay = 90,
  maxLines,
}: {
  text: string;
  as?: TypewriterTag;
  className?: string;
  msPerChar?: number;
  startDelay?: number;
  maxLines?: number;
}) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const measureRef = useRef<HTMLElement | null>(null);
  const stopRef = useRef(false);

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

    stopRef.current = false;
    setDisplayed("");
    setDone(false);
    let i = 0;
    let interval: number | undefined;
    const timeout = window.setTimeout(() => {
      interval = window.setInterval(() => {
        if (stopRef.current) {
          if (interval !== undefined) window.clearInterval(interval);
          return;
        }
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

  useLayoutEffect(() => {
    if (!maxLines || !displayed) return;
    const el = measureRef.current;
    if (!el) return;
    // max-height (not line-clamp) so scrollHeight still reports the unclipped box.
    if (el.scrollHeight <= el.clientHeight + 1) return;

    stopRef.current = true;
    const withoutEllipsis = displayed.endsWith("…") ? displayed.slice(0, -1) : displayed;
    const source = displayed.endsWith("…") ? withoutEllipsis : withoutEllipsis.slice(0, -1);
    const next = trimHeadlineToFit(source);
    if (next === displayed) {
      setDone(true);
      return;
    }
    setDisplayed(next);
    setDone(true);
  }, [displayed, maxLines]);

  return (
    <Tag
      ref={measureRef as never}
      className={className ? `${className} typewriter-line` : "typewriter-line"}
      style={
        maxLines
          ? { maxHeight: `calc(1.12em * ${maxLines})`, overflow: "hidden" }
          : undefined
      }
      aria-label={text}
    >
      <span aria-hidden="true">
        {displayed}
        {!done ? <span className="typewriter-cursor" /> : null}
      </span>
    </Tag>
  );
}

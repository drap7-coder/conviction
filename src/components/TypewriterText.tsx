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

/** Count wrapped line boxes for the visible text, ignoring the caret. */
export function countWrappedLines(el: HTMLElement): number {
  const hidden = el.querySelector("span[aria-hidden='true']");
  if (!hidden) return 0;
  let textNode: ChildNode | null = null;
  for (const node of hidden.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && (node.textContent || "").length) {
      textNode = node;
      break;
    }
  }
  if (!textNode) return 0;
  const range = document.createRange();
  range.selectNodeContents(textNode);
  const tops: number[] = [];
  for (const rect of range.getClientRects()) {
    if (rect.height < 1 || rect.width < 1) continue;
    if (!tops.some((top) => Math.abs(top - rect.top) < 2)) tops.push(rect.top);
  }
  return tops.length;
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
  const intervalRef = useRef<number | undefined>(undefined);

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
    const timeout = window.setTimeout(() => {
      intervalRef.current = window.setInterval(() => {
        if (stopRef.current) {
          if (intervalRef.current !== undefined) window.clearInterval(intervalRef.current);
          return;
        }
        i += 1;
        const next = text.slice(0, i);
        setDisplayed((prev) => (stopRef.current ? prev : next));
        if (i >= text.length) {
          if (intervalRef.current !== undefined) window.clearInterval(intervalRef.current);
          if (!stopRef.current) setDone(true);
        }
      }, msPerChar);
    }, startDelay);

    return () => {
      window.clearTimeout(timeout);
      if (intervalRef.current !== undefined) window.clearInterval(intervalRef.current);
    };
  }, [text, msPerChar, startDelay]);

  useLayoutEffect(() => {
    if (!maxLines || !displayed) return;
    const el = measureRef.current;
    if (!el) return;
    if (countWrappedLines(el) <= maxLines) return;

    stopRef.current = true;
    if (intervalRef.current !== undefined) window.clearInterval(intervalRef.current);
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
      aria-label={text}
    >
      <span aria-hidden="true">
        {displayed}
        {!done ? <span className="typewriter-cursor" /> : null}
      </span>
    </Tag>
  );
}

"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type TypewriterTag = "h1" | "h2" | "span";

/** Count wrapped line boxes for the first text node under `el`. */
export function countWrappedLines(el: HTMLElement): number {
  let textNode: Node | null = null;
  const walk = (node: Node) => {
    if (textNode) return;
    if (node.nodeType === Node.TEXT_NODE && (node.textContent || "").trim()) {
      textNode = node;
      return;
    }
    node.childNodes.forEach(walk);
  };
  walk(el);
  if (!textNode) return 0;
  const range = document.createRange();
  range.selectNodeContents(textNode);
  const tops: number[] = [];
  let minTop = Infinity;
  let maxBottom = -Infinity;
  for (const rect of range.getClientRects()) {
    if (rect.height < 1 || rect.width < 1) continue;
    minTop = Math.min(minTop, rect.top);
    maxBottom = Math.max(maxBottom, rect.bottom);
    if (!tops.some((top) => Math.abs(top - rect.top) < 2)) tops.push(rect.top);
  }
  const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
  const height = Number.isFinite(minTop) ? maxBottom - minTop : 0;
  const byHeight =
    Number.isFinite(lineHeight) && lineHeight > 0 && height > 0
      ? Math.max(1, Math.ceil((height - 0.5) / lineHeight))
      : 0;
  return Math.max(tops.length, byHeight);
}

/** Largest font size in [minPx, maxPx] where `el` still paints in `maxLines`. */
export function fitFontSizeToLines(
  el: HTMLElement,
  maxLines: number,
  maxPx: number,
  minPx: number,
): number {
  const apply = (px: number) => {
    el.style.fontSize = `${px}px`;
    el.style.lineHeight = "1.12";
    el.style.letterSpacing = "-0.05em";
  };

  apply(maxPx);
  if (countWrappedLines(el) <= maxLines) return maxPx;

  let lo = minPx;
  let hi = maxPx;
  let best = minPx;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    apply(mid);
    if (countWrappedLines(el) <= maxLines) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  apply(best);
  return best;
}

/**
 * Types text on arrival for page-top impact.
 * Replays when `text` changes. Honors prefers-reduced-motion.
 * When `maxLines` is set, shrink the font so the full text fits that many lines.
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
  const [fontPx, setFontPx] = useState<number | null>(null);
  const boxRef = useRef<HTMLElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const fitted = !maxLines || fontPx != null;

  useLayoutEffect(() => {
    if (!maxLines) return;
    const box = boxRef.current;
    const measure = measureRef.current;
    if (!box || !measure || !text) {
      setFontPx(null);
      return;
    }

    const fit = () => {
      measure.style.fontSize = "";
      const maxPx = parseFloat(getComputedStyle(box).fontSize);
      if (!Number.isFinite(maxPx) || maxPx <= 0) return;
      const minPx = 8;
      setFontPx(fitFontSizeToLines(measure, maxLines, maxPx, minPx));
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [text, maxLines]);

  useLayoutEffect(() => {
    if (!maxLines || !displayed || fontPx == null) return;
    const inner = boxRef.current?.querySelector(":scope > span[aria-hidden='true']");
    if (!(inner instanceof HTMLElement)) return;
    if (countWrappedLines(inner) <= maxLines) return;
    setFontPx((prev) => (prev == null || prev <= 8 ? prev : Math.max(8, prev - 0.6)));
  }, [displayed, fontPx, maxLines]);

  useEffect(() => {
    if (!text) {
      setDisplayed("");
      setDone(true);
      return;
    }
    if (!fitted) return;

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
  }, [text, msPerChar, startDelay, fitted]);

  return (
    <Tag
      ref={boxRef as never}
      className={className ? `${className} typewriter-line` : "typewriter-line"}
      aria-label={text}
    >
      <span
        aria-hidden="true"
        style={
          fontPx != null
            ? { fontSize: `${fontPx}px`, lineHeight: 1.12, letterSpacing: "-0.05em" }
            : undefined
        }
      >
        {displayed}
        {!done && fitted ? <span className="typewriter-cursor" /> : null}
      </span>
      {maxLines ? (
        <span ref={measureRef} className="typewriter-fit-measure" aria-hidden="true">
          {text}
        </span>
      ) : null}
    </Tag>
  );
}

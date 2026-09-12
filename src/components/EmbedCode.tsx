"use client";

import { useState } from "react";

export function EmbedCode({
  path,
  title,
  width = 320,
  height = 200,
}: {
  path: string;
  title: string;
  width?: number;
  height?: number;
}) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [surface, setSurface] = useState("dark");
  const [accent, setAccent] = useState("green");
  const separator = path.includes("?") ? "&" : "?";
  const src = `https://iqbulls.com${path}${separator}surface=${surface}&accent=${accent}`;
  const code = `<iframe src="${src}" title="${title}" width="${width}" height="${height}" loading="lazy" style="border:0"></iframe>`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }
  return (
    <details
      className="embed-code"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Embed</summary>
      <div className="embed-code-panel">
        <div className="embed-code-options">
          <label>
            Surface
            <select
              value={surface}
              onChange={(e) => setSurface(e.target.value)}
            >
              <option value="dark">Dark</option>
              <option value="cream">Cream</option>
            </select>
          </label>
          <label>
            Accent
            <select value={accent} onChange={(e) => setAccent(e.target.value)}>
              <option value="green">Green</option>
              <option value="blue">Blue</option>
              <option value="violet">Violet</option>
              <option value="pink">Pink</option>
              <option value="mono">Monochrome</option>
            </select>
          </label>
        </div>
        {open ? (
          <iframe
            src={src.replace("https://iqbulls.com", "")}
            title={`${title} preview`}
            width="100%"
            height="120"
            loading="lazy"
          />
        ) : null}
        <code>{code}</code>
        <button type="button" onClick={copy}>
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
    </details>
  );
}

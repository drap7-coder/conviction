"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import type { CompanySuggestion } from "@/lib/sec/company-tickers";

function highlightMatch(text: string, query: string) {
  const normalized = query.trim();
  if (!normalized) return text;
  const index = text.toLowerCase().indexOf(normalized.toLowerCase());
  if (index === -1) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="ticker-suggestion-match">
        {text.slice(index, index + normalized.length)}
      </mark>
      {text.slice(index + normalized.length)}
    </>
  );
}

export function CompanyTypeahead({
  value,
  onChange,
  onSelect,
  onEnter,
  placeholder,
  disabled = false,
  className,
  wrapperClassName,
  inputRef,
  autoCapitalize,
  trailing = null,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: CompanySuggestion) => void;
  onEnter?: () => void;
  placeholder: string;
  disabled?: boolean;
  className?: string;
  wrapperClassName?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  /** Optional controls beside the input (e.g. mobile voice/camera). */
  trailing?: ReactNode;
}) {
  const listboxId = useId();
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [status, setStatus] = useState<"idle" | "results" | "empty">("idle");
  const cacheRef = useRef<Map<string, CompanySuggestion[]>>(new Map());
  const selectedTickerRef = useRef<string | null>(null);

  useEffect(() => {
    const query = value.trim();
    const selectedTicker = selectedTickerRef.current;
    if (selectedTicker) {
      selectedTickerRef.current = null;
      if (query.toUpperCase() === selectedTicker) return;
    }
    if (!query) {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      setStatus("idle");
      return;
    }

    const cacheKey = query.toLowerCase();
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setSuggestions(cached);
      setStatus(cached.length > 0 ? "results" : "empty");
      setOpen(true);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    const debounce = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/companies/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (!response.ok) return;
        const data = (await response.json()) as { suggestions?: CompanySuggestion[] };
        const next = data.suggestions ?? [];
        cacheRef.current.set(cacheKey, next);
        setSuggestions(next);
        setStatus(next.length > 0 ? "results" : "empty");
        setOpen(true);
        setActiveIndex(-1);
      } catch {
        // Suggestions are best-effort. The form can still resolve a typed name or ticker.
      }
    }, 150);

    return () => {
      window.clearTimeout(debounce);
      controller.abort();
    };
  }, [value]);

  function selectSuggestion(suggestion: CompanySuggestion) {
    selectedTickerRef.current = suggestion.ticker.toUpperCase();
    setOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
    setStatus("idle");
    onSelect(suggestion);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (open && event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (open && suggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, suggestions.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === "Enter" && activeIndex >= 0 && suggestions[activeIndex]) {
        event.preventDefault();
        selectSuggestion(suggestions[activeIndex]);
        return;
      }
    }
    if (event.key === "Enter" && onEnter) {
      event.preventDefault();
      onEnter();
    }
  }

  const activeOptionId = activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined;

  return (
    <div className={[wrapperClassName, trailing ? "has-ticker-capture" : ""].filter(Boolean).join(" ")}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0 || status === "empty") setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={activeOptionId}
        autoCapitalize={autoCapitalize}
        autoComplete="off"
      />
      {trailing}
      {open && status === "results" && suggestions.length > 0 ? (
        <ul id={listboxId} className="ticker-suggestions" role="listbox">
          {suggestions.map((suggestion, index) => (
            <li
              id={`${listboxId}-${index}`}
              key={`${suggestion.ticker}-${suggestion.cik}`}
              role="option"
              aria-selected={index === activeIndex}
              className={`ticker-suggestion ${index === activeIndex ? "active" : ""}`}
              onPointerDown={(event) => {
                event.preventDefault();
                selectSuggestion(suggestion);
              }}
              onPointerEnter={() => setActiveIndex(index)}
            >
              <span className="ticker-suggestion-ticker">
                {highlightMatch(suggestion.ticker, value)}
              </span>
              <span className="ticker-suggestion-name">
                {highlightMatch(suggestion.name, value)}
              </span>
            </li>
          ))}
        </ul>
      ) : open && status === "empty" ? (
        <div id={listboxId} className="ticker-suggestions ticker-suggestions-empty">
          No matches — enter the full ticker or company name
        </div>
      ) : null}
    </div>
  );
}

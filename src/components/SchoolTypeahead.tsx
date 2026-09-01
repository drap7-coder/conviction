"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { SchoolSuggestion } from "@/lib/groups/ncaa-catalog";

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

export function SchoolTypeahead({
  value,
  onChange,
  onSelect,
  onClearSelection,
  placeholder = "Search your school…",
  disabled = false,
  selectedInstitutionId,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (suggestion: SchoolSuggestion) => void;
  onClearSelection?: () => void;
  placeholder?: string;
  disabled?: boolean;
  selectedInstitutionId?: string | null;
}) {
  const listboxId = useId();
  const [suggestions, setSuggestions] = useState<SchoolSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [status, setStatus] = useState<"idle" | "results" | "empty">("idle");
  const cacheRef = useRef<Map<string, SchoolSuggestion[]>>(new Map());
  const pickedRef = useRef<string | null>(null);

  useEffect(() => {
    const query = value.trim();
    const picked = pickedRef.current;
    if (picked) {
      pickedRef.current = null;
      if (query === picked) return;
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
          `/api/schools/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (!response.ok) return;
        const data = (await response.json()) as { suggestions?: SchoolSuggestion[] };
        const next = data.suggestions ?? [];
        cacheRef.current.set(cacheKey, next);
        setSuggestions(next);
        setStatus(next.length > 0 ? "results" : "empty");
        setOpen(true);
        setActiveIndex(-1);
      } catch {
        // Best-effort suggestions.
      }
    }, 150);

    return () => {
      window.clearTimeout(debounce);
      controller.abort();
    };
  }, [value]);

  function selectSuggestion(suggestion: SchoolSuggestion) {
    pickedRef.current = suggestion.name;
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
      }
    }
  }

  const activeOptionId = activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined;

  return (
    <div className="school-typeahead">
      <input
        type="search"
        value={value}
        onChange={(event) => {
          if (selectedInstitutionId && onClearSelection) onClearSelection();
          onChange(event.target.value);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (suggestions.length > 0 || status === "empty") setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        disabled={disabled}
        className="school-typeahead-input"
        role="combobox"
        aria-label={placeholder}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={activeOptionId}
        autoComplete="off"
      />
      {open && status === "results" && suggestions.length > 0 ? (
        <ul id={listboxId} className="ticker-suggestions school-suggestions" role="listbox">
          {suggestions.map((suggestion, index) => (
            <li
              id={`${listboxId}-${index}`}
              key={suggestion.ncaaId}
              role="option"
              aria-selected={index === activeIndex}
              className={`ticker-suggestion school-suggestion${index === activeIndex ? " active" : ""}`}
              onPointerDown={(event) => {
                event.preventDefault();
                selectSuggestion(suggestion);
              }}
              onPointerEnter={() => setActiveIndex(index)}
            >
              <span className="ticker-suggestion-name">
                {highlightMatch(suggestion.name, value)}
              </span>
              <span className="school-suggestion-badge">Join</span>
            </li>
          ))}
        </ul>
      ) : open && status === "empty" ? (
        <div id={listboxId} className="ticker-suggestions ticker-suggestions-empty">
          No NCAA school match — try the full name
        </div>
      ) : null}
    </div>
  );
}

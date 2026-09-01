"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { CompanySuggestion } from "@/lib/sec/company-tickers";

export function GlobalSearchPill() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const cacheRef = useRef<Map<string, CompanySuggestion[]>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (deferredQuery.length < 1) {
      abortRef.current?.abort();
      startTransition(() => {
        setSuggestions([]);
        setShowSuggestions(false);
        setActiveSuggestion(-1);
      });
      return;
    }

    const cacheKey = deferredQuery.toLowerCase();
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      startTransition(() => {
        setSuggestions(cached);
        setShowSuggestions(cached.length > 0);
        setActiveSuggestion(-1);
      });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const debounce = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/companies/search?q=${encodeURIComponent(deferredQuery)}&limit=8`,
            { signal: controller.signal },
          );
          if (!res.ok) return;
          const data = (await res.json()) as { suggestions?: CompanySuggestion[] };
          if (controller.signal.aborted) return;
          const next = data.suggestions ?? [];
          cacheRef.current.set(cacheKey, next);
          startTransition(() => {
            setSuggestions(next);
            setShowSuggestions(next.length > 0);
            setActiveSuggestion(-1);
          });
        } catch {
          // Typeahead is best-effort.
        }
      })();
    }, 180);

    return () => {
      window.clearTimeout(debounce);
      controller.abort();
    };
  }, [deferredQuery]);

  function goToTicker(ticker: string) {
    const cleaned = ticker.trim().toUpperCase();
    if (!cleaned) return;
    startTransition(() => {
      setQuery("");
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveSuggestion(-1);
    });
    inputRef.current?.blur();
    router.push(`/companies/${encodeURIComponent(cleaned)}`);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
      goToTicker(suggestions[activeSuggestion].ticker);
      return;
    }
    const match = suggestions.find(
      (item) => item.ticker.toUpperCase() === query.trim().toUpperCase(),
    );
    goToTicker(match?.ticker ?? query);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      startTransition(() => {
        setActiveSuggestion((index) => (index + 1) % suggestions.length);
      });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      startTransition(() => {
        setActiveSuggestion((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
      });
    } else if (event.key === "Escape") {
      startTransition(() => {
        setShowSuggestions(false);
        setActiveSuggestion(-1);
      });
    }
  }

  return (
    <div className="global-search-dock">
      <form className="global-search-pill" onSubmit={handleSubmit} role="search">
        <Search size={15} aria-hidden="true" className="global-search-icon" strokeWidth={2.4} />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            const next = event.target.value;
            startTransition(() => setQuery(next));
          }}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true);
          }}
          onBlur={() => {
            window.setTimeout(() => setShowSuggestions(false), 120);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ticker"
          className="global-search-input"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          aria-label="Look up any ticker or company"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls="global-search-suggestions"
          role="combobox"
        />
        <span className="global-search-hint" aria-hidden="true">
          Quote
        </span>
        {showSuggestions && suggestions.length > 0 ? (
          <ul id="global-search-suggestions" className="global-search-suggestions" role="listbox">
            {suggestions.map((suggestion, index) => (
              <li
                key={`${suggestion.ticker}-${suggestion.cik || "y"}`}
                role="option"
                aria-selected={index === activeSuggestion}
              >
                <button
                  type="button"
                  className={`global-search-suggestion${index === activeSuggestion ? " active" : ""}`}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => goToTicker(suggestion.ticker)}
                >
                  <strong>{suggestion.ticker}</strong>
                  <span>{suggestion.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>
    </div>
  );
}

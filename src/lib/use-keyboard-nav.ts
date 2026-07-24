import { useCallback, useEffect, useRef, useState } from "react";

export interface KeyboardNavConfig {
  itemCount: number;
  onEnter: (index: number) => void;
  onEscape?: () => void;
  onSearch?: () => void;
  onNavigate?: (route: string) => void;
}

export function useKeyboardNav(config: KeyboardNavConfig) {
  const { itemCount, onEnter, onEscape, onSearch, onNavigate } = config;

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // G-key chord buffer
  const gBufferRef = useRef<{ key: string; timer: ReturnType<typeof setTimeout> | null }>({
    key: "",
    timer: null,
  });

  const clearGBuffer = useCallback(() => {
    if (gBufferRef.current.timer !== null) {
      clearTimeout(gBufferRef.current.timer);
      gBufferRef.current.timer = null;
    }
    gBufferRef.current.key = "";
  }, []);

  const startGBuffer = useCallback(
    (next: string) => {
      clearGBuffer();
      gBufferRef.current.key = "G";
      gBufferRef.current.timer = setTimeout(() => {
        gBufferRef.current.key = "";
        gBufferRef.current.timer = null;
      }, 500);
    },
    [clearGBuffer]
  );

  const resetSelection = useCallback(() => {
    setSelectedIndex(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Ignore when user is typing in an input / textarea / contenteditable
      const target = e.target as HTMLElement;
      if (
        target.isContentEditable ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA"
      ) {
        return;
      }

      const key = e.key;

      // G-key chord handling
      if (gBufferRef.current.key === "G") {
        clearGBuffer();

        let route: string | undefined;
        if (key === "w" || key === "W") route = "watchlist";
        else if (key === "t" || key === "T") route = "trending";
        else if (key === "p" || key === "P") route = "portfolio";
        else if (key === "m" || key === "M") route = "market-pulse";

        if (route) {
          e.preventDefault();
          onNavigate?.(route);
          return;
        }
        // If we got a G and then something else, just reset and don't handle further
        return;
      }

      if (key === "g" || key === "G") {
        startGBuffer(key);
        return;
      }

      switch (key) {
        case "/": {
          e.preventDefault();
          onSearch?.();
          break;
        }
        case "j":
        case "J": {
          e.preventDefault();
          setSelectedIndex((prev) => {
            if (prev === null) return 0;
            return (prev + 1) % itemCount;
          });
          break;
        }
        case "k":
        case "K": {
          e.preventDefault();
          setSelectedIndex((prev) => {
            if (prev === null || prev <= 0) return itemCount - 1;
            return prev - 1;
          });
          break;
        }
        case "Enter": {
          if (selectedIndex !== null) {
            e.preventDefault();
            onEnter(selectedIndex);
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          onEscape?.();
          resetSelection();
          break;
        }
      }
    },
    [itemCount, onEnter, onEscape, onSearch, onNavigate, selectedIndex, startGBuffer, clearGBuffer, resetSelection]
  );

  // Cleanup the G-buffer timer on unmount
  useEffect(() => {
    return () => {
      if (gBufferRef.current.timer !== null) {
        clearTimeout(gBufferRef.current.timer);
      }
    };
  }, []);

  return { selectedIndex, handleKeyDown, resetSelection };
}
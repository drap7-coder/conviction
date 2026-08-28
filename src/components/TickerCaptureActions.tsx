"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import {
  resolveCaptureText,
  type CaptureSuggestion,
} from "@/lib/ticker-capture-resolve";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Inline mic control for Manage ticker fields (desktop + mobile). */
export function TickerCaptureActions({
  disabled = false,
  onResolved,
  onQuery,
  onStatus,
}: {
  disabled?: boolean;
  onResolved: (suggestion: CaptureSuggestion) => void;
  onQuery?: (query: string) => void;
  onStatus?: (message: string | null) => void;
}) {
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(Boolean(getSpeechRecognition()));
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  function setStatus(message: string | null) {
    onStatus?.(message);
  }

  async function handleResolvedText(text: string) {
    setBusy(true);
    setStatus("Matching…");
    try {
      const result = await resolveCaptureText(text);
      if (result.suggestion) {
        setStatus(null);
        onResolved(result.suggestion);
        return;
      }
      if (result.query) onQuery?.(result.query);
      setStatus(result.status || "Couldn’t match that — type the ticker.");
    } catch {
      setStatus("Voice capture failed.");
    } finally {
      setBusy(false);
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function startListening() {
    const Ctor = getSpeechRecognition();
    if (!Ctor || disabled || busy) return;
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? "";
      setListening(false);
      if (!transcript) {
        setStatus("Nothing heard — try again.");
        return;
      }
      void handleResolvedText(transcript);
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error === "not-allowed") {
        setStatus("Microphone permission blocked.");
      } else if (event.error !== "aborted") {
        setStatus("Voice capture failed — try typing.");
      }
    };
    recognition.onend = () => {
      setListening(false);
    };
    recognitionRef.current = recognition;
    setStatus("Listening… say a ticker or company");
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
      setStatus("Voice isn’t available here.");
    }
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      className={`ticker-mic${listening ? " is-live" : ""}`}
      disabled={disabled || busy}
      aria-pressed={listening}
      aria-label={listening ? "Stop listening" : "Add by voice"}
      title={listening ? "Stop" : "Voice"}
      onClick={() => (listening ? stopListening() : startListening())}
    >
      {listening ? <Square size={15} aria-hidden /> : <Mic size={15} aria-hidden />}
    </button>
  );
}

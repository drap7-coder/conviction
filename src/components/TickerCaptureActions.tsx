"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Mic, Square } from "lucide-react";
import {
  recognizeImageText,
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

export function TickerCaptureActions({
  disabled = false,
  onResolved,
  onQuery,
  onStatus,
}: {
  disabled?: boolean;
  /** Fired when voice/camera resolves to a company. */
  onResolved: (suggestion: CaptureSuggestion) => void;
  /** Fill the typeahead when resolution is ambiguous. */
  onQuery?: (query: string) => void;
  onStatus?: (message: string | null) => void;
}) {
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [supported, setSupported] = useState({ voice: false, camera: true });
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSupported({
      voice: Boolean(getSpeechRecognition()),
      camera: typeof window !== "undefined" && typeof FileReader !== "undefined",
    });
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  function setStatus(message: string | null) {
    onStatus?.(message);
  }

  async function handleResolvedText(text: string, source: "voice" | "camera") {
    setBusy(true);
    setStatus(source === "voice" ? "Matching…" : "Reading ticker…");
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
      setStatus(source === "camera" ? "Couldn’t read that photo." : "Voice capture failed.");
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
      void handleResolvedText(transcript, "voice");
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

  async function onPhotoSelected(file: File | null) {
    if (!file || disabled || busy) return;
    setBusy(true);
    setStatus("Reading photo…");
    try {
      const text = await recognizeImageText(file);
      if (!text.trim()) {
        setStatus("No text found — try a clearer shot of the ticker.");
        return;
      }
      await handleResolvedText(text, "camera");
    } catch {
      setStatus("Couldn’t read that photo.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported.voice && !supported.camera) return null;

  return (
    <div className="ticker-capture" role="group" aria-label="Add by voice or camera">
      <span className="ticker-capture-label">Or add with</span>
      <div className="ticker-capture-actions">
        {supported.voice ? (
          <button
            type="button"
            className={`ticker-capture-btn${listening ? " is-live" : ""}`}
            disabled={disabled || busy}
            aria-pressed={listening}
            aria-label={listening ? "Stop listening" : "Add by voice"}
            title={listening ? "Stop" : "Voice"}
            onClick={() => (listening ? stopListening() : startListening())}
          >
            {listening ? <Square size={15} aria-hidden /> : <Mic size={15} aria-hidden />}
            <span>{listening ? "Listening…" : "Voice"}</span>
          </button>
        ) : null}
        {supported.camera ? (
          <>
            <button
              type="button"
              className="ticker-capture-btn ticker-capture-camera"
              disabled={disabled || busy}
              aria-label="Add from camera"
              title="Camera"
              onClick={() => fileRef.current?.click()}
            >
              <Camera size={15} aria-hidden />
              <span>Camera</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="ticker-capture-file"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = "";
                void onPhotoSelected(file);
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

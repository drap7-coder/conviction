export type EvidenceStatus = "idle" | "loading" | "success" | "empty" | "unsupported" | "timeout" | "error";

export class ClientRequestTimeoutError extends Error {
  constructor() {
    super("Request timed out");
    this.name = "ClientRequestTimeoutError";
  }
}

export async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromParent = () => controller.abort();
  signal?.addEventListener("abort", abortFromParent, { once: true });

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const error = new Error(`Request failed: ${response.status}`);
      error.name = response.status === 404 ? "UnsupportedEvidenceError" : "EvidenceRequestError";
      throw error;
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      if (signal?.aborted) throw error;
      throw new ClientRequestTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromParent);
  }
}

export function classifyClientError(error: unknown): EvidenceStatus {
  if (error instanceof ClientRequestTimeoutError) return "timeout";
  if (error instanceof Error && error.name === "UnsupportedEvidenceError") return "unsupported";
  if (error instanceof DOMException && error.name === "AbortError") return "idle";
  return "error";
}

import { describe, expect, it, vi } from "vitest";
import { fetchWithTimeout, RequestTimeoutError, withTimeout } from "@/lib/request-timeout";

describe("request timeout utilities", () => {
  it("settles slow operations with a controlled timeout error", async () => {
    await expect(withTimeout(new Promise(() => undefined), 5)).rejects.toBeInstanceOf(RequestTimeoutError);
  });

  it("clears timeout timers after a successful operation", async () => {
    const clearSpy = vi.spyOn(global, "clearTimeout");

    await expect(withTimeout(Promise.resolve("ok"), 500)).resolves.toBe("ok");

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it("turns aborted fetches into timeout errors", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async (_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    })) as typeof fetch;

    await expect(fetchWithTimeout("https://example.test", {}, 5)).rejects.toBeInstanceOf(RequestTimeoutError);
    global.fetch = originalFetch;
  });
});

const DRAFT_LANGUAGE = /^(analysis:|the user (?:is asking|asks|wants)|let me|i need to|we need to|current portfolio:|pros of|cons of|my role is)/i;

/** Accept only a final answer; never expose a model's scratchpad or drafting notes. */
export function cleanCopilotAnswer(raw: string): string | null {
  const tagged = raw.match(/<answer>\s*([\s\S]*?)\s*<\/answer>/i);
  const candidate = (tagged?.[1] ?? raw).trim();
  if (!candidate || (!tagged && DRAFT_LANGUAGE.test(candidate))) return null;
  if (/\b(?:let me craft|i will now craft)\s*$/i.test(candidate)) return null;
  const paragraphs = candidate.replace(/<\/?answer>/gi, "").split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  // The copilot is intentionally concise. A hard boundary also prevents some
  // models from appending a second draft after an already complete response.
  return paragraphs.slice(0, 3).join("\n\n").trim() || null;
}

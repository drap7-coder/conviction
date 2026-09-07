const DRAFT_LANGUAGE = /^(analysis:|the user (?:is asking|asks|wants)|let me|i need to|we need to|current portfolio:|pros of|cons of|my role is)/i;

/** Accept only a final answer; never expose a model's scratchpad or drafting notes. */
export function cleanCopilotAnswer(raw: string): string | null {
  const tagged = raw.match(/<answer>\s*([\s\S]*?)\s*<\/answer>/i);
  const candidate = (tagged?.[1] ?? raw).trim();
  if (!candidate || (!tagged && DRAFT_LANGUAGE.test(candidate))) return null;
  if (/\b(?:let me craft|i will now craft)\s*$/i.test(candidate)) return null;
  return candidate.replace(/<\/?answer>/gi, "").trim() || null;
}

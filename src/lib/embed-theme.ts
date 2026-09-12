export const EMBED_SURFACES = ["dark", "cream"] as const;
export const EMBED_ACCENTS = [
  "green",
  "blue",
  "violet",
  "pink",
  "mono",
] as const;

export type EmbedSurface = (typeof EMBED_SURFACES)[number];
export type EmbedAccent = (typeof EMBED_ACCENTS)[number];

export function parseEmbedSurface(
  value: string | string[] | undefined,
): EmbedSurface {
  return value === "cream" ? "cream" : "dark";
}

export function parseEmbedAccent(
  value: string | string[] | undefined,
): EmbedAccent {
  return EMBED_ACCENTS.includes(value as EmbedAccent)
    ? (value as EmbedAccent)
    : "green";
}

import type { SourcePart } from "./types";

export const MAX_SOURCE_CHARS = 20_000;

/** Source parts in order, cut at the shared character cap so a long comment thread stays bounded. */
export function capParts(raw: SourcePart[], limit = MAX_SOURCE_CHARS): { parts: SourcePart[]; truncated: boolean } {
  let left = limit;
  let truncated = false;
  const parts: SourcePart[] = [];
  for (const p of raw) {
    if (left <= 0) {
      truncated = true;
      break;
    }
    if (p.text.length > left) truncated = true;
    parts.push({ ...p, text: p.text.slice(0, left) });
    left -= p.text.length;
  }
  return { parts, truncated };
}

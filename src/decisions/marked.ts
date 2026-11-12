import type { Decision } from "../rules/types";
import type { SourcePart } from "./types";
import { MAX_QUOTE, normalise } from "./validate";

export type MarkedDecision = { from: string; text: string };
export type MarkedState = { notInLedger: MarkedDecision[]; truncated: boolean; pagesText: string };

/**
 * Marked decisions that no confirmed decision was made from. A decision counts as recorded when the words
 * it was confirmed from overlap the marked text in the same place; superseded ones still count, because
 * they are in the ledger. Decisions confirmed before evidence was kept do not match and are listed again,
 * which is the safe direction: a person may be asked about the same decision twice, never told it is
 * recorded when it is not.
 */
export function unrecordedMarked(parts: SourcePart[], decisions: Decision[]): MarkedDecision[] {
  const out: MarkedDecision[] = [];
  for (const part of parts) {
    for (const text of part.marked ?? []) {
      const marked = normalise(text);
      const recorded = decisions.some((d) => {
        if (d.evidence === undefined || d.evidence.from !== part.from) return false;
        const quote = normalise(d.evidence.quote);
        return quote.length > 0 && (marked.includes(quote) || quote.includes(marked));
      });
      if (!recorded) out.push({ from: part.from, text: text.slice(0, MAX_QUOTE) });
    }
  }
  return out;
}

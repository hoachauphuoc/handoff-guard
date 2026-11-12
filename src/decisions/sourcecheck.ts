import type { Decision } from "../rules/types";

export type PageVersion = { ok: true; title: string; version: number } | { ok: false };

/** Advisory: facts about a decision's source page. Never a finding, never an input to the rule check. */
export type SourceNote = { kind: "changed" | "unreadable"; message: string; decisionIds: string[] };

export type SourceChecks = { notes: SourceNote[]; notChecked: number };

export const MAX_CHECKED_PAGES = 5;

const PAGE = "Confluence page ";
const live = (decisions: Decision[]) =>
  decisions.filter((d) => d.status === "decided" && d.evidence?.pageId !== undefined && d.evidence.version !== undefined);

/** The distinct pages to read, at most MAX_CHECKED_PAGES, so the number of Confluence calls stays bounded. */
export function pagesToCheck(decisions: Decision[]): string[] {
  return [...new Set(live(decisions).map((d) => d.evidence!.pageId!))].slice(0, MAX_CHECKED_PAGES);
}

/**
 * Compares the page version stored when each decision was confirmed with the version read now. A page that
 * could not be read is named, never skipped silently; pages beyond the cap are counted in `notChecked`.
 * Decisions confirmed from Jira text, or before versions were kept, have nothing to compare and are left out.
 */
export function sourceNotes(decisions: Decision[], reads: Record<string, PageVersion>): SourceChecks {
  const notes: SourceNote[] = [];
  let notChecked = 0;
  for (const d of live(decisions)) {
    const e = d.evidence!;
    const read = reads[e.pageId!];
    const name = e.from.startsWith(PAGE) ? e.from.slice(PAGE.length) : e.from;
    if (read === undefined) {
      notChecked++;
    } else if (!read.ok) {
      notes.push({ kind: "unreadable", message: `The Confluence page "${name}" behind "${d.title}" could not be read as you now, so changes to it were not checked.`, decisionIds: [d.id] });
    } else if (read.version !== e.version) {
      notes.push({
        kind: "changed",
        message: `The Confluence page "${read.title}" changed since "${d.title}" was confirmed (version ${e.version} then, version ${read.version} now). The decision still applies until a person supersedes it.`,
        decisionIds: [d.id],
      });
    }
  }
  return { notes, notChecked };
}

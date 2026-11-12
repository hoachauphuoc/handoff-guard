import { adfToText, markedDecisions } from "../adf";
import type { SourcePart } from "./types";

export type JiraComment = { id?: string; body?: unknown; visibility?: unknown };

/**
 * The text a decision may be quoted from: the description, then the comments in the order given. A comment
 * restricted to a group or role is skipped: its text would otherwise be saved into app storage, where
 * people outside that group can read it through a proposal. Bodies are Jira documents (REST v3).
 */
export function buildParts(key: string, description: unknown, comments: JiraComment[]): SourcePart[] {
  const out: SourcePart[] = [];
  const add = (from: string, body: unknown): void => {
    const text = adfToText(body);
    if (text.trim() === "") return;
    const marked = markedDecisions(body);
    out.push(marked.length > 0 ? { from, text, marked } : { from, text });
  };
  add(`${key} description`, description);
  for (const c of comments) {
    if (c.visibility || c.id === undefined) continue;
    add(`${key} comment ${c.id}`, c.body);
  }
  return out;
}

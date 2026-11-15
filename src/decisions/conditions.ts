import type { Decision, WorkItem } from "../rules/types";

// Each condition costs one Jira search per read, so a project gets a few; the rest read as not checked.
export const CONDITION_CAP = 5;
export const CONDITION_MAX_LENGTH = 300;

/** The distinct JQL texts of the decisions in force, in the order they were stored. */
export function conditionJqls(decisions: Decision[]): string[] {
  const all = decisions.filter((d) => d.status === "decided").flatMap((d) => d.constraints.flatMap((c) => (c.kind === "condition" ? [c.jql] : [])));
  return [...new Set(all)];
}

type ParseBody = { queries?: { query?: string; errors?: string[]; structure?: { orderBy?: unknown } }[] };

/**
 * Which JQL texts Jira can run as a yes or no about a work item: parsed without errors and with no ORDER BY.
 * A query Jira did not answer for is not valid, so it is never evaluated on a guess.
 */
export function validJqls(jqls: string[], body: ParseBody): Set<string> {
  const ok = new Set<string>();
  jqls.forEach((jql, i) => {
    const q = body.queries?.[i];
    if (q && (q.errors ?? []).length === 0 && q.structure?.orderBy === undefined) ok.add(jql);
  });
  return ok;
}

/** The parse errors Jira gave for one query, word for word; empty when it parsed. */
export function parseErrors(body: ParseBody): string[] {
  const q = body.queries?.[0];
  if (!q) return ["Jira did not answer for this filter."];
  if ((q.errors ?? []).length > 0) return q.errors ?? [];
  return q.structure?.orderBy === undefined ? [] : ["A filter here cannot sort: remove ORDER BY."];
}

const KEY = /^[A-Za-z][A-Za-z0-9_]*-\d+$/;

/** One search for all the given work items: those it returns match the condition. */
export function keyListJql(keys: string[], jql: string): string {
  const safe = keys.filter((k) => KEY.test(k));
  return `key in (${safe.map((k) => `"${k}"`).join(", ")}) AND (${jql})`;
}

/**
 * The answer per work item and JQL text. `matched` holds, per JQL, the keys Jira returned, or null when the
 * search failed or was not run: then the answer is null, which the rules report as not checked.
 */
export function conditionsOf(keys: string[], jqls: string[], matched: Map<string, Set<string> | null>): Map<string, Record<string, boolean | null>> {
  return new Map(
    keys.map((k) => [
      k,
      Object.fromEntries(
        jqls.map((jql) => {
          const set = matched.get(jql);
          return [jql, set ? set.has(k) : null];
        }),
      ),
    ]),
  );
}

// Merged, so asking about a new filter keeps the answers already read for the conditions in force.
export function withAnswers<T extends { item: WorkItem }>(rows: T[], answers: Map<string, Record<string, boolean | null>>): T[] {
  return rows.map((r) => {
    const conditions = answers.get(r.item.key);
    return conditions && Object.keys(conditions).length > 0 ? { ...r, item: { ...r.item, conditions: { ...r.item.conditions, ...conditions } } } : r;
  });
}

/**
 * A condition Rovo drafted for a project administrator. It binds nothing: only a person confirming it on the
 * Decisions page makes it a decision, through the same checks as the form.
 */
export type ConditionDraft = { id: string; title: string; jql: string; supersedes: string | null; by: string; at: string };
export const MAX_CONDITION_DRAFTS = 10;
export const TALLY_KEYS = 10;

export type Tally = { matching: number; notMatching: number; unanswered: number; notMatchingKeys: string[] };

/** How the given work items answer one filter. An item Jira gave no answer for is counted apart, never as a match. */
export function tally(items: WorkItem[], jql: string): Tally {
  const answer = (i: WorkItem) => i.conditions?.[jql];
  const not = items.filter((i) => answer(i) === false);
  return {
    matching: items.filter((i) => answer(i) === true).length,
    notMatching: not.length,
    unanswered: items.filter((i) => typeof answer(i) !== "boolean").length,
    notMatchingKeys: not.slice(0, TALLY_KEYS).map((i) => i.key),
  };
}

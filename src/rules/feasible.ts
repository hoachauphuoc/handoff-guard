import { bindingDecisions, has, isIsoDate, norm } from "./checkHandoff";
import type { Decision, WorkItem } from "./types";

export type FeasibleSpace = {
  /** The earliest valid dueNotAfter date among the binding decisions. */
  latestDueDate: string | null;
  requiredLabels: string[];
  forbiddenComponents: string[];
  /** Limits that are not real dates: reported, never acted on. */
  invalidConstraints: { decisionId: string; title: string; constraint: string }[];
};

export type Change =
  | { field: "dueDate"; from: string | null; to: string; because: string[] }
  | { field: "labels"; add: string; because: string[] }
  | { field: "components"; remove: string; because: string[] };

export type Fixes = { space: FeasibleSpace; changes: Change[]; after: WorkItem };

// Keeps the first spelling of each value, comparing the way the rules do.
function dedupe(values: string[]): string[] {
  const out: string[] = [];
  for (const v of values) if (!has(out, v)) out.push(v);
  return out;
}

/** What the binding decisions allow. Pure bookkeeping: it names no verdict and no finding. */
export function feasibleSpace(binding: Decision[]): FeasibleSpace {
  let latest: string | null = null;
  const labels: string[] = [];
  const components: string[] = [];
  const invalid: FeasibleSpace["invalidConstraints"] = [];
  for (const d of binding) {
    for (const c of d.constraints) {
      if (c.kind === "dueNotAfter") {
        if (!isIsoDate(c.date)) invalid.push({ decisionId: d.id, title: d.title, constraint: c.date });
        else if (latest === null || c.date < latest) latest = c.date;
      } else if (c.kind === "labelRequired") labels.push(c.label);
      else components.push(c.component);
    }
  }
  return { latestDueDate: latest, requiredLabels: dedupe(labels), forbiddenComponents: dedupe(components), invalidConstraints: invalid };
}

const titlesWhere = (binding: Decision[], keep: (c: Decision["constraints"][number]) => boolean): string[] => [
  ...new Set(binding.filter((d) => d.constraints.some(keep)).map((d) => d.title)),
];

/**
 * The smallest edits that stop the item contradicting its binding decisions. Only a due date taken from a
 * decision, labels that are added and components that are removed; nothing else is touched. Adding a label
 * can bind a label-scoped decision, so it repeats until nothing new turns up (bounded: each pass needs a
 * new label, and there are at most as many as decisions). Inputs are confirmed decisions, never proposals.
 */
export function suggestFixes(item: WorkItem, decisions: Decision[]): Fixes {
  let cur = item;
  let due: Extract<Change, { field: "dueDate" }> | null = null;
  const labels: Extract<Change, { field: "labels" }>[] = [];
  const components: Extract<Change, { field: "components" }>[] = [];

  for (let pass = 0; pass < decisions.length + 1; pass++) {
    const binding = bindingDecisions(decisions, cur);
    const space = feasibleSpace(binding);
    let moved = false;

    const limit = space.latestDueDate;
    // A malformed due date cannot be compared, so it is replaced like a missing one.
    if (limit !== null && (cur.dueDate === null || !isIsoDate(cur.dueDate) || cur.dueDate > limit)) {
      // A later pass may find an earlier limit; the change keeps the original `from` and the newest `to`.
      const because = titlesWhere(binding, (c) => c.kind === "dueNotAfter" && c.date === limit);
      due = { field: "dueDate", from: due ? due.from : cur.dueDate, to: limit, because };
      cur = { ...cur, dueDate: limit };
      moved = true;
    }
    for (const label of space.requiredLabels) {
      if (has(cur.labels, label)) continue;
      labels.push({ field: "labels", add: label, because: titlesWhere(binding, (c) => c.kind === "labelRequired" && norm(c.label) === norm(label)) });
      cur = { ...cur, labels: [...cur.labels, label] };
      moved = true;
    }
    for (const forbidden of space.forbiddenComponents) {
      const own = cur.components.find((x) => norm(x) === norm(forbidden));
      if (own === undefined) continue;
      components.push({ field: "components", remove: own, because: titlesWhere(binding, (c) => c.kind === "componentForbidden" && norm(c.component) === norm(forbidden)) });
      cur = { ...cur, components: cur.components.filter((x) => norm(x) !== norm(forbidden)) };
      moved = true;
    }
    if (!moved) break;
  }
  return { space: feasibleSpace(bindingDecisions(decisions, cur)), changes: [...(due ? [due] : []), ...labels, ...components], after: cur };
}

const because = (c: Change): string => ` (${c.because.map((t) => `"${t}"`).join(", ")})`;

/** One change in plain words; the Rovo quote and the panel use this same text. */
export function changeText(c: Change): string {
  switch (c.field) {
    case "dueDate":
      return `Set the due date on or before ${c.to}${because(c)}`;
    case "labels":
      return `Add label "${c.add}"${because(c)}`;
    case "components":
      return `Remove component "${c.remove}"${because(c)}`;
  }
}

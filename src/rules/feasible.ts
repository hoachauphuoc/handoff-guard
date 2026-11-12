import { bindingDecisions, has, isIsoDate, norm } from "./checkHandoff";
import type { Decision, WorkItem } from "./types";

export type FeasibleSpace = {
  /** The earliest valid dueNotAfter date among the binding decisions. */
  latestDueDate: string | null;
  requiredLabels: string[];
  forbiddenLabels: string[];
  requiredComponents: string[];
  forbiddenComponents: string[];
  /** Limits that are not real dates: reported, never acted on. */
  invalidConstraints: { decisionId: string; title: string; constraint: string }[];
};

export type Change =
  | { field: "dueDate"; from: string | null; to: string; because: string[] }
  | { field: "labels"; add: string; because: string[] }
  | { field: "labels"; remove: string; because: string[] }
  | { field: "components"; add: string; because: string[] }
  | { field: "components"; remove: string; because: string[] };

/** A value one decision requires and another forbids: no edit satisfies both, so it is reported, never guessed at. */
export type Unresolved = { field: "labels" | "components"; value: string; requiredBy: string[]; forbiddenBy: string[] };

export type Fixes = { space: FeasibleSpace; changes: Change[]; unresolved: Unresolved[]; after: WorkItem };

type Kind = "labelRequired" | "labelForbidden" | "componentRequired" | "componentForbidden";
const valueOf = (c: Decision["constraints"][number]): string => ("label" in c ? c.label : "component" in c ? c.component : "");

// Keeps the first spelling of each value, comparing the way the rules do.
function dedupe(values: string[]): string[] {
  const out: string[] = [];
  for (const v of values) if (!has(out, v)) out.push(v);
  return out;
}

/** What the binding decisions allow. Pure bookkeeping: it names no verdict and no finding. */
export function feasibleSpace(binding: Decision[]): FeasibleSpace {
  let latest: string | null = null;
  const lists: Record<Kind, string[]> = { labelRequired: [], labelForbidden: [], componentRequired: [], componentForbidden: [] };
  const invalid: FeasibleSpace["invalidConstraints"] = [];
  for (const d of binding) {
    for (const c of d.constraints) {
      if (c.kind === "dueNotAfter") {
        if (!isIsoDate(c.date)) invalid.push({ decisionId: d.id, title: d.title, constraint: c.date });
        else if (latest === null || c.date < latest) latest = c.date;
      } else lists[c.kind].push(valueOf(c));
    }
  }
  return {
    latestDueDate: latest,
    requiredLabels: dedupe(lists.labelRequired),
    forbiddenLabels: dedupe(lists.labelForbidden),
    requiredComponents: dedupe(lists.componentRequired),
    forbiddenComponents: dedupe(lists.componentForbidden),
    invalidConstraints: invalid,
  };
}

const titlesWhere = (binding: Decision[], keep: (c: Decision["constraints"][number]) => boolean): string[] => [
  ...new Set(binding.filter((d) => d.constraints.some(keep)).map((d) => d.title)),
];
const titlesOf = (binding: Decision[], kind: Kind, value: string): string[] =>
  titlesWhere(binding, (c) => c.kind === kind && norm(valueOf(c)) === norm(value));

function clashes(binding: Decision[], space: FeasibleSpace): Unresolved[] {
  const out: Unresolved[] = [];
  for (const v of space.requiredLabels.filter((x) => has(space.forbiddenLabels, x))) {
    out.push({ field: "labels", value: v, requiredBy: titlesOf(binding, "labelRequired", v), forbiddenBy: titlesOf(binding, "labelForbidden", v) });
  }
  for (const v of space.requiredComponents.filter((x) => has(space.forbiddenComponents, x))) {
    out.push({ field: "components", value: v, requiredBy: titlesOf(binding, "componentRequired", v), forbiddenBy: titlesOf(binding, "componentForbidden", v) });
  }
  return out;
}

/**
 * The smallest edits that stop the item contradicting its binding decisions. Only a due date taken from a
 * decision, labels and components that are added or removed; nothing else is touched. Adding a label
 * can bind a label-scoped decision, so it repeats until nothing new turns up (bounded: each pass needs a
 * new label, and there are at most as many as decisions). A value that one decision requires and another
 * forbids is left alone and listed in `unresolved`: choosing between decisions is a person's call.
 * Inputs are confirmed decisions, never proposals.
 */
export function suggestFixes(item: WorkItem, decisions: Decision[]): Fixes {
  let cur = item;
  let due: Extract<Change, { field: "dueDate" }> | null = null;
  const changes: Change[] = [];
  let unresolved: Unresolved[] = [];

  for (let pass = 0; pass < decisions.length + 1; pass++) {
    const binding = bindingDecisions(decisions, cur);
    const space = feasibleSpace(binding);
    unresolved = clashes(binding, space);
    const clash = (field: Unresolved["field"], v: string): boolean => unresolved.some((u) => u.field === field && norm(u.value) === norm(v));
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
      if (has(cur.labels, label) || clash("labels", label)) continue;
      changes.push({ field: "labels", add: label, because: titlesOf(binding, "labelRequired", label) });
      cur = { ...cur, labels: [...cur.labels, label] };
      moved = true;
    }
    for (const forbidden of space.forbiddenLabels) {
      const own = cur.labels.find((x) => norm(x) === norm(forbidden));
      if (own === undefined || clash("labels", forbidden)) continue;
      changes.push({ field: "labels", remove: own, because: titlesOf(binding, "labelForbidden", forbidden) });
      cur = { ...cur, labels: cur.labels.filter((x) => norm(x) !== norm(forbidden)) };
      moved = true;
    }
    for (const component of space.requiredComponents) {
      if (has(cur.components, component) || clash("components", component)) continue;
      changes.push({ field: "components", add: component, because: titlesOf(binding, "componentRequired", component) });
      cur = { ...cur, components: [...cur.components, component] };
      moved = true;
    }
    for (const forbidden of space.forbiddenComponents) {
      const own = cur.components.find((x) => norm(x) === norm(forbidden));
      if (own === undefined || clash("components", forbidden)) continue;
      changes.push({ field: "components", remove: own, because: titlesOf(binding, "componentForbidden", forbidden) });
      cur = { ...cur, components: cur.components.filter((x) => norm(x) !== norm(forbidden)) };
      moved = true;
    }
    if (!moved) break;
  }

  // A label added early can itself be a scope that brings in a decision forbidding it. Take that edit back
  // rather than advise something a binding decision contradicts.
  const final = bindingDecisions(decisions, cur);
  const forbidden = feasibleSpace(final).forbiddenLabels;
  const kept: Change[] = [];
  for (const c of changes) {
    if (c.field === "labels" && "add" in c && has(forbidden, c.add)) {
      cur = { ...cur, labels: cur.labels.filter((x) => norm(x) !== norm(c.add)) };
      unresolved.push({ field: "labels", value: c.add, requiredBy: c.because, forbiddenBy: titlesOf(final, "labelForbidden", c.add) });
    } else kept.push(c);
  }
  return { space: feasibleSpace(bindingDecisions(decisions, cur)), changes: [...(due ? [due] : []), ...kept], unresolved, after: cur };
}

const because = (c: Change): string => ` (${c.because.map((t) => `"${t}"`).join(", ")})`;

/** One change in plain words; the Rovo quote and the panel use this same text. */
export function changeText(c: Change): string {
  switch (c.field) {
    case "dueDate":
      return `Set the due date on or before ${c.to}${because(c)}`;
    case "labels":
      return "add" in c ? `Add label "${c.add}"${because(c)}` : `Remove label "${c.remove}"${because(c)}`;
    case "components":
      return "add" in c ? `Add component "${c.add}"${because(c)}` : `Remove component "${c.remove}"${because(c)}`;
  }
}

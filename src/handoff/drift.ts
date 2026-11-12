import { fnv1a } from "../decisions/hash";
import { norm } from "../rules/checkHandoff";
import type { Decision, WorkItem } from "../rules/types";

/**
 * What a work item looked like when the receiver acknowledged a decision. Due date, labels and components are
 * kept as values because the panel shows a before and after for them; summary and description are kept only
 * as a hash, so nothing beyond what the record already holds is stored and the panel can say "changed" only.
 */
export type Fingerprint = {
  dueDate: string | null;
  labels: string[];
  components: string[];
  summaryHash: string;
  descriptionHash: string;
};

export const fingerprintOf = (item: WorkItem): Fingerprint => ({
  dueDate: item.dueDate,
  labels: item.labels,
  components: item.components,
  summaryHash: fnv1a(item.summary),
  descriptionHash: fnv1a(item.description),
});

/** `values` are the labels or components added or removed, normalised, so a decision can ask whether its own was touched. */
export type Drift = { field: "dueDate" | "labels" | "components" | "summary" | "description"; text: string; values?: string[] };

const set = (xs: string[]): string[] => [...new Set(xs.map(norm))].sort();
const diff = (before: string[], after: string[]): { added: string[]; removed: string[] } => {
  const [b, a] = [set(before), set(after)];
  return { added: a.filter((x) => !b.includes(x)), removed: b.filter((x) => !a.includes(x)) };
};
const listChange = (field: "labels" | "components", before: string[], after: string[]): Drift | null => {
  const { added, removed } = diff(before, after);
  if (added.length === 0 && removed.length === 0) return null;
  const text = `${field}: ${[...added.map((x) => `added ${x}`), ...removed.map((x) => `removed ${x}`)].join(", ")}`;
  return { field, text, values: [...added, ...removed] };
};

/** What changed on the work item since the fingerprint was taken. Pure and without a clock. */
export function changesSince(fp: Fingerprint, item: WorkItem): Drift[] {
  const out: Drift[] = [];
  if (fp.dueDate !== item.dueDate) out.push({ field: "dueDate", text: `due ${fp.dueDate ?? "not set"} to ${item.dueDate ?? "not set"}` });
  const labels = listChange("labels", fp.labels, item.labels);
  if (labels) out.push(labels);
  const components = listChange("components", fp.components, item.components);
  if (components) out.push(components);
  if (fp.summaryHash !== fnv1a(item.summary)) out.push({ field: "summary", text: "summary changed" });
  if (fp.descriptionHash !== fnv1a(item.description)) out.push({ field: "description", text: "description changed" });
  return out;
}

/**
 * Whether a change touches what a decision reads. A due-date constraint reads the due date; a label or
 * component constraint reads only the value it names, and a label scope only its own label. An unrelated
 * label or component being added or removed does not touch it.
 */
export function touches(d: Decision, change: Drift): boolean {
  if (change.field === "dueDate") return d.constraints.some((c) => c.kind === "dueNotAfter");
  const named = new Set<string>();
  if (change.field === "labels" && d.scope.kind === "label") named.add(norm(d.scope.label));
  for (const c of d.constraints) {
    if (change.field === "labels" && (c.kind === "labelRequired" || c.kind === "labelForbidden")) named.add(norm(c.label));
    if (change.field === "components" && (c.kind === "componentRequired" || c.kind === "componentForbidden")) named.add(norm(c.component));
  }
  return (change.values ?? []).some((v) => named.has(v));
}

/**
 * Acknowledgements that no longer hold, with the reason in words. An acknowledgement goes stale for a
 * decision only when something that decision reads has changed since it was given (see `touches`); a changed summary or
 * description is shown to the receiver but is not an input to any rule, so it never changes the verdict.
 * An acknowledgement with no stored fingerprint (given before fingerprints were kept) is never stale: there
 * is no baseline to compare with, and nothing here claims it was checked.
 */
export function staleAcks(
  acknowledged: string[],
  withFingerprint: Record<string, Fingerprint> | undefined,
  item: WorkItem,
  binding: Decision[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of binding) {
    const fp = withFingerprint?.[d.id];
    if (!acknowledged.includes(d.id) || fp === undefined) continue;
    const changed = changesSince(fp, item).filter((c) => touches(d, c));
    if (changed.length > 0) out[d.id] = `${changed.map((c) => c.text).join("; ")} since then`;
  }
  return out;
}

/** Every change since each acknowledgement, for the panel: per decision, shown to the people involved. */
export function driftByDecision(acknowledged: string[], withFingerprint: Record<string, Fingerprint> | undefined, item: WorkItem): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const id of acknowledged) {
    const fp = withFingerprint?.[id];
    if (fp === undefined) continue;
    const changes = changesSince(fp, item).map((c) => c.text);
    if (changes.length > 0) out[id] = changes;
  }
  return out;
}

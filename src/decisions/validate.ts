import { isIsoDate } from "../rules/checkHandoff";
import type { Constraint, DecisionScope } from "../rules/types";
import { fnv1a } from "./hash";
import type { Proposal, SourcePart } from "./types";

export const MAX_CANDIDATES = 5;
export const MAX_TITLE = 120;
export const MIN_QUOTE = 12;
export const MAX_QUOTE = 300;

export type RejectReason =
  | "not_object"
  | "bad_title"
  | "bad_scope"
  | "bad_constraint"
  | "bad_date"
  | "no_evidence"
  | "evidence_not_in_source"
  | "over_cap";

export type Rejection = { index: number; reason: RejectReason };
export type Context = { issueKey: string; projectKey: string; labels: string[] };

// Chat and editors rewrite quotes and dashes and wrap lines; none of that changes what was written.
// Case and every other character still have to match, so a paraphrase cannot pass.
function normalise(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

function scopeOf(raw: unknown, ctx: Context): DecisionScope | null {
  if (!isObj(raw)) return null;
  // Canonical values come from the work item, so the stored scope matches exactly what it was checked against.
  if (raw.kind === "project") {
    const k = str(raw.projectKey);
    return k !== null && same(k, ctx.projectKey) ? { kind: "project", projectKey: ctx.projectKey } : null;
  }
  if (raw.kind === "workItem") {
    const k = str(raw.key);
    return k !== null && same(k, ctx.issueKey) ? { kind: "workItem", key: ctx.issueKey } : null;
  }
  if (raw.kind === "label") {
    const l = str(raw.label);
    const own = l === null ? undefined : ctx.labels.find((x) => same(x, l));
    return own === undefined ? null : { kind: "label", label: own };
  }
  return null;
}

function constraintsOf(raw: unknown): Constraint[] | "bad_constraint" | "bad_date" {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 3) return "bad_constraint";
  const out: Constraint[] = [];
  for (const c of raw) {
    if (!isObj(c)) return "bad_constraint";
    if (c.kind === "dueNotAfter") {
      const d = str(c.date);
      if (d === null || !isIsoDate(d)) return "bad_date";
      out.push({ kind: "dueNotAfter", date: d });
    } else if (c.kind === "labelRequired") {
      const l = str(c.label);
      if (l === null) return "bad_constraint";
      out.push({ kind: "labelRequired", label: l });
    } else if (c.kind === "componentForbidden") {
      const comp = str(c.component);
      if (comp === null) return "bad_constraint";
      out.push({ kind: "componentForbidden", component: comp });
    } else return "bad_constraint";
  }
  return out;
}

function check(raw: unknown, parts: SourcePart[], ctx: Context, nowIso: string): Proposal | RejectReason {
  if (!isObj(raw)) return "not_object";
  const title = str(raw.title);
  if (title === null || title.length > MAX_TITLE) return "bad_title";
  const scope = scopeOf(raw.scope, ctx);
  if (scope === null) return "bad_scope";
  const constraints = constraintsOf(raw.constraints);
  if (typeof constraints === "string") return constraints;
  const quote = isObj(raw.evidence) && typeof raw.evidence.quote === "string" ? raw.evidence.quote.trim() : "";
  const wanted = normalise(quote);
  if (wanted.length < MIN_QUOTE || wanted.length > MAX_QUOTE) return "no_evidence";
  const part = parts.find((p) => normalise(p.text).includes(wanted));
  if (!part) return "evidence_not_in_source";
  const id = "p-" + fnv1a([part.from, title, JSON.stringify(scope), JSON.stringify(constraints)].join("|"));
  return { id, title, scope, constraints, evidence: { quote, from: part.from }, proposedAt: nowIso };
}

/**
 * Keeps only candidates whose evidence appears word for word in the source. A repeat of an already kept
 * candidate (same id) is dropped without a rejection: it adds nothing and would only waste the cap.
 */
export function validateCandidates(
  raw: unknown,
  parts: SourcePart[],
  ctx: Context,
  nowIso: string,
): { kept: Proposal[]; rejected: Rejection[] } {
  const list = Array.isArray(raw) ? raw : isObj(raw) && Array.isArray(raw.candidates) ? raw.candidates : null;
  if (list === null) return { kept: [], rejected: [{ index: 0, reason: "not_object" }] };
  const kept: Proposal[] = [];
  const rejected: Rejection[] = [];
  list.forEach((c, index) => {
    const out = check(c, parts, ctx, nowIso);
    if (typeof out === "string") rejected.push({ index, reason: out });
    else if (kept.some((k) => k.id === out.id)) return;
    else if (kept.length >= MAX_CANDIDATES) rejected.push({ index, reason: "over_cap" });
    else kept.push(out);
  });
  return { kept, rejected };
}

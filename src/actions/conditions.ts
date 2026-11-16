import { CONDITION_MAX_LENGTH, conditionJqls, MAX_CONDITION_DRAFTS, tally, type ConditionDraft } from "../decisions/conditions";
import { fnv1a } from "../decisions/hash";
import { buildManualDecision } from "../decisions/manual";
import { projectOfKey, touches } from "../decisions/page";
import { relate } from "../decisions/supersede";
import { JiraReadError } from "../jira-error";
import { bindingDecisions } from "../rules/checkHandoff";
import type { Decision, WorkItem } from "../rules/types";
import { SCHEMA_VERSION, type ActionError, type CheckConditionOutput, type DraftConditionOutput, type ErrorCode } from "./schema";

// Rovo writes the filter and the sentences; this code asks Jira, counts and stores a draft. Nothing here
// makes a decision: a draft is confirmed by a person on the Decisions page, through the same checks as the form.
export type ConditionDeps = {
  getDecisions: (projectKey: string) => Promise<Decision[]>;
  isAdmin: (projectKey: string) => Promise<boolean>;
  jqlErrors: (jql: string) => Promise<string[]>;
  /** Open work items of the project, as the caller, with the answers to the conditions in force and to `jqls`. */
  openItems: (projectKey: string, jqls: string[]) => Promise<{ items: WorkItem[]; capped: boolean }>;
  getDrafts: (projectKey: string) => Promise<ConditionDraft[]>;
  putDrafts: (projectKey: string, drafts: ConditionDraft[]) => Promise<void>;
  now: () => string;
};

export const DRAFT_STORED = "Stored as a draft. It is not in force until a project administrator confirms it on the Decisions page.";
const PROJECT = /^[A-Z][A-Z0-9_]+$/;

type Fields = Record<string, unknown>;
const fieldsOf = (payload: unknown): Fields => (payload && typeof payload === "object" ? (payload as Fields) : {});
const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function projectOf(p: Fields): string | { message: string } {
  const ctxKey = (p.context as { jira?: { issueKey?: unknown } } | undefined)?.jira?.issueKey;
  const given = text(p.projectKey).toUpperCase();
  const raw = given !== "" ? given : typeof ctxKey === "string" && ctxKey.includes("-") ? projectOfKey(ctxKey.trim().toUpperCase()) : "";
  if (raw === "") return { message: "No project key was given and the chat was not opened from a work item. Ask which project." };
  return PROJECT.test(raw) ? raw : { message: `"${raw}" is not a project key. A project key is letters and digits, such as MOBL.` };
}

function refusal<S extends typeof SCHEMA_VERSION.checkCondition | typeof SCHEMA_VERSION.draftCondition>(
  schema: S,
  code: ErrorCode,
  message: string,
): ActionError<S> {
  return { schema, ok: false, source: "rules", issueKey: null, error: { code, message }, quote: `Handoff Guard did not do this: ${message}` };
}

function crash<S extends typeof SCHEMA_VERSION.checkCondition | typeof SCHEMA_VERSION.draftCondition>(schema: S, e: unknown): ActionError<S> {
  return e instanceof JiraReadError ? refusal(schema, e.code, e.message) : refusal(schema, "internal", "Handoff Guard hit an unexpected error.");
}

/**
 * The state of a project's conditions, and how a filter would fall if it were put in force. Facts only:
 * counts, keys and Jira's own error text. Whether the rule is a good idea is the administrator's call.
 */
export async function runCheckCondition(payload: unknown, deps: ConditionDeps): Promise<CheckConditionOutput> {
  const schema = SCHEMA_VERSION.checkCondition;
  const p = fieldsOf(payload);
  const projectKey = projectOf(p);
  if (typeof projectKey !== "string") return refusal(schema, "bad_input", projectKey.message);
  const jql = text(p.jql);
  // The same limit as saving, so a filter that passes here is not refused at the draft.
  if (jql.length > CONDITION_MAX_LENGTH) {
    return refusal(schema, "bad_input", `A filter for a rule can be at most ${CONDITION_MAX_LENGTH} characters; this one has ${jql.length}. Nothing was counted.`);
  }
  try {
    const decisions = (await deps.getDecisions(projectKey)).filter((d) => touches(d, projectKey));
    const errors = jql === "" ? [] : await deps.jqlErrors(jql);
    const asked = jql !== "" && errors.length === 0 ? [jql] : [];
    const open = await deps.openItems(projectKey, asked);
    const inForce = decisions
      .filter((d) => d.status === "decided")
      .flatMap((d) =>
        conditionJqls([d]).map((q) => ({
          decisionId: d.id,
          title: d.title,
          jql: q,
          ...tally(
            open.items.filter((i) => bindingDecisions([d], i).length > 0),
            q,
          ),
        })),
      );
    const same = asked.length > 0 ? relate(decisions, { kind: "project", projectKey }, [{ kind: "condition", jql }]) : null;
    const checked =
      jql === ""
        ? null
        : { jql, errors, counts: errors.length === 0 ? tally(open.items, jql) : null, alreadyInForce: same?.kind === "already_decided" ? (same.by[0]?.title ?? null) : null };
    const n = open.items.length;
    const scope = `${n} open work item${n === 1 ? "" : "s"} of ${projectKey}${open.capped ? " (the first 100 only)" : ""}`;
    const quote =
      checked === null
        ? `${inForce.length} condition${inForce.length === 1 ? "" : "s"} in force, counted over ${scope}.`
        : checked.counts === null
          ? `Jira cannot run this filter: ${errors.join(" ")}`
          : `Of ${scope}: ${checked.counts.matching} match ${jql}, ${checked.counts.notMatching} do not, ${checked.counts.unanswered} Jira did not answer for. Nothing was saved.`;
    return { schema, ok: true, source: "rules", projectKey, scanned: n, capped: open.capped, inForce, checked, quote };
  } catch (e) {
    return crash(schema, e);
  }
}

/** Stores a condition as a draft for a project administrator. A draft never binds a work item. */
export async function runDraftCondition(payload: unknown, accountId: string | null, deps: ConditionDeps): Promise<DraftConditionOutput> {
  const schema = SCHEMA_VERSION.draftCondition;
  const p = fieldsOf(payload);
  const projectKey = projectOf(p);
  if (typeof projectKey !== "string") return refusal(schema, "bad_input", projectKey.message);
  if (accountId === null) return refusal(schema, "not_allowed", "Drafting a condition needs a signed-in person.");
  const title = text(p.title);
  const jql = text(p.jql);
  const supersedes = text(p.supersedes) || null;
  try {
    // Fails closed: an administrator check that cannot be answered refuses the draft.
    if (!(await deps.isAdmin(projectKey).catch(() => false))) {
      return refusal(schema, "not_allowed", `Only an administrator of project ${projectKey} can draft a condition. Nothing was stored.`);
    }
    const stored = await deps.getDecisions(projectKey);
    const built = buildManualDecision(
      { title, scope: "project", scopeValue: "", constraint: "condition", constraintValue: jql, supersede: true },
      projectKey,
      stored,
      accountId,
      deps.now(),
    );
    if (!built.ok) return refusal(schema, "bad_input", `${built.reason} Nothing was stored.`);
    const errors = await deps.jqlErrors(jql);
    if (errors.length > 0) return refusal(schema, "bad_input", `Jira cannot run this filter: ${errors.join(" ")} Nothing was stored.`);
    if (supersedes !== null && !stored.some((d) => d.id === supersedes && d.status === "decided" && touches(d, projectKey))) {
      return refusal(schema, "bad_input", `"${supersedes}" is not a decision in force in ${projectKey}. Nothing was stored.`);
    }
    const drafts = await deps.getDrafts(projectKey);
    const id = "cd-" + fnv1a([title, jql, supersedes ?? ""].join("|"));
    if (drafts.some((d) => d.id === id)) return refusal(schema, "bad_input", "This draft is already waiting on the Decisions page. Nothing was stored.");
    if (drafts.length >= MAX_CONDITION_DRAFTS) {
      return refusal(schema, "bad_input", `${MAX_CONDITION_DRAFTS} drafts are already waiting on the Decisions page. Confirm or discard some first. Nothing was stored.`);
    }
    await deps.putDrafts(projectKey, [...drafts, { id, title, jql, supersedes, by: accountId, at: deps.now() }]);
    // Storage has no atomic append: a draft stored at the same moment can overwrite this one. Reading it back
    // narrows that, so the chat does not report a draft the Decisions page will not show.
    if (!(await deps.getDrafts(projectKey)).some((d) => d.id === id)) {
      return refusal(schema, "internal", "Another draft was being stored at the same moment and this one was not kept. Ask for it again.");
    }
    return { schema, ok: true, source: "rules", projectKey, draftId: id, title, jql, supersedes, quote: DRAFT_STORED };
  } catch (e) {
    return crash(schema, e);
  }
}

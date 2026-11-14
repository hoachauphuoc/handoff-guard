import { inProject } from "../decisions/confirm";
import type { DecisionSource, Proposal } from "../decisions/types";
import { projectOfKey } from "../decisions/page";
import { MAX_CANDIDATES, REASON_TEXT, validateCandidates } from "../decisions/validate";
import { handoffFrom, previewHandoff } from "../handoff/build";
import { actionList, contingencyAdvisory, severityText } from "../handoff/ipass";
import type { HandoffRecord } from "../handoff/types";
import { JiraReadError } from "../jira-error";
import { count } from "../plural";
import { watchAssignee, watchConflicts } from "../rules/advisories";
import { bindingDecisions, checkHandoff } from "../rules/checkHandoff";
import { changeText, suggestFixes } from "../rules/feasible";
import type { Decision, HandoffResult, Verdict, WorkItem } from "../rules/types";
import {
  SCHEMA_VERSION,
  type ActionError,
  type CheckHandoffOutput,
  type CheckHandoffSuccess,
  type ErrorCode,
  type GatherOutput,
  type ListBindingOutput,
  type People,
  type PeopleRead,
  type ProposeOutput,
  type ReadSourceOutput,
} from "./schema";

// Injected so this file has no Forge imports and tests need no network.
export type Deps = {
  readItem: (key: string) => Promise<{ item: WorkItem; issueId: string }>;
  getDecisions: (projectKey: string) => Promise<Decision[]>;
  getRecord: (issueId: string) => Promise<HandoffRecord | null>;
  readSource: (key: string) => Promise<DecisionSource>;
  getProposals: (issueId: string) => Promise<Proposal[]>;
  putProposals: (issueId: string, proposals: Proposal[]) => Promise<void>;
  /** The cloud id is bound by the caller, so this file never sees Forge context. */
  people: (issueId: string) => Promise<PeopleRead>;
  now: () => string;
};

export const MAX_BRIEF_DESCRIPTION = 2000;
export const MAX_BRIEF_COMMENTS = 10;
export const MAX_BRIEF_COMMENT_CHARS = 600;

const MAX_CANDIDATES_CHARS = 20_000;
const CANDIDATES_SHAPE =
  'candidates must be a JSON array, given as a string of at most 20,000 characters, of {"title", "scope":{"kind","..."}, "constraints":[{"kind","..."}], "evidence":{"quote"}}.';

// Over MCP there is no work item context, so the key always comes from the input and every bad_input
// message has to say what a valid key looks like.
const KEY_FORMAT = "A work item key is a project key, a hyphen and a number, such as PROJECT-123.";
const KEY = /^[A-Z][A-Z0-9_]+-\d+$/;
const VERDICT_TEXT: Record<Verdict, "Clear" | "Needs info" | "Blocked"> = {
  clear: "Clear",
  needs_info: "Needs info",
  blocked: "Blocked",
};

type Parsed = { ok: true; key: string; receiver: string | null } | { ok: false; message: string };

// Inputs are never trusted for authorization: they only pick which work item to read, and Jira decides
// whether the caller may see it.
function parse(payload: unknown, wantReceiver: boolean): Parsed {
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const ctxKey = (p.context as { jira?: { issueKey?: unknown } } | undefined)?.jira?.issueKey;
  const raw = [p.issueKey, ctxKey].find((v) => typeof v === "string" && v.trim() !== "");
  if (typeof raw !== "string") return { ok: false, message: "No work item key was given and the chat was not opened from a work item. Ask the user which work item." };
  const key = raw.trim().toUpperCase();
  if (!KEY.test(key)) return { ok: false, message: `"${raw.trim()}" is not a work item key.` };
  let receiver: string | null = null;
  if (wantReceiver && p.receiverAccountId !== undefined && p.receiverAccountId !== null) {
    if (typeof p.receiverAccountId !== "string") return { ok: false, message: "receiverAccountId must be a text value." };
    receiver = p.receiverAccountId.trim() || null;
  }
  return { ok: true, key, receiver };
}

// Order matters and nothing is guessed: a site id that cannot be read from one of these places stays null.
const SITE_ARI = /^ari:cloud:jira::site\/([0-9a-f-]{36})$/;
export function callerCloudId(
  payload: unknown,
  context: { cloudId?: string; installContext?: string } | undefined,
): string | null {
  const fromPayload = (payload as { context?: { cloudId?: unknown } } | null | undefined)?.context?.cloudId;
  const direct = [fromPayload, context?.cloudId].find((v) => typeof v === "string" && v.trim() !== "");
  if (typeof direct === "string") return direct.trim();
  return SITE_ARI.exec(context?.installContext ?? "")?.[1] ?? null;
}

export function callerAccountId(payload: unknown, context: { accountId?: string } | undefined): string | null {
  const fromPayload = (payload as { context?: { accountId?: unknown } } | null | undefined)?.context?.accountId;
  const id = [fromPayload, context?.accountId].find((v) => typeof v === "string" && v.trim() !== "");
  return typeof id === "string" ? id.trim() : null;
}

function failure<S extends (typeof SCHEMA_VERSION)[keyof typeof SCHEMA_VERSION]>(
  schema: S,
  issueKey: string | null,
  e: unknown,
  fixedMessage?: string,
): ActionError<S> {
  const code: ErrorCode = fixedMessage !== undefined ? "bad_input" : e instanceof JiraReadError ? e.code : "internal";
  const message = fixedMessage !== undefined ? `${fixedMessage} ${KEY_FORMAT}` : (e instanceof JiraReadError ? e.message : "Handoff Guard hit an unexpected error.");
  return {
    schema,
    ok: false,
    source: "rules",
    issueKey,
    error: { code, message },
    quote: `Handoff Guard could not check ${issueKey ?? "the work item"}: ${message}`,
  };
}

// The sentence an agent says right after the quote when it is asked to start the work. It is chosen here by
// the verdict, so the model copies a line from the action result and never writes a decision of its own.
export function startLine(verdict: Verdict | null): string {
  if (verdict === "clear") return "The rule check says Clear, so I may start.";
  if (verdict === null) return "No handoff is prepared, so there is no verdict and I will not start this work item.";
  return `I will not start this work item: the rule check says ${VERDICT_TEXT[verdict]}.`;
}

function quoteFor(key: string, result: HandoffResult | null): string {
  const head = `Handoff Guard rule check for ${key}:`;
  if (!result) {
    return `${head} no handoff is prepared, so there is no verdict. Prepare one in the Handoff Guard panel or name a receiver.`;
  }
  const text = VERDICT_TEXT[result.verdict];
  return result.findings.length === 0
    ? `${head} ${text}. No findings.`
    : `${head} ${text}. Findings: ${result.findings.map((f) => f.message).join(" ")}`;
}

export async function runCheckHandoff(payload: unknown, accountId: string | null, deps: Deps): Promise<CheckHandoffOutput> {
  const schema = SCHEMA_VERSION.check;
  const parsed = parse(payload, true);
  if (!parsed.ok) return failure(schema, null, null, parsed.message);
  const { key, receiver } = parsed;
  try {
    const { item, issueId } = await deps.readItem(key);
    const [decisions, record] = await Promise.all([deps.getDecisions(item.projectKey), deps.getRecord(issueId)]);
    const stored = record !== null && (receiver === null || receiver === record.toId);
    const basis: CheckHandoffSuccess["basis"] = stored ? "stored" : receiver !== null ? "preview" : "none";
    // Depends on the item and decisions only, so it is the same with or without a handoff.
    const fixes = suggestFixes(item, decisions).changes.map(changeText);
    if (basis === "none") {
      return {
        schema,
        ok: true,
        source: "rules",
        issueKey: key,
        basis,
        verdict: null,
        verdictText: null,
        senderId: null,
        receiverId: null,
        findings: [],
        binding: bindingDecisions(decisions, item).map((d) => ({ id: d.id, title: d.title, source: d.source, acknowledged: false })),
        fixes,
        startLine: startLine(null),
        quote: quoteFor(key, null),
      };
    }
    const handoff = stored ? handoffFrom(item, record, decisions) : previewHandoff(item, record, receiver as string, accountId);
    const result = checkHandoff(handoff, decisions);
    return {
      schema,
      ok: true,
      source: "rules",
      issueKey: key,
      basis,
      verdict: result.verdict,
      verdictText: VERDICT_TEXT[result.verdict],
      senderId: handoff.fromId,
      receiverId: handoff.toId,
      findings: result.findings,
      binding: result.binding.map((d) => ({
        id: d.id,
        title: d.title,
        source: d.source,
        acknowledged: handoff.acknowledged.includes(d.id),
      })),
      fixes,
      startLine: startLine(result.verdict),
      quote: quoteFor(key, result),
    };
  } catch (e) {
    return failure(schema, key, e);
  }
}

export async function runListBindingDecisions(payload: unknown, deps: Deps): Promise<ListBindingOutput> {
  const schema = SCHEMA_VERSION.list;
  const parsed = parse(payload, false);
  if (!parsed.ok) return failure(schema, null, null, parsed.message);
  const { key } = parsed;
  try {
    const { item } = await deps.readItem(key);
    const all = await deps.getDecisions(item.projectKey);
    const bound = bindingDecisions(all, item);
    const quote =
      bound.length === 0
        ? `No recorded decision binds ${key}.`
        : `${count(bound.length, "decision")} ${bound.length === 1 ? "binds" : "bind"} ${key}: ${bound.map((d) => `${d.title} (${d.source.kind} ${d.source.ref})`).join("; ")}`;
    return {
      schema,
      ok: true,
      source: "rules",
      issueKey: key,
      storedDecisionCount: all.length,
      decisions: bound.map((d) => ({ id: d.id, title: d.title, source: d.source, constraints: d.constraints })),
      quote,
    };
  } catch (e) {
    return failure(schema, key, e);
  }
}

export async function runReadDecisionSource(payload: unknown, deps: Deps): Promise<ReadSourceOutput> {
  const schema = SCHEMA_VERSION.source;
  const parsed = parse(payload, false);
  if (!parsed.ok) return failure(schema, null, null, parsed.message);
  const { key } = parsed;
  try {
    const src = await deps.readSource(key);
    return {
      schema,
      ok: true,
      source: "rules",
      issueKey: key,
      parts: src.parts,
      truncated: src.truncated,
      quote: `Handoff Guard read ${count(src.parts.length, "text part")} of ${key} (description and comments you can see)${
        src.truncated ? "; the text was cut (20,000 characters)" : ""
      }. Quote evidence from these parts only.`,
    };
  } catch (e) {
    return failure(schema, key, e);
  }
}

// A model often omits the key that only restates which work item it is reading. Reach is limited to the
// current item's project and key anyway, so filling a missing one from the item grants nothing; a key that
// is present but names another project or item is left alone and still rejected. Label scope is not
// filled: the item has to carry the label already.
function fillScopes(candidates: unknown, item: { issueKey: string; projectKey: string }): unknown {
  const fill = (c: unknown): unknown => {
    const s = (c as { scope?: unknown } | null)?.scope as Record<string, unknown> | null | undefined;
    if (!c || typeof c !== "object" || !s || typeof s !== "object") return c;
    const missing = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
    if (s.kind === "project" && missing(s.projectKey)) return { ...c, scope: { ...s, projectKey: item.projectKey } };
    if (s.kind === "workItem" && missing(s.key)) return { ...c, scope: { ...s, key: item.issueKey } };
    return c;
  };
  if (Array.isArray(candidates)) return candidates.map(fill);
  const wrapped = candidates as { candidates?: unknown } | null;
  return wrapped && Array.isArray(wrapped.candidates) ? { ...wrapped, candidates: wrapped.candidates.map(fill) } : candidates;
}

// GET is the verb on purpose: FRGE-1601 makes a non-GET action ask a person to confirm each call. The
// only write here is a bounded set of proposals in app storage; no decision, handoff record or Jira data.
export async function runProposeDecisions(payload: unknown, deps: Deps): Promise<ProposeOutput> {
  const schema = SCHEMA_VERSION.propose;
  const parsed = parse(payload, false);
  if (!parsed.ok) return failure(schema, null, null, parsed.message);
  const { key } = parsed;
  const raw = (payload as { candidates?: unknown }).candidates;
  if (typeof raw !== "string" || raw.length > MAX_CANDIDATES_CHARS) return failure(schema, key, null, CANDIDATES_SHAPE);
  let candidates: unknown;
  try {
    candidates = JSON.parse(raw);
  } catch {
    return failure(schema, key, null, CANDIDATES_SHAPE);
  }
  try {
    // The source is read again here, as the caller: quotes are checked against Jira, never against what
    // the model says it read.
    const [src, stored] = await Promise.all([deps.readSource(key), deps.getDecisions(projectOfKey(key))]);
    const { kept, rejected: raw } = validateCandidates(
      fillScopes(candidates, { issueKey: key, projectKey: src.projectKey }),
      src.parts,
      { issueKey: key, projectKey: src.projectKey, labels: src.labels, stored },
      deps.now(),
    );
    const rejected = raw.map((r) => ({ ...r, message: REASON_TEXT[r.reason] }));
    let waiting: Proposal[] | null = null;
    if (kept.length > 0) {
      // Merged into the saved set (capped at 5), newest first, so a second call adds to what a person has not
      // yet confirmed instead of erasing it. A proposal seen before keeps its first proposedAt, so asking
      // twice leaves identical state. All-rejected input writes nothing and keeps what is there.
      const before = inProject(await deps.getProposals(src.issueId), src.projectKey);
      waiting = [...kept.map((p) => before.find((b) => b.id === p.id) ?? p), ...before.filter((b) => !kept.some((k) => k.id === b.id))].slice(0, MAX_CANDIDATES);
      await deps.putProposals(src.issueId, waiting);
    }
    return {
      schema,
      ok: true,
      source: "rules",
      issueKey: key,
      proposed: kept.map(({ id, title, scope, constraints, evidence }) => ({ id, title, scope, constraints, evidence })),
      rejected,
      quote: `Handoff Guard saved ${count(kept.length, "proposed decision")} for ${key}${waiting === null ? "" : ` (${count(waiting.length, "proposed decision")} now waiting for a person to confirm)`} and rejected ${rejected.length}${
        rejected.length > 0 ? ` (${rejected.map((r) => `#${r.index + 1}: ${r.message}`).join(" ")})` : ""
      }. Proposed decisions do not bind anything until a person confirms them in the Handoff Guard panel.`,
    };
  } catch (e) {
    return failure(schema, key, e);
  }
}

const PEOPLE_NOTE = {
  no_query: "Teamwork Graph was not asked: no saved query is registered for this app.",
  no_site: "Teamwork Graph was not asked: the site id is unknown.",
  nothing:
    "Teamwork Graph returned nothing. That can mean no permission or nobody is connected; it is not a fact about the work item.",
  ok: "People connected to this work item according to Teamwork Graph; advisory, not checked by any rule. Shared with: direct shares in the last 90 days.",
  error: "Teamwork Graph could not be read just now, so connected people are not shown. No rule depends on it.",
  partial: "Some Teamwork Graph results could not be read.",
} as const;

// A failing graph call must not fail the brief: people are advisory and the check does not read them.
async function readPeople(issueId: string, deps: Deps): Promise<People> {
  let read: PeopleRead;
  try {
    read = await deps.people(issueId);
  } catch {
    read = { status: "error", reason: "read_failed", sharedWith: [], mentioned: [] };
  }
  const base = { source: "Teamwork Graph" as const, status: read.status };
  const partly = read.partial ? ` ${PEOPLE_NOTE.partial}` : "";
  if (read.status === "ok") return { ...base, sharedWith: read.sharedWith, mentioned: read.mentioned, note: PEOPLE_NOTE.ok + partly };
  const note =
    read.status === "error"
      ? PEOPLE_NOTE.error
      : read.status === "nothing"
        ? PEOPLE_NOTE.nothing + partly
        : read.reason === "no_site"
          ? PEOPLE_NOTE.no_site
          : PEOPLE_NOTE.no_query;
  return { ...base, sharedWith: [], mentioned: [], note };
}

const peopleQuote = (p: People): string =>
  p.status === "ok"
    ? `${p.sharedWith.length} shared with, ${p.mentioned.length} mentioned`
    : p.status === "nothing"
      ? "returned nothing"
      : p.status === "error"
        ? "could not be read"
        : "was not asked";

// Reads only. The verdict comes from runCheckHandoff, whose result is passed through untouched; nothing
// gathered here (comments, people) is an input to it.
export async function runGatherHandoffContext(payload: unknown, accountId: string | null, deps: Deps): Promise<GatherOutput> {
  const schema = SCHEMA_VERSION.gather;
  const parsed = parse(payload, false);
  if (!parsed.ok) return failure(schema, null, null, parsed.message);
  const { key } = parsed;
  const check = await runCheckHandoff({ issueKey: key }, accountId, deps);
  if (!check.ok) return { schema, ok: false, source: "rules", issueKey: key, error: check.error, quote: check.quote };
  try {
    const [{ item, issueId }, src, decisions] = await Promise.all([deps.readItem(key), deps.readSource(key), deps.getDecisions(projectOfKey(key))]);
    const record = await deps.getRecord(issueId);
    const people = await readPeople(issueId, deps);
    // Only for a stored handoff: a preview has no record, so no sender's contingency and no owners to name.
    const stored = check.basis === "stored" && record !== null;
    const result = stored ? checkHandoff(handoffFrom(item, record, decisions), decisions) : null;
    const comments = src.parts
      .filter((p) => p.from.startsWith(`${key} comment `))
      .slice(0, MAX_BRIEF_COMMENTS)
      .map(({ from, text }) => ({ from, text: text.slice(0, MAX_BRIEF_COMMENT_CHARS) }));
    return {
      schema,
      ok: true,
      source: "rules",
      issueKey: key,
      item: {
        key: item.key,
        projectKey: item.projectKey,
        summary: item.summary,
        description: item.description.slice(0, MAX_BRIEF_DESCRIPTION),
        descriptionTruncated: item.description.length > MAX_BRIEF_DESCRIPTION,
        labels: item.labels,
        components: item.components,
        dueDate: item.dueDate,
        assigneeId: item.assigneeId,
      },
      comments,
      check,
      binding: check.binding.map((b) => ({ ...b, constraints: decisions.find((d) => d.id === b.id)?.constraints ?? [] })),
      people,
      ipass: {
        severity: result ? severityText(result.verdict) : null,
        actions: stored && result ? actionList(result, record, suggestFixes(item, decisions).changes) : [],
        contingency: stored ? (record.contingency ?? null) : null,
        contingencyAdvisory: stored && record.contingency ? contingencyAdvisory(record.contingency) : null,
      },
      advisories: [
        ...(check.basis === "none" ? [] : watchConflicts(item, bindingDecisions(decisions, item))),
        ...watchAssignee(item, record, bindingDecisions(decisions, item)),
      ],
      quote: `${check.quote} Handoff Guard gathered context for ${key}: ${count(comments.length, "comment")} read. Teamwork Graph: ${peopleQuote(people)}. A brief written from this is advisory and is not stored.`,
    };
  } catch (e) {
    return failure(schema, key, e);
  }
}

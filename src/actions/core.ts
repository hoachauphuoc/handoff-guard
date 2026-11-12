import type { DecisionSource, Proposal } from "../decisions/types";
import { validateCandidates } from "../decisions/validate";
import { handoffFrom, previewHandoff } from "../handoff/build";
import type { HandoffRecord } from "../handoff/types";
import { JiraReadError } from "../jira-error";
import { bindingDecisions, checkHandoff } from "../rules/checkHandoff";
import type { Decision, HandoffResult, Verdict, WorkItem } from "../rules/types";
import {
  SCHEMA_VERSION,
  type ActionError,
  type CheckHandoffOutput,
  type CheckHandoffSuccess,
  type ErrorCode,
  type ListBindingOutput,
  type ProposeOutput,
  type ReadSourceOutput,
} from "./schema";

// Injected so this file has no Forge imports and tests need no network.
export type Deps = {
  readItem: (key: string) => Promise<{ item: WorkItem; issueId: string }>;
  getDecisions: () => Promise<Decision[]>;
  getRecord: (issueId: string) => Promise<HandoffRecord | null>;
  readSource: (key: string) => Promise<DecisionSource>;
  getProposals: (issueId: string) => Promise<Proposal[]>;
  putProposals: (issueId: string, proposals: Proposal[]) => Promise<void>;
  now: () => string;
};

const MAX_CANDIDATES_CHARS = 20_000;
const CANDIDATES_SHAPE =
  'candidates must be a JSON array, given as a string of at most 20,000 characters, of {"title", "scope":{"kind","..."}, "constraints":[{"kind","..."}], "evidence":{"quote"}}.';

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
  if (typeof raw !== "string") return { ok: false, message: "No work item key was given. Ask for the key, for example OPS-1." };
  const key = raw.trim().toUpperCase();
  if (!KEY.test(key)) return { ok: false, message: `"${raw.trim()}" is not a work item key such as OPS-1.` };
  let receiver: string | null = null;
  if (wantReceiver && p.receiverAccountId !== undefined && p.receiverAccountId !== null) {
    if (typeof p.receiverAccountId !== "string") return { ok: false, message: "receiverAccountId must be a text value." };
    receiver = p.receiverAccountId.trim() || null;
  }
  return { ok: true, key, receiver };
}

function failure<S extends (typeof SCHEMA_VERSION)[keyof typeof SCHEMA_VERSION]>(
  schema: S,
  issueKey: string | null,
  e: unknown,
  fixedMessage?: string,
): ActionError<S> {
  const code: ErrorCode = fixedMessage !== undefined ? "bad_input" : e instanceof JiraReadError ? e.code : "internal";
  const message = fixedMessage ?? (e instanceof JiraReadError ? e.message : "Handoff Guard hit an unexpected error.");
  return {
    schema,
    ok: false,
    source: "rules",
    issueKey,
    error: { code, message },
    quote: `Handoff Guard could not check ${issueKey ?? "the work item"}: ${message}`,
  };
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
    const [decisions, record] = await Promise.all([deps.getDecisions(), deps.getRecord(issueId)]);
    const stored = record !== null && (receiver === null || receiver === record.toId);
    const basis: CheckHandoffSuccess["basis"] = stored ? "stored" : receiver !== null ? "preview" : "none";
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
        quote: quoteFor(key, null),
      };
    }
    const handoff = stored ? handoffFrom(item, record) : previewHandoff(item, record, receiver as string, accountId);
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
    const all = await deps.getDecisions();
    const bound = bindingDecisions(all, item);
    const quote =
      bound.length === 0
        ? `No recorded decision binds ${key}.`
        : `${bound.length} decisions bind ${key}: ${bound.map((d) => `${d.title} (${d.source.kind} ${d.source.ref})`).join("; ")}`;
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
      parts: src.parts.map(({ from, text }) => ({ from, text })),
      truncated: src.truncated,
      unreadablePages: src.unreadablePages,
      teamworkGraphNothing: src.graphNothing,
      quote: `Handoff Guard read ${src.parts.length} text parts of ${key} (description, comments and linked Confluence pages you can see)${
        src.truncated ? "; the text was cut (20,000 characters or 3 pages)" : ""
      }. ${src.unreadablePages} linked pages you cannot open were skipped.${
        src.graphNothing ? " Teamwork Graph returned nothing; that does not mean no pages are linked." : ""
      } Quote evidence from these parts only.`,
    };
  } catch (e) {
    return failure(schema, key, e);
  }
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
    const src = await deps.readSource(key);
    const { kept, rejected } = validateCandidates(
      candidates,
      src.parts,
      { issueKey: key, projectKey: src.projectKey, labels: src.labels },
      deps.now(),
    );
    if (kept.length > 0) {
      // Replaces the saved set (it is capped at 5). A proposal seen before keeps its first proposedAt, so
      // asking twice leaves identical state. All-rejected input writes nothing and keeps what is there.
      const before = await deps.getProposals(src.issueId);
      await deps.putProposals(src.issueId, kept.map((p) => before.find((b) => b.id === p.id) ?? p));
    }
    return {
      schema,
      ok: true,
      source: "rules",
      issueKey: key,
      proposed: kept.map(({ id, title, scope, constraints, evidence }) => ({ id, title, scope, constraints, evidence })),
      rejected,
      quote: `Handoff Guard saved ${kept.length} proposed decisions for ${key} and rejected ${rejected.length}. Proposed decisions do not bind anything until a person confirms them in the Handoff Guard panel.`,
    };
  } catch (e) {
    return failure(schema, key, e);
  }
}

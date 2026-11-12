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
} from "./schema";

// Injected so this file has no Forge imports and tests need no network.
export type Deps = {
  readItem: (key: string) => Promise<{ item: WorkItem; issueId: string }>;
  getDecisions: () => Promise<Decision[]>;
  getRecord: (issueId: string) => Promise<HandoffRecord | null>;
};

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

function failure<S extends typeof SCHEMA_VERSION.check | typeof SCHEMA_VERSION.list>(
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

import Resolver from "@forge/resolver";
import { runGatherHandoffContext } from "../actions/core";
import { depsFor } from "../actions/deps";
import { confirmProposal, dismissProposal, inProject } from "../decisions/confirm";
import { canSupersede, splitOverlap, supersede } from "../decisions/supersede";
import { unrecordedMarked, type MarkedState } from "../decisions/marked";
import { hypothetical } from "../decisions/hypothetical";
import { buildManualDecision, readManualInput } from "../decisions/manual";
import { leavingView, type LeavingView } from "../decisions/leaving";
import { buildDecisionsPage, projectOfKey, touches, type DecisionsPageState } from "../decisions/page";
import { acknowledge, acknowledgeAll, checkReadBack } from "../handoff/acknowledge";
import { mayPrepare, PREPARE_DENIED } from "../handoff/prepare";
import { exampleReadBack } from "../handoff/example";
import { withContingency } from "../handoff/contingency";
import { actionList, contingencyAdvisory, severityText } from "../handoff/ipass";
import { handoffFrom, walkthroughHandoff } from "../handoff/build";
import { driftByDecision, fingerprintOf, staleAcks } from "../handoff/drift";
import type { AcknowledgeAllReply, HandoffRecord, PanelState, PracticeReadBackReply } from "../handoff/types";
import { explainRefusal } from "../llm";
import { MANAGE_DENIED } from "../authz";
import { monthCounts, type AuditAction, type AuditEvent, type MonthCounts } from "../audit";
import { isProjectAdminAsUser, openItemsAsUser, readItemAsUser as readItem } from "../jira";
import { bindingDecisions, checkHandoff } from "../rules/checkHandoff";
import { watchAssignee, watchConflicts } from "../rules/advisories";
import { changeText, suggestFixes } from "../rules/feasible";
import { impactOf } from "../rules/impact";
import { replayDiff, replayInstant, type ReplayChange } from "../rules/replay";
import type { Proposal } from "../decisions/types";
import type { Decision, Finding } from "../rules/types";
import { hasSamples, mergeDecisions, sampleDecisions, withoutSamples } from "../samples/decisions";
import { readSourceAsUser } from "../source";
import { addAudit, deleteItemData, getAudit, getDecisions, getProposals, getRecord, putProposals, putRecord, resetAudit, updateDecisions } from "../store";

const resolver = new Resolver();

// Only findings about the work item itself: the practice handoff has made-up people, so receiver and
// acknowledgement findings would be noise.
const PRACTICE_RULES: Finding["rule"][] = [
  "empty_description",
  "no_due_date",
  "invalid_due_date",
  "contradicts_decision",
  "invalid_constraint",
];

// Checked on the server for every change to decisions; the panel only hides the buttons.
async function requireAdmin(projectKey: string): Promise<void> {
  if (!(await isProjectAdminAsUser(projectKey))) throw new Error(MANAGE_DENIED);
}

// The trail keeps the action, the person, the time and a key or id; never text someone typed.
const log = (projectKey: string, who: string | null | undefined, action: AuditAction, ref: string): Promise<void> =>
  addAudit(projectKey, { at: new Date().toISOString(), who: who ?? "unknown", action, ref });

type Ctx = { accountId?: string; cloudId?: string; extension: { issue: { key: string; id: string } } };

// How many open work items of the project would contradict each proposal. A read that fails is reported as
// null so the panel can say the count is missing, never show zero.
async function impactFor(projectKey: string, proposals: Proposal[]): Promise<PanelState["proposalImpact"]> {
  if (proposals.length === 0) return {};
  try {
    const open = await openItemsAsUser(projectKey);
    const items = open.items.map((i) => i.item);
    return Object.fromEntries(proposals.map((p) => [p.id, { count: impactOf(hypothetical(p), items).length, capped: open.capped }]));
  } catch {
    return null;
  }
}

function overlapFor(proposals: Proposal[], decisions: Decision[], viewerId: string | null): Pick<PanelState, "supersedes" | "supersedeBlocked"> {
  const named = (ds: Decision[]) => ds.map((d) => ({ id: d.id, title: d.title }));
  const split = proposals.map((p) => [p.id, splitOverlap(decisions, p.scope, p.constraints, viewerId ?? "")] as const);
  return {
    supersedes: Object.fromEntries(split.map(([id, s]) => [id, named(s.retirable)])),
    supersedeBlocked: Object.fromEntries(split.map(([id, s]) => [id, named(s.kept)])),
  };
}

async function panelState(ctx: Ctx): Promise<PanelState> {
  const { item, issueId } = await readItem(ctx.extension.issue.key);
  const [decisions, record, stored, canManage] = await Promise.all([getDecisions(item.projectKey), getRecord(issueId), getProposals(issueId), isProjectAdminAsUser(item.projectKey)]);
  const proposals = inProject(stored, item.projectKey);
  const viewerId = ctx.accountId ?? null;
  // Decisions that name this project. Samples are loaded per project, so a site-wide count, or an old label
  // decision stored before labels carried a project, would hide the sample button here.
  const own = decisions.filter((d) => touches(d, item.projectKey) && !(d.scope.kind === "label" && d.scope.projectKey === undefined));
  const result = record ? checkHandoff(handoffFrom(item, record, decisions), decisions) : null;
  const practice = checkHandoff(
    walkthroughHandoff(item, viewerId, bindingDecisions(decisions, item).map((d) => d.id)),
    decisions,
  );
  return {
    issueKey: ctx.extension.issue.key,
    record,
    result,
    viewerId,
    canManage,
    inForceCount: own.filter((d) => d.status === "decided").length,
    hasSamples: hasSamples(decisions, item.projectKey),
    exampleReadBack: exampleReadBack(bindingDecisions(decisions, item)),
    canPrepare: mayPrepare(record, viewerId, item.assigneeId, canManage),
    isReceiver: record !== null && viewerId !== null && viewerId === record.toId,
    decisionCount: own.length,
    proposals,
    practiceFindings: practice.findings.filter((f) => PRACTICE_RULES.includes(f.rule)),
    // Computed from confirmed decisions only; proposals never reach it.
    advisories: [
      ...(record ? watchConflicts(item, bindingDecisions(decisions, item)) : []),
      ...watchAssignee(item, record, bindingDecisions(decisions, item)),
    ],
    fixes: suggestFixes(item, decisions).changes.map(changeText),
    stale: record ? Object.keys(staleAcks(record.acknowledged, record.acknowledgedWith, item, bindingDecisions(decisions, item))) : [],
    drift: record ? driftByDecision(record.acknowledged, record.acknowledgedWith, item) : {},
    untracked: record ? record.acknowledged.filter((id) => record.acknowledgedWith?.[id] === undefined) : [],
    severity: result ? severityText(result.verdict) : null,
    actions: record && result ? actionList(result, record, suggestFixes(item, decisions).changes) : [],
    contingency: record?.contingency ? { text: record.contingency, advisory: contingencyAdvisory(record.contingency) } : null,
    proposalImpact: await impactFor(item.projectKey, proposals),
    // The viewer's own view: what the button retires, and what it would leave in force.
    ...overlapFor(proposals, decisions, viewerId),
  };
}

resolver.define("getPanel", ({ context }) => panelState(context as Ctx));

resolver.define("prepareHandoff", async ({ context, payload }) => {
  const ctx = context as Ctx;
  const toId = String((payload as { toId?: string }).toId ?? "");
  if (!ctx.accountId || !toId) throw new Error("Pick a receiver first.");
  const { item, issueId } = await readItem(ctx.extension.issue.key);
  if (!mayPrepare(await getRecord(issueId), ctx.accountId, item.assigneeId, await isProjectAdminAsUser(item.projectKey))) throw new Error(PREPARE_DENIED);
  // Preparing again replaces the record, so earlier acknowledgements never carry over to a new receiver.
  const record: HandoffRecord = {
    fromId: ctx.accountId,
    toId,
    acknowledged: [],
    preparedAt: new Date().toISOString(),
    acknowledgedAt: {},
    origin: "manual",
    protocol: 1,
  };
  await putRecord(issueId, record);
  await log(item.projectKey, ctx.accountId, "handoff_prepared", ctx.extension.issue.key);
  return panelState(ctx);
});

resolver.define("acknowledgeDecision", async ({ context, payload }) => {
  const ctx = context as Ctx;
  const decisionId = String((payload as { decisionId?: string }).decisionId ?? "");
  const { item, issueId } = await readItem(ctx.extension.issue.key);
  const [decisions, record] = await Promise.all([getDecisions(item.projectKey), getRecord(issueId)]);
  if (!record) throw new Error("No handoff has been prepared for this work item.");
  const binding = bindingDecisions(decisions, item).map((d) => d.id);
  const stale = decisionId in staleAcks(record.acknowledged, record.acknowledgedWith, item, bindingDecisions(decisions, item));
  // The receiver is checked here, on the server; the button in the panel is only a convenience.
  const out = acknowledge(record, ctx.accountId ?? null, decisionId, binding, new Date().toISOString(), fingerprintOf(item), stale);
  if (!out.ok) throw new Error(`Cannot acknowledge: ${out.reason}.`);
  await putRecord(issueId, out.record);
  await log(item.projectKey, ctx.accountId, "handoff_acknowledged", ctx.extension.issue.key);
  return panelState(ctx);
});

// Practice only: nothing is stored and no verdict is produced, so one person can see a refusal without a handoff.
resolver.define("practiceReadBack", async ({ context, payload }) => {
  const ctx = context as Ctx;
  const readBack = String((payload as { readBack?: string }).readBack ?? "");
  const { item } = await readItem(ctx.extension.issue.key);
  const binding = bindingDecisions(await getDecisions(item.projectKey), item);
  if (binding.length === 0) throw new Error("No decision binds this work item yet. A project administrator can load sample decisions here or add one on the Decisions page.");
  const { problems, contradictions } = checkReadBack(readBack, binding, new Date().toISOString());
  return {
    accepted: problems.length === 0,
    reasons: problems,
    ...(contradictions.length > 0 ? { explanation: await explainRefusal(readBack, contradictions) } : {}),
  } satisfies PracticeReadBackReply;
});

// One read-back acknowledges every binding decision of a record prepared under the I-PASS design. The checks
// run here, on the server; the panel only shows the same reasons.
resolver.define("acknowledgeAll", async ({ context, payload }) => {
  const ctx = context as Ctx;
  const readBack = String((payload as { readBack?: string }).readBack ?? "");
  const { item, issueId } = await readItem(ctx.extension.issue.key);
  const [decisions, record] = await Promise.all([getDecisions(item.projectKey), getRecord(issueId)]);
  if (!record) throw new Error("No handoff has been prepared for this work item.");
  const out = acknowledgeAll(record, ctx.accountId ?? null, bindingDecisions(decisions, item), readBack, new Date().toISOString(), fingerprintOf(item));
  // A model sentence is asked for only when the code found a contradiction; it is shown beside the reasons.
  if (!out.ok && out.reason === "read_back") {
    await log(item.projectKey, ctx.accountId, "readback_refused", ctx.extension.issue.key);
    return {
      reasons: out.problems,
      ...(out.contradictions.length > 0 ? { explanation: await explainRefusal(readBack, out.contradictions) } : {}),
    } satisfies AcknowledgeAllReply;
  }
  if (!out.ok) throw new Error(`Cannot acknowledge: ${out.reason}.`);
  await putRecord(issueId, out.record);
  await log(item.projectKey, ctx.accountId, "handoff_acknowledged", ctx.extension.issue.key);
  return { state: await panelState(ctx) } satisfies AcknowledgeAllReply;
});

// Only the sender writes it, and only as text typed in the panel: no action or agent reaches this.
resolver.define("saveContingency", async ({ context, payload }) => {
  const ctx = context as Ctx;
  const { issueId } = await readItem(ctx.extension.issue.key);
  const record = await getRecord(issueId);
  if (!record) throw new Error("No handoff has been prepared for this work item.");
  const out = withContingency(record, ctx.accountId ?? null, String((payload as { text?: string }).text ?? ""));
  if (!out.ok) throw new Error(out.reason === "too_long" ? "Write at most 300 characters." : "Only the sender can write the contingency.");
  await putRecord(issueId, out.record);
  return panelState(ctx);
});

resolver.define("loadSampleDecisions", async ({ context }) => {
  const ctx = context as Ctx;
  const { item } = await readItem(ctx.extension.issue.key);
  await requireAdmin(item.projectKey);
  // Demo data for this project only; nothing is written to Jira. A project that has them already is left as it is.
  await updateDecisions(item.projectKey, (decisions) =>
    hasSamples(decisions, item.projectKey) ? decisions : mergeDecisions(decisions, sampleDecisions(item.projectKey)),
  );
  await log(item.projectKey, ctx.accountId, "samples_loaded", item.projectKey);
  return panelState(ctx);
});

resolver.define("removeSampleDecisions", async ({ context }) => {
  const ctx = context as Ctx;
  const { item } = await readItem(ctx.extension.issue.key);
  await requireAdmin(item.projectKey);
  await updateDecisions(item.projectKey, (decisions) => withoutSamples(decisions, item.projectKey));
  await log(item.projectKey, ctx.accountId, "samples_removed", item.projectKey);
  return panelState(ctx);
});

// Both take only a proposal id. The proposal itself is read from storage for this work item, so nothing a
// caller sends can become a decision.
resolver.define("confirmProposal", async ({ context, payload }) => {
  const ctx = context as Ctx;
  if (!ctx.accountId) throw new Error("Confirming a decision needs a signed-in person.");
  const id = String((payload as { proposalId?: string }).proposalId ?? "");
  const { item, issueId } = await readItem(ctx.extension.issue.key);
  await requireAdmin(item.projectKey);
  const proposals = inProject(await getProposals(issueId), item.projectKey);
  const retire = (payload as { supersede?: boolean }).supersede === true;
  let remaining: Proposal[] | null = null;
  // Worked out from the decisions as they are at the moment of saving, not from an earlier read.
  await updateDecisions(item.projectKey, (current) => {
    const out = confirmProposal(proposals, current, id, ctx.accountId as string, new Date().toISOString(), retire);
    if (!out.ok) return current;
    remaining = out.proposals;
    return out.decisions;
  });
  if (remaining === null) throw new Error("That proposal is no longer there. Reload the page to see the current list.");
  // The decision is saved first: if the second write fails the proposal is still listed and confirming
  // again changes nothing, whereas the other order could lose the decision.
  await putProposals(issueId, remaining);
  await log(item.projectKey, ctx.accountId, "decision_confirmed", ctx.extension.issue.key);
  return panelState(ctx);
});

resolver.define("dismissProposal", async ({ context, payload }) => {
  const ctx = context as Ctx;
  if (!ctx.accountId) throw new Error("Dismissing a proposal needs a signed-in person.");
  const id = String((payload as { proposalId?: string }).proposalId ?? "");
  const { item, issueId } = await readItem(ctx.extension.issue.key);
  // Dismissing decides what the project will not record, so it takes the same permission as confirming.
  await requireAdmin(item.projectKey);
  await putProposals(issueId, dismissProposal(await getProposals(issueId), id));
  return panelState(ctx);
});

// The brief only reads. It runs the same function the Rovo action runs, as the viewer, so what the panel
// shows and what Rovo is given cannot differ.
resolver.define("gatherContext", ({ context }) => {
  const ctx = context as Ctx;
  return runGatherHandoffContext({ issueKey: ctx.extension.issue.key }, ctx.accountId ?? null, depsFor(ctx.cloudId ?? null));
});

// Read separately from the panel state so a slow or refused comment read never delays the verdict. Nothing
// returned here is stored, and it is not an input to the rule check.
resolver.define("getMarked", async ({ context }): Promise<MarkedState> => {
  const ctx = context as Ctx;
  const [src, decisions] = await Promise.all([readSourceAsUser(ctx.extension.issue.key), getDecisions(projectOfKey(ctx.extension.issue.key))]);
  return {
    notInLedger: unrecordedMarked(src.parts, decisions),
    truncated: src.truncated,
  };
});

// The Decisions project page. Open items are read as the viewer, so the counts only cover work the viewer
// may see, and the page says when the cap cut the list. Nothing is written.
const ACTIVITY_SHOWN = 20;

export type DecisionsPageView = DecisionsPageState & { activity: AuditEvent[]; counts: MonthCounts[] };

resolver.define("getDecisionsPage", async ({ context }): Promise<DecisionsPageView> => {
  const projectKey = String((context as { extension: { project: { key: string } } }).extension.project.key);
  const viewerId = (context as { accountId?: string }).accountId ?? null;
  const [open, decisions, canManage] = await Promise.all([openItemsAsUser(projectKey), getDecisions(projectKey), isProjectAdminAsUser(projectKey)]);
  const audit = await getAudit(projectKey);
  const records = await Promise.all(open.items.map((i) => getRecord(i.issueId)));
  return {
    ...buildDecisionsPage(
      projectKey,
      decisions,
      open.items.map((i, n) => ({ item: i.item, record: records[n] ?? null })),
      open.capped,
      new Date().toISOString(),
      viewerId,
      canManage,
    ),
    activity: audit.slice(0, ACTIVITY_SHOWN),
    counts: monthCounts(audit),
  };
});

// What one person still holds in this project. Read as the viewer, like the page above. Nothing is written.
resolver.define("getLeaving", async ({ context, payload }): Promise<LeavingView> => {
  const projectKey = String((context as { extension: { project: { key: string } } }).extension.project.key);
  const personId = String((payload as { accountId?: string }).accountId || (context as { accountId?: string }).accountId || "");
  if (personId === "") throw new Error("Pick a person first.");
  const [open, decisions] = await Promise.all([openItemsAsUser(projectKey), getDecisions(projectKey)]);
  const records = await Promise.all(open.items.map((i) => getRecord(i.issueId)));
  return leavingView(
    personId,
    open.items.map((i, n) => ({ item: i.item, record: records[n] ?? null })),
    decisions,
    projectKey,
    open.items.length,
    open.capped,
  );
});

export type ReplayState = { date: string; changes: ReplayChange[]; leftOut: string[]; assumed: string[]; scanned: number; capped: boolean };

// Replays the project's stored handoffs against the decisions of an earlier date. The clock is read here, at
// the edge, and passed to the pure functions; nothing is written.
resolver.define("replayOn", async ({ context, payload }): Promise<ReplayState> => {
  const projectKey = String((context as { extension: { project: { key: string } } }).extension.project.key);
  const date = String((payload as { date?: string }).date ?? "");
  const now = new Date();
  const thenIso = replayInstant(date, now.toISOString());
  if (thenIso === null) throw new Error("Pick a date that is today or earlier.");
  const [open, stored] = await Promise.all([openItemsAsUser(projectKey), getDecisions(projectKey)]);
  // Only this project's decisions: another project's cannot bind these items, and its undated titles would
  // otherwise be listed in the notes here.
  const decisions = stored.filter((d) => touches(d, projectKey));
  const records = await Promise.all(open.items.map((i) => getRecord(i.issueId)));
  const inputs = open.items.flatMap((i, n) => {
    const r = records[n];
    return r ? [{ item: i.item, fromId: r.fromId, toId: r.toId, acknowledged: r.acknowledged, acknowledgedAt: r.acknowledgedAt, preparedAt: r.preparedAt }] : [];
  });
  return { date, ...replayDiff(inputs, decisions, thenIso, now.toISOString()), scanned: open.items.length, capped: open.capped };
});

// A person retires a decision from the Decisions page. The rules already ignore anything not "decided".
resolver.define("supersedeDecision", async ({ context, payload }) => {
  const accountId = (context as { accountId?: string }).accountId;
  if (!accountId) throw new Error("Superseding a decision needs a signed-in person.");
  const id = String((payload as { decisionId?: string }).decisionId ?? "");
  await requireAdmin(String((context as { extension: { project: { key: string } } }).extension.project.key));
  const projectKey = String((context as { extension: { project: { key: string } } }).extension.project.key);
  const target = (await getDecisions(projectKey)).find((d) => d.id === id && d.status === "decided");
  if (!target) throw new Error("That decision is not in force. Reload the page.");
  if (!canSupersede(target, accountId)) throw new Error("Only the person who confirmed this decision can supersede it.");
  await updateDecisions(projectKey, (current) => supersede(current, [id], new Date().toISOString()));
  await log(projectKey, accountId, "decision_superseded", id);
});

// Adding a decision by hand: the preview counts the open work items it would contradict, the add stores it.
// Both run the same build, so the number shown is the number of the decision that gets saved.
async function manualDecision(ctx: { accountId?: string; extension: { project: { key: string } } }, payload: unknown) {
  if (!ctx.accountId) throw new Error("Adding a decision needs a signed-in person.");
  const input = readManualInput(payload);
  if (typeof input === "string") throw new Error(input);
  const projectKey = String(ctx.extension.project.key);
  await requireAdmin(projectKey);
  const stored = await getDecisions(projectKey);
  const built = buildManualDecision(input, projectKey, stored, ctx.accountId, new Date().toISOString());
  if (!built.ok) throw new Error(built.reason);
  return { projectKey, decision: built.decision };
}

resolver.define("previewDecision", async ({ context, payload }) => {
  const ctx = context as Parameters<typeof manualDecision>[0];
  const { projectKey, decision } = await manualDecision(ctx, payload);
  const open = await openItemsAsUser(projectKey);
  const hit = impactOf(decision, open.items.map((i) => i.item));
  return { count: hit.length, keys: hit.slice(0, 10).map((h) => h.key), scanned: open.items.length, capped: open.capped };
});

resolver.define("addDecision", async ({ context, payload }) => {
  const ctx = context as Parameters<typeof manualDecision>[0];
  const { projectKey, decision } = await manualDecision(ctx, payload);
  await updateDecisions(projectKey, (current) => mergeDecisions(current, [decision]));
  await log(projectKey, ctx.accountId, "decision_added", decision.id);
});

// Everything the app holds for one project, for a project administrator: decisions, the handoffs of the open
// work items the administrator can see, and the activity list. Read only.
resolver.define("exportProject", async ({ context }) => {
  const projectKey = String((context as { extension: { project: { key: string } } }).extension.project.key);
  await requireAdmin(projectKey);
  const [open, decisions, activity] = await Promise.all([openItemsAsUser(projectKey), getDecisions(projectKey), getAudit(projectKey)]);
  const records = await Promise.all(open.items.map((i) => getRecord(i.issueId)));
  const handoffs = open.items.flatMap((i, n) => (records[n] ? [{ key: i.item.key, record: records[n] }] : []));
  return JSON.stringify({ project: projectKey, exportedAt: new Date().toISOString(), openItemsCapped: open.capped, decisions, handoffs, activity }, null, 2);
});

// Deletes what the export above lists. The administrator types the project key, checked here on the server, so
// a stray click or a forged call without the key deletes nothing. Jira itself is never touched.
resolver.define("deleteProjectData", async ({ context, payload }) => {
  const ctx = context as { accountId?: string; extension: { project: { key: string } } };
  const projectKey = String(ctx.extension.project.key);
  await requireAdmin(projectKey);
  if (String((payload as { confirm?: string }).confirm ?? "").trim().toUpperCase() !== projectKey.toUpperCase()) {
    throw new Error(`Type the project key ${projectKey} to confirm. Nothing was deleted.`);
  }
  const open = await openItemsAsUser(projectKey);
  await Promise.all(open.items.map((i) => deleteItemData(i.issueId)));
  await updateDecisions(projectKey, () => []);
  await resetAudit(projectKey, { at: new Date().toISOString(), who: ctx.accountId ?? "unknown", action: "data_deleted", ref: projectKey });
  return { items: open.items.length, capped: open.capped };
});

export const handler = resolver.getDefinitions();

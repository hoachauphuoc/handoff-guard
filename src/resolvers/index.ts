import Resolver from "@forge/resolver";
import { runGatherHandoffContext } from "../actions/core";
import { depsFor } from "../actions/deps";
import { clashText, confirmProposal, dismissProposal, inProject } from "../decisions/confirm";
import { canSupersede, clashes, splitOverlap, storedClashes, supersede } from "../decisions/supersede";
import { unrecordedMarked, type MarkedState } from "../decisions/marked";
import { hypothetical } from "../decisions/hypothetical";
import { buildManualDecision, readManualInput } from "../decisions/manual";
import { leavingView, type LeavingView } from "../decisions/leaving";
import { ruleImpact, type RuleImpact } from "../handoff/impact";
import { buildDecisionsPage, projectOfKey, touches, type DecisionsPageState } from "../decisions/page";
import { ACK_REFUSED, acknowledge, acknowledgeAll, checkReadBack } from "../handoff/acknowledge";
import { mayPrepare, PREPARE_DENIED } from "../handoff/prepare";
import { exampleReadBack } from "../handoff/example";
import { acknowledgeWithReceipt, slotsFor, type Receipt } from "../handoff/receipt";
import { withContingency } from "../handoff/contingency";
import { actionList, contingencyAdvisory, severityText } from "../handoff/ipass";
import { handoffFrom, heldByThirdPerson, walkthroughHandoff } from "../handoff/build";
import { driftByDecision, fingerprintOf, staleAcks } from "../handoff/drift";
import type { AcknowledgeAllReply, HandoffRecord, PanelState, PracticeReadBackReply } from "../handoff/types";
import { explainRefusal } from "../llm";
import { MANAGE_DENIED } from "../authz";
import { monthCounts, type AuditAction, type AuditEvent, type MonthCounts } from "../audit";
import { changesAsUser, doneStatusIdsAsUser, isProjectAdminAsUser, jqlErrorsAsUser, latestOpenItemAsUser, withConditions, openItemsAsUser, projectsAsUser, RECENT_DAYS, recentItemsAsUser, readItemAsUser as readItem } from "../jira";
import { firstProject, startView, type StartProject, type StartView } from "../guide/start";
import { bindingDecisions, checkHandoff } from "../rules/checkHandoff";
import { watchAssignee, watchConflicts } from "../rules/advisories";
import { changeText, suggestFixes } from "../rules/feasible";
import { impactOf } from "../rules/impact";
import { decisionsAsOf, replayAt, replayDiff, replayInstant, type ReplayChange } from "../rules/replay";
import { bounceOf, lastAcknowledgedAt } from "../autopsy/bounce";
import { autopsy, type Autopsy, type AutopsyHandoff } from "../autopsy/causes";
import type { Proposal } from "../decisions/types";
import type { Decision, Finding, ProjectRules } from "../rules/types";
import { hasSamples, mergeDecisions, sampleDecisions, withoutSamples } from "../samples/decisions";
import { readSourceAsUser } from "../source";
import {
  addAudit,
  deleteConditionDrafts,
  deleteDraft,
  deleteItemData,
  deleteRules,
  getAudit,
  getConditionDrafts,
  getDecisions,
  getDraft,
  getProposals,
  getRecord,
  putConditionDrafts,
  putProposals,
  getRules,
  purgeLegacyDecisions,
  putRecord,
  setRule,
  replaceRecord,
  resetAudit,
  updateDecisions,
} from "../store";

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

function overlapFor(proposals: Proposal[], decisions: Decision[], viewerId: string | null): Pick<PanelState, "supersedes" | "supersedeBlocked" | "clash"> {
  const named = (ds: Decision[]) => ds.map((d) => ({ id: d.id, title: d.title }));
  const split = proposals.map((p) => [p.id, splitOverlap(decisions, p.scope, p.constraints, viewerId ?? "")] as const);
  return {
    supersedes: Object.fromEntries(split.map(([id, s]) => [id, named(s.retirable)])),
    supersedeBlocked: Object.fromEntries(split.map(([id, s]) => [id, named(s.kept)])),
    clash: Object.fromEntries(proposals.map((p) => [p.id, named(clashes(decisions, p.scope, p.constraints))])),
  };
}

async function panelState(ctx: Ctx): Promise<PanelState> {
  // One round of reads, not two: this panel is the first thing a judge sees, and each round is a wait. The project
  // and the id are taken from the panel's context so the stored reads start with the Jira read; if Jira says
  // otherwise (a moved work item), the stored reads are done again with what Jira says.
  const reads = (projectKey: string, issueId: string) =>
    Promise.all([getDecisions(projectKey), getRecord(issueId), getProposals(issueId), isProjectAdminAsUser(projectKey), getRules(projectKey), getDraft(issueId)]);
  const guessed = { projectKey: projectOfKey(ctx.extension.issue.key), issueId: String(ctx.extension.issue.id) };
  const [{ item, issueId }, first] = await Promise.all([readItem(ctx.extension.issue.key), reads(guessed.projectKey, guessed.issueId)]);
  const [decisions, record, stored, canManage, rules, savedDraft] =
    item.projectKey === guessed.projectKey && issueId === guessed.issueId ? first : await reads(item.projectKey, issueId);
  const viewerIsReceiver = record !== null && ctx.accountId !== undefined && ctx.accountId === record.toId;
  // A draft is the receiver's to sign; nobody else is shown it.
  const draftReceipt = viewerIsReceiver ? savedDraft : null;
  const proposals = inProject(stored, item.projectKey);
  const viewerId = ctx.accountId ?? null;
  // Decisions that name this project. Samples are loaded per project, so a site-wide count, or an old label
  // decision stored before labels carried a project, would hide the sample button here.
  const own = decisions.filter((d) => touches(d, item.projectKey) && !(d.scope.kind === "label" && d.scope.projectKey === undefined));
  const result = record ? checkHandoff(handoffFrom(item, record, decisions, rules), decisions) : null;
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
    slots: slotsFor(bindingDecisions(decisions, item)),
    draftReceipt,
    hasSamples: hasSamples(decisions, item.projectKey),
    exampleReadBack: exampleReadBack(bindingDecisions(decisions, item)),
    canPrepare: mayPrepare(record, viewerId, item.assigneeId, canManage),
    isReceiver: record !== null && viewerId !== null && viewerId === record.toId,
    gateHeld: record !== null && heldByThirdPerson(item, record),
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

export type StartState = StartView & { projects: StartProject[] };

// The start page reads as the viewer, like the panel; it stores nothing.
resolver.define("getStart", async ({ payload }): Promise<StartState> => {
  const projects = await projectsAsUser();
  const stored = await Promise.all(projects.map((p) => getDecisions(p.key)));
  // Counted as the Decisions page lists them, so the number here matches the In force rows the link opens.
  const inForce = Object.fromEntries(
    projects.map((p, i) => [p.key, (stored[i] ?? []).filter((d) => d.status === "decided" && touches(d, p.key)).length]),
  );
  const asked = typeof payload?.projectKey === "string" ? payload.projectKey : null;
  const project = projects.find((p) => p.key === asked) ?? firstProject(projects, inForce);
  if (!project) return { ...startView({ project: null, inForceCount: 0, itemKey: null }), projects };
  const itemKey = await latestOpenItemAsUser(project.key);
  return { ...startView({ project, inForceCount: inForce[project.key] ?? 0, itemKey }), projects };
});

resolver.define("prepareHandoff", async ({ context, payload }) => {
  const ctx = context as Ctx;
  const toId = String((payload as { toId?: string }).toId ?? "");
  if (!ctx.accountId || !toId) throw new Error("Pick a receiver first.");
  // An Atlassian account id is short and has no spaces; anything else is not a person Jira can name.
  if (!/^[A-Za-z0-9:_-]{1,128}$/.test(toId)) throw new Error("That is not a valid receiver.");
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
  await replaceRecord(issueId, record);
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
  if (!out.ok) throw new Error(ACK_REFUSED[out.reason]);
  await putRecord(issueId, out.record);
  await log(item.projectKey, ctx.accountId, "handoff_acknowledged", ctx.extension.issue.key);
  return panelState(ctx);
});

// Practice only: nothing is stored and no verdict is produced, so one person can see a refusal without a handoff.
resolver.define("practiceReadBack", async ({ context, payload }) => {
  const ctx = context as Ctx;
  const readBack = String((payload as { readBack?: string }).readBack ?? "");
  const { item } = await readItem(ctx.extension.issue.key);
  const [decisions, rules] = await Promise.all([getDecisions(item.projectKey), getRules(item.projectKey)]);
  const binding = bindingDecisions(decisions, item);
  if (binding.length === 0) throw new Error("No decision binds this work item yet. A project administrator can load sample decisions here or add one on the Decisions page.");
  const { problems, contradictions } = checkReadBack(readBack, binding, new Date().toISOString());
  const accepted = problems.length === 0;
  return {
    accepted,
    reasons: problems,
    ...(contradictions.length > 0 ? { explanation: await explainRefusal(readBack, contradictions) } : {}),
    // The same rule check a real handoff gets, with every binding decision read back by a stand-in receiver.
    ...(accepted ? { wouldBe: checkHandoff({ ...walkthroughHandoff(item, ctx.accountId ?? null, binding.map((d) => d.id)), rules }, decisions) } : {}),
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
  if (!out.ok) throw new Error(ACK_REFUSED[out.reason]);
  await putRecord(issueId, out.record);
  await log(item.projectKey, ctx.accountId, "handoff_acknowledged", ctx.extension.issue.key);
  return { state: await panelState(ctx) } satisfies AcknowledgeAllReply;
});

// The typed way to acknowledge: one answer per slot, compared by plain code. A refused receipt comes back as
// reasons and stores nothing. No action or agent reaches this; only the receiver, in the panel.
resolver.define("acknowledgeReceipt", async ({ context, payload }) => {
  const ctx = context as Ctx;
  const raw = (payload as { receipt?: unknown } | null)?.receipt;
  const receipt: Receipt = Object.fromEntries(
    Object.entries(typeof raw === "object" && raw !== null ? raw : {}).flatMap(([k, v]) => (typeof v === "string" ? [[k, v.slice(0, 20)]] : [])),
  );
  const { item, issueId } = await readItem(ctx.extension.issue.key);
  const [decisions, record] = await Promise.all([getDecisions(item.projectKey), getRecord(issueId)]);
  if (!record) throw new Error("No handoff has been prepared for this work item.");
  const out = acknowledgeWithReceipt(record, ctx.accountId ?? null, bindingDecisions(decisions, item), receipt, new Date().toISOString(), fingerprintOf(item));
  if (!out.ok && out.reason === "receipt") {
    await log(item.projectKey, ctx.accountId, "readback_refused", ctx.extension.issue.key);
    return { reasons: out.problems } satisfies AcknowledgeAllReply;
  }
  if (!out.ok) throw new Error(ACK_REFUSED[out.reason]);
  await putRecord(issueId, out.record);
  // The signed receipt is the record now; a draft left behind would be offered again.
  await deleteDraft(issueId);
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
  let refused: string | null = null;
  // Worked out from the decisions as they are at the moment of saving, not from an earlier read.
  await updateDecisions(item.projectKey, (current) => {
    const out = confirmProposal(proposals, current, id, ctx.accountId as string, new Date().toISOString(), retire);
    if (!out.ok) {
      if (out.reason === "clash") refused = clashText(out.with.map((d) => d.title), out.with.every((d) => canSupersede(d, ctx.accountId as string)));
      return current;
    }
    remaining = out.proposals;
    return out.decisions;
  });
  if (refused !== null) throw new Error(refused);
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
  const guessed = projectOfKey(ctx.extension.issue.key);
  const [src, first] = await Promise.all([readSourceAsUser(ctx.extension.issue.key), getDecisions(guessed)]);
  // A moved work item keeps its old key; its decisions are those of the project Jira reports.
  const decisions = src.projectKey === guessed ? first : await getDecisions(src.projectKey);
  return {
    notInLedger: unrecordedMarked(src.parts, decisions),
    truncated: src.truncated,
  };
});

// The Decisions project page. Open items are read as the viewer, so the counts only cover work the viewer
// may see, and the page says when the cap cut the list. Nothing is written.
const ACTIVITY_SHOWN = 20;

/** A condition Rovo drafted, as the Decisions page shows it: not in force until a person confirms it. */
export type DraftView = { id: string; title: string; jql: string; supersedes: { id: string; title: string } | null; at: string };

export type DecisionsPageView = DecisionsPageState & {
  activity: AuditEvent[];
  counts: MonthCounts[];
  clashes: { a: string; b: string }[];
  rules: ProjectRules;
  drafts: DraftView[];
};

resolver.define("getDecisionsPage", async ({ context }): Promise<DecisionsPageView> => {
  const projectKey = String((context as { extension: { project: { key: string } } }).extension.project.key);
  const viewerId = (context as { accountId?: string }).accountId ?? null;
  const [open, decisions, canManage] = await Promise.all([openItemsAsUser(projectKey), getDecisions(projectKey), isProjectAdminAsUser(projectKey)]);
  const [audit, rules, drafts] = await Promise.all([getAudit(projectKey), getRules(projectKey), getConditionDrafts(projectKey)]);
  const records = await Promise.all(open.items.map((i) => getRecord(i.issueId)));
  const titleOf = (id: string) => decisions.find((d) => d.id === id)?.title ?? id;
  return {
    ...buildDecisionsPage(
      projectKey,
      decisions,
      open.items.map((i, n) => ({ item: i.item, record: records[n] ?? null })),
      open.capped,
      new Date().toISOString(),
      viewerId,
      canManage,
      rules,
    ),
    rules,
    clashes: storedClashes(decisions.filter((d) => touches(d, projectKey))).map((c) => ({ a: c.a.title, b: c.b.title })),
    activity: audit.slice(0, ACTIVITY_SHOWN),
    counts: monthCounts(audit),
    drafts: drafts.map((d) => ({ id: d.id, title: d.title, jql: d.jql, supersedes: d.supersedes ? { id: d.supersedes, title: titleOf(d.supersedes) } : null, at: d.at })),
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
    await getRules(projectKey),
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
async function manualDecision(ctx: { accountId?: string; extension: { project: { key: string } } }, payload: unknown, replaces: string | null = null) {
  if (!ctx.accountId) throw new Error("Adding a decision needs a signed-in person.");
  const input = readManualInput(payload);
  if (typeof input === "string") throw new Error(input);
  const projectKey = String(ctx.extension.project.key);
  await requireAdmin(projectKey);
  const stored = await getDecisions(projectKey);
  const built = buildManualDecision(input, projectKey, stored, ctx.accountId, new Date().toISOString(), replaces);
  if (!built.ok) throw new Error(built.reason);
  for (const c of built.decision.constraints) {
    if (c.kind !== "condition") continue;
    const errors = await jqlErrorsAsUser(c.jql);
    if (errors.length > 0) throw new Error(`Jira cannot run this filter: ${errors.join(" ")} Nothing was saved.`);
  }
  return { projectKey, stored, decision: built.decision, retire: built.retire };
}

resolver.define("previewDecision", async ({ context, payload }) => {
  const ctx = context as Parameters<typeof manualDecision>[0];
  // The preview is built as if the person had agreed to supersede, so it can name what saving would retire.
  const { projectKey, decision, stored } = await manualDecision(ctx, { ...(payload as object), supersede: true });
  const open = await openItemsAsUser(projectKey);
  // A new filter has no answer yet; Jira is asked for it here, and items it could not answer are counted apart.
  const items = (await withConditions(open.items, [decision], "user")).map((i) => i.item);
  const hit = impactOf(decision, items);
  const jqls = decision.constraints.flatMap((c) => (c.kind === "condition" ? [c.jql] : []));
  return {
    unchecked: items.filter((i) => jqls.some((q) => typeof i.conditions?.[q] !== "boolean")).length,
    count: hit.length,
    keys: hit.slice(0, 10).map((h) => h.key),
    scanned: open.items.length,
    capped: open.capped,
    clash: clashes(stored, decision.scope, decision.constraints).map((d) => d.title),
  };
});

resolver.define("addDecision", async ({ context, payload }) => {
  const ctx = context as Parameters<typeof manualDecision>[0];
  const { projectKey, decision, retire } = await manualDecision(ctx, payload);
  const nowIso = new Date().toISOString();
  await updateDecisions(projectKey, (current) => mergeDecisions(supersede(current, retire, nowIso, decision.id), [decision]));
  await log(projectKey, ctx.accountId, "decision_added", decision.id);
});

// A draft from Rovo becomes a decision only here, by a person, through the same build and Jira check as the form.
resolver.define("confirmConditionDraft", async ({ context, payload }) => {
  const ctx = context as Parameters<typeof manualDecision>[0];
  const projectKey = String(ctx.extension.project.key);
  await requireAdmin(projectKey);
  const id = String((payload as { draftId?: string }).draftId ?? "");
  const draft = (await getConditionDrafts(projectKey)).find((d) => d.id === id);
  if (!draft) throw new Error("That draft is no longer waiting. Reload the page.");
  const input = { title: draft.title, scope: "project", constraint: "condition", constraintValue: draft.jql, supersede: draft.supersedes !== null };
  const { decision, retire, stored } = await manualDecision(ctx, input, draft.supersedes);
  const ids = [...retire];
  if (draft.supersedes !== null) {
    const target = stored.find((d) => d.id === draft.supersedes && d.status === "decided");
    if (!target) throw new Error("The decision this draft replaces is no longer in force. Discard the draft or ask Rovo for a new one. Nothing was saved.");
    if (!canSupersede(target, ctx.accountId ?? "")) throw new Error(`Only the person who confirmed "${target.title}" can supersede it. Nothing was saved.`);
    if (!ids.includes(target.id)) ids.push(target.id);
  }
  const nowIso = new Date().toISOString();
  await updateDecisions(projectKey, (current) => mergeDecisions(supersede(current, ids, nowIso, decision.id), [decision]));
  await putConditionDrafts(projectKey, (await getConditionDrafts(projectKey)).filter((d) => d.id !== id));
  await log(projectKey, ctx.accountId, "decision_added", decision.id);
  for (const retired of ids) await log(projectKey, ctx.accountId, "decision_superseded", retired);
});

resolver.define("discardConditionDraft", async ({ context, payload }) => {
  const ctx = context as { accountId?: string; extension: { project: { key: string } } };
  const projectKey = String(ctx.extension.project.key);
  await requireAdmin(projectKey);
  const id = String((payload as { draftId?: string }).draftId ?? "");
  await putConditionDrafts(projectKey, (await getConditionDrafts(projectKey)).filter((d) => d.id !== id));
  await log(projectKey, ctx.accountId, "draft_discarded", id);
});

// A project administrator switches an optional rule on or off. From then on the rule check asks for it in
// every handoff of the project: panel, validator, context row and the Rovo actions read the same setting.
resolver.define("setProjectRule", async ({ context, payload }) => {
  const ctx = context as { accountId?: string; extension: { project: { key: string } } };
  const projectKey = String(ctx.extension.project.key);
  await requireAdmin(projectKey);
  const { rule, on } = (payload ?? {}) as { rule?: unknown; on?: unknown };
  if (!isCatalogueRule(rule)) throw new Error("That is not a rule this project can switch.");
  // Anything but a plain true or false is refused: a malformed call must not read as "switch it off".
  if (typeof on !== "boolean") throw new Error("Say whether the rule is on or off.");
  const next = await setRule(projectKey, rule, on);
  await log(projectKey, ctx.accountId, "rule_changed", `${rule} ${on ? "released" : "retired"}`);
  return next;
});

const CATALOGUE = ["requireContingency", "requireIfThen", "requireReceiverAssigned"] as const;
const isCatalogueRule = (r: unknown): r is (typeof CATALOGUE)[number] => typeof r === "string" && (CATALOGUE as readonly string[]).includes(r);

// Shown to the administrator before a release: how many handoffs that are Clear today would need information.
resolver.define("previewRule", async ({ context, payload }): Promise<RuleImpact> => {
  const projectKey = String((context as { extension: { project: { key: string } } }).extension.project.key);
  await requireAdmin(projectKey);
  const { rule } = (payload ?? {}) as { rule?: unknown };
  if (!isCatalogueRule(rule)) throw new Error("That is not a rule this project can switch.");
  const [open, decisions, rules] = await Promise.all([openItemsAsUser(projectKey), getDecisions(projectKey), getRules(projectKey)]);
  const records = await Promise.all(open.items.map((i) => getRecord(i.issueId)));
  return ruleImpact(open.items.map((i, n) => ({ item: i.item, record: records[n] ?? null })), decisions, rules, rule);
});

const AUTOPSY_CAP = 50;
const AUTOPSY_PARALLEL = 10;

export type AutopsyState = Autopsy & { withHandoff: number; capped: boolean; notClear: number; days: number };

// Looks through the project's stored handoffs for ones that were Clear when the receiver last acknowledged and
// then bounced. Everything is read as the viewer and nothing is written. The verdict "then" uses the decisions
// as they stood at that time and the work item as it is now, the same limit Replay has.
resolver.define("bounceAutopsy", async ({ context }): Promise<AutopsyState> => {
  const projectKey = String((context as { extension: { project: { key: string } } }).extension.project.key);
  const [open, decisions, done] = await Promise.all([recentItemsAsUser(projectKey), getDecisions(projectKey), doneStatusIdsAsUser(projectKey)]);
  const records = await Promise.all(open.items.map((i) => getRecord(i.issueId)));
  const held = open.items.flatMap((i, n) => (records[n] ? [{ item: i.item, record: records[n] as HandoffRecord }] : []));
  const read = held.slice(0, AUTOPSY_CAP);
  // Only handoffs that were Clear need a changelog, so those are picked first.
  const clear = read.flatMap(({ item, record }) => {
    const ack = lastAcknowledgedAt(record);
    const asOf = ack === null ? [] : decisionsAsOf(decisions, ack);
    const then = ack === null ? null : replayAt({ item, fromId: record.fromId, toId: record.toId, acknowledged: record.acknowledged, acknowledgedAt: record.acknowledgedAt, preparedAt: record.preparedAt }, asOf, ack);
    return then !== null && then.verdict === "clear" ? [{ item, record, asOf }] : [];
  });
  const notClear = read.length - clear.length;
  // Up to AUTOPSY_CAP changelogs, read one after another, could outlast the function's time limit; a few at a
  // time keeps the number of Jira calls in flight small.
  const changes: Awaited<ReturnType<typeof changesAsUser>>[] = [];
  for (let n = 0; n < clear.length; n += AUTOPSY_PARALLEL) {
    changes.push(...(await Promise.all(clear.slice(n, n + AUTOPSY_PARALLEL).map(({ item }) => changesAsUser(item.key)))));
  }
  const handoffs: AutopsyHandoff[] = clear.map(({ item, record, asOf }, n) => ({
    key: item.key,
    record,
    bounce: bounceOf(changes[n]!, record, done),
    drifted: Object.values(driftByDecision(record.acknowledged, record.acknowledgedWith, item)).some((d) => d.length > 0),
    bindingCount: bindingDecisions(asOf, item).length,
  }));
  return { ...autopsy(handoffs), withHandoff: held.length, capped: open.capped || held.length > AUTOPSY_CAP, notClear, days: RECENT_DAYS };
});

// What the app holds for one project, for a project administrator: decisions, Rovo's condition drafts, the
// project rules switched on, the activity list, and for each open work item the administrator can see its
// handoff, proposals and unsigned read-back draft. Read only.
resolver.define("exportProject", async ({ context }) => {
  const projectKey = String((context as { extension: { project: { key: string } } }).extension.project.key);
  await requireAdmin(projectKey);
  const [open, decisions, activity, drafts, rules] = await Promise.all([
    openItemsAsUser(projectKey),
    getDecisions(projectKey),
    getAudit(projectKey),
    getConditionDrafts(projectKey),
    getRules(projectKey),
  ]);
  const held = await Promise.all(
    open.items.map(async (i) => ({ key: i.item.key, record: await getRecord(i.issueId), proposals: await getProposals(i.issueId), draft: await getDraft(i.issueId) })),
  );
  const handoffs = held.flatMap((h) => (h.record ? [{ key: h.key, record: h.record }] : []));
  const proposals = held.flatMap((h) => (h.proposals.length > 0 ? [{ key: h.key, proposals: h.proposals }] : []));
  const readBackDrafts = held.flatMap((h) => (h.draft ? [{ key: h.key, draft: h.draft }] : []));
  return JSON.stringify(
    { project: projectKey, exportedAt: new Date().toISOString(), openItemsCapped: open.capped, rules, decisions, drafts, handoffs, proposals, readBackDrafts, activity },
    null,
    2,
  );
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
  await purgeLegacyDecisions(projectKey);
  await deleteConditionDrafts(projectKey);
  await deleteRules(projectKey);
  await resetAudit(projectKey, { at: new Date().toISOString(), who: ctx.accountId ?? "unknown", action: "data_deleted", ref: projectKey });
  return { items: open.items.length, capped: open.capped };
});

export const handler = resolver.getDefinitions();

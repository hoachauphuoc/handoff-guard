import React, { useEffect, useState } from "react";
import ForgeReconciler, { Button, CodeBlock, DatePicker, Heading, Inline, Label, Link, Lozenge, SectionMessage, Select, Stack, Strong, Text, Textfield, User, UserPicker } from "@forge/react";
import { invoke } from "@forge/bridge";
import type { LeavingView } from "../decisions/leaving";
import { AUDIT_TEXT } from "../audit";
import { COMMITMENT_TEXT, LINK_NOTE } from "../decisions/reach";
import { MANAGE_DENIED } from "../authz";
import { plainError } from "../errors";
import { count } from "../plural";
import type { RuleImpact } from "../handoff/impact";
import type { ProjectRule as RuleName } from "../autopsy/causes";
import type { AutopsyState, DecisionsPageView, ReplayState } from "../resolvers";

const VERDICT = { blocked: { text: "Blocked", appearance: "removed" }, needs_info: { text: "Needs info", appearance: "moved" } } as const;

type Preview = { count: number; keys: string[]; scanned: number; capped: boolean; clash: string[]; unchecked: number };
const SCOPES = [
  { label: "The whole project", value: "project" },
  { label: "Work items with a label", value: "label" },
  { label: "One work item", value: "workItem" },
];
const RULES = [
  { label: "Due date no later than", value: "dueNotAfter" },
  { label: "Must carry the label", value: "labelRequired" },
  { label: "Must not carry the label", value: "labelForbidden" },
  { label: "Must have the component", value: "componentRequired" },
  { label: "Must not have the component", value: "componentForbidden" },
  { label: "Must match a Jira filter (JQL)", value: "condition" },
  { label: "A commitment (nothing to check on the work item)", value: "commitment" },
];
const VALUE_LABEL: Record<string, string> = { dueNotAfter: "Latest date", condition: "Jira filter (JQL)" };
const VALUE_HINT: Record<string, string> = { dueNotAfter: "Date, YYYY-MM-DD", condition: "For example: priority = Highest" };
const valueLabel = (kind: string) => VALUE_LABEL[kind] ?? (kind.startsWith("label") ? "Label" : "Component");
const valueHint = (kind: string) => VALUE_HINT[kind] ?? valueLabel(kind);
const EMPTY_FORM = { title: "", scope: "project", scopeValue: "", constraint: "dueNotAfter", constraintValue: "", sourceUrl: "" };

const App = () => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [autopsy, setAutopsy] = useState<AutopsyState | null>(null);
  const [autopsyNote, setAutopsyNote] = useState<string | null>(null);
  const [exported, setExported] = useState<string | null>(null);
  const [deleteKey, setDeleteKey] = useState("");
  const [ruleError, setRuleError] = useState<string | null>(null);
  const [ruleBusy, setRuleBusy] = useState(false);
  const [pending, setPending] = useState<{ rule: RuleName; impact: RuleImpact } | null>(null);
  const [dataNote, setDataNote] = useState<string | null>(null);
  const [state, setState] = useState<DecisionsPageView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replay, setReplay] = useState<ReplayState | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<LeavingView | null>(null);
  const [leavingError, setLeavingError] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);

  // A bad date or a failed read stays beside the control; it does not replace the page.
  const replayOn = (date: string) =>
    invoke<ReplayState>("replayOn", { date }).then(
      (r) => {
        setReplay(r as ReplayState);
        setReplayError(null);
      },
      (e) => setReplayError(plainError(e)),
    );

  const load = () =>
    invoke<DecisionsPageView>("getDecisionsPage").then(
      (s) => setState(s as DecisionsPageView),
      (e) => setError(String(e)),
    );
  // No accountId means the viewer; picking a person reloads for them.
  const loadLeaving = (accountId?: string) => {
    const call = accountId === undefined ? invoke<LeavingView>("getLeaving") : invoke<LeavingView>("getLeaving", { accountId });
    return call.then(
      (v) => {
        setLeaving(v as LeavingView);
        setLeavingError(null);
      },
      (e) => setLeavingError(plainError(e)),
    );
  };

  useEffect(() => {
    void load();
    void loadLeaving();
  }, []);

  // A person retires a decision here; it then binds nothing, and the page is read again.
  const retire = (decisionId: string) =>
    invoke("supersedeDecision", { decisionId }).then(
      () => load(),
      (e) => setError(String(e)),
    );

  // Confirming runs the same checks as the form on the server; a refusal stays beside the drafts.
  const onDraft = (call: "confirmConditionDraft" | "discardConditionDraft", draftId: string) => {
    setDraftBusy(true);
    return invoke(call, { draftId })
      .then(
        () => {
          setDraftError(null);
          return load();
        },
        (e) => setDraftError(plainError(e)),
      )
      .finally(() => setDraftBusy(false));
  };

  // Any edit clears the preview, so the number on screen is always for the decision as it is now written.
  const edit = (patch: Partial<typeof EMPTY_FORM>) => {
    // From the latest state, not the one this render saw: two fields edited in quick succession must not undo each other.
    setForm((f) => ({ ...f, ...patch }));
    setPreview(null);
    setFormError(null);
  };
  const checkForm = () =>
    invoke<Preview>("previewDecision", form).then(
      (p) => {
        setPreview(p as Preview);
        setFormError(null);
      },
      (e) => setFormError(plainError(e)),
    );
  const saveForm = (supersede: boolean) =>
    invoke("addDecision", { ...form, supersede }).then(
      () => {
        setForm(EMPTY_FORM);
        setPreview(null);
        return load();
      },
      (e) => setFormError(plainError(e)),
    );

  const runAutopsy = () => {
    setAutopsyNote("Reading the history of the handoffs…");
    return invoke<AutopsyState>("bounceAutopsy").then(
      (a) => {
        setAutopsy(a as AutopsyState);
        setAutopsyNote(null);
      },
      (e) => setAutopsyNote(plainError(e)),
    );
  };
  const setRule = (rule: RuleName, on: boolean) => {
    setRuleBusy(true);
    setRuleError(null);
    return invoke("setProjectRule", { rule, on })
      .then(
        () => {
          setPending(null);
          return load();
        },
        (e) => {
          setPending(null);
          setRuleError(plainError(e));
        },
      )
      .finally(() => setRuleBusy(false));
  };
  // A release is two steps: the administrator first sees what it would do to today's handoffs.
  const previewRule = (rule: RuleName) => {
    setRuleBusy(true);
    setRuleError(null);
    return invoke<RuleImpact>("previewRule", { rule })
      .then(
        (impact) => setPending({ rule, impact: impact as RuleImpact }),
        (e) => setRuleError(plainError(e)),
      )
      .finally(() => setRuleBusy(false));
  };
  const exportData = () =>
    invoke<string>("exportProject").then(
      (json) => {
        setExported(json as string);
        setDataNote(null);
      },
      (e) => setDataNote(plainError(e)),
    );
  const deleteData = () =>
    invoke<{ items: number; capped: boolean }>("deleteProjectData", { confirm: deleteKey }).then(
      (r) => {
        const done = r as { items: number; capped: boolean };
        setDeleteKey("");
        setExported(null);
        setDataNote(
          `Deleted: this project's decisions and activity, and the handoffs and proposals of ${count(done.items, "open work item")}${
            done.capped ? " (the list was cut at 100; handoffs of other items remain)" : ""
          }. Nothing was changed in Jira.`,
        );
        return load();
      },
      (e) => setDataNote(plainError(e)),
    );

  if (error) {
    return (
      <SectionMessage appearance="error" title="Handoff Guard could not read this project">
        <Text>
          {error.includes("Allow access")
            ? "Allow access: Handoff Guard needs your permission to read work items as you. Click Allow access when Jira asks, then reload the page."
            : error}
        </Text>
      </SectionMessage>
    );
  }
  if (!state) return <Text>Reading the decisions…</Text>;

  return (
    <Stack space="space.200">
      <Text>
        {`Counts cover ${count(state.scanned, "open work item")} of project ${state.projectKey} that you can see${
          state.capped ? "; the list was cut at 100, so the counts are at least these numbers" : ""
        }. Nothing here changes Jira.`}
      </Text>
      <Heading size="small">Decisions</Heading>
      {state.rows.length === 0 && <Text>No decision applies to this project yet. Add one below, or confirm one from the Handoff Guard panel on a work item.</Text>}
      {state.rows.map((d) => (
        <Stack key={d.id} space="space.050">
          <Text>
            <Lozenge appearance={d.status === "decided" ? "success" : "default"}>{d.status === "decided" ? "Decided" : "Superseded"}</Lozenge> {d.title}
          </Text>
          <Text>{d.reach}</Text>
          {d.constraints.length === 0 && <Text>{COMMITMENT_TEXT}</Text>}
          {d.constraints.map((c, i) => (
            <Text key={i}>{c}</Text>
          ))}
          <Text>{`Source: ${d.source}`}</Text>
          {d.link !== null && (
            <Text>
              <Link href={d.link} openNewTab>
                Where it was decided
              </Link>{" "}
              {LINK_NOTE}
            </Text>
          )}
          {d.confirmedBy !== null && (
            <Text>
              Confirmed by <User accountId={d.confirmedBy} />
              {d.confirmedAt ? ` on ${d.confirmedAt.slice(0, 10)}` : ""}
            </Text>
          )}
          {d.supersededAt !== null && (
            <Text>{`Superseded on ${d.supersededAt.slice(0, 10)}${d.supersededBy ? ` by "${d.supersededBy}"` : " by a person"}. It binds nothing.`}</Text>
          )}
          {d.canSupersede && <Button onClick={() => void retire(d.id)}>Supersede</Button>}
          {d.impact !== null && (
            <Text>
              {d.impact.count === 0
                ? "No open work item contradicts it."
                : `${count(d.impact.count, "open work item")} contradict${d.impact.count === 1 ? "s" : ""} it: ${d.impact.keys.join(", ")}${
                    d.impact.count > d.impact.keys.length ? ", …" : ""
                  }`}
            </Text>
          )}
        </Stack>
      ))}
      {state.drafts.length > 0 && (
        <Stack space="space.100">
          <Heading size="small">Drafted with Rovo (not in force)</Heading>
          <Text>These conditions were drafted in a chat with the Handoff Guard agent. They bind no work item until a project administrator confirms them here.</Text>
          {draftError && <SectionMessage appearance="error">{draftError}</SectionMessage>}
          {state.drafts.map((d) => (
            <Stack key={d.id} space="space.050">
              <Text>
                <Strong>{d.title}</Strong>
              </Text>
              <Text>{`Must match the Jira filter: ${d.jql}`}</Text>
              {d.supersedes && <Text>{`Replaces: "${d.supersedes.title}"`}</Text>}
              {state.canManage && (
                <Inline space="space.100">
                  <Button appearance="primary" isDisabled={draftBusy} onClick={() => void onDraft("confirmConditionDraft", d.id)}>
                    {d.supersedes ? `Confirm and supersede "${d.supersedes.title}"` : "Confirm"}
                  </Button>
                  <Button isDisabled={draftBusy} onClick={() => void onDraft("discardConditionDraft", d.id)}>
                    Discard
                  </Button>
                </Inline>
              )}
            </Stack>
          ))}
        </Stack>
      )}
      {!state.canManage && <Text>{`Add a decision: ${MANAGE_DENIED}`}</Text>}
      {state.canManage && (
        <Stack space="space.100">
        {state.clashes.length > 0 && (
          <SectionMessage appearance="warning" title="Decisions in force that say opposite things">
            {state.clashes.map((c, i) => (
              <Text key={i}>{`"${c.a}" and "${c.b}" bind the same work and cannot both be met. Supersede one of them above.`}</Text>
            ))}
          </SectionMessage>
        )}
        <Heading size="small">Add a decision</Heading>
          <Text>
            Write a decision the team made. Check shows how many open work items it would contradict before you save it. It binds work items only after
            you save it; nothing here changes Jira.
          </Text>
          <Label labelFor="decision-title">Title</Label>
          <Textfield id="decision-title" name="decision-title" placeholder="Title, up to 120 characters" value={form.title} onChange={(e: { target: { value?: string } }) => edit({ title: e.target.value ?? "" })} />
          <Label labelFor="decision-scope">Applies to</Label>
          <Select
            inputId="decision-scope"
            name="decision-scope"
            options={SCOPES}
            defaultValue={SCOPES[0]}
            onChange={(o: { value: string }) => edit({ scope: o.value, scopeValue: "" })}
          />
          {form.scope !== "project" && (
            <>
            <Label labelFor="decision-scope-value">{form.scope === "label" ? "Label" : "Work item key"}</Label>
            <Textfield
              id="decision-scope-value"
              name="decision-scope-value"
              placeholder={form.scope === "label" ? "Label" : `Work item key, for example ${state.projectKey}-12`}
              value={form.scopeValue}
              onChange={(e: { target: { value?: string } }) => edit({ scopeValue: e.target.value ?? "" })}
            />
            </>
          )}
          <Label labelFor="decision-rule">The decision says</Label>
          <Select inputId="decision-rule" name="decision-rule" options={RULES} defaultValue={RULES[0]} onChange={(o: { value: string }) => edit({ constraint: o.value, constraintValue: "" })} />
          {form.constraint === "commitment" ? (
            <Text>{COMMITMENT_TEXT}</Text>
          ) : (
            <>
              <Label labelFor="decision-rule-value">{valueLabel(form.constraint)}</Label>
              <Textfield
                id="decision-rule-value"
                name="decision-rule-value"
                placeholder={valueHint(form.constraint)}
                value={form.constraintValue}
                onChange={(e: { target: { value?: string } }) => edit({ constraintValue: e.target.value ?? "" })}
              />
            </>
          )}
          <Label labelFor="decision-source-url">Where it was decided (optional link)</Label>
          <Textfield
            id="decision-source-url"
            name="decision-source-url"
            placeholder="https://… a page, a ticket or a contract"
            value={form.sourceUrl}
            onChange={(e: { target: { value?: string } }) => edit({ sourceUrl: e.target.value ?? "" })}
          />
          <Text>{`The link is shown beside the decision. ${LINK_NOTE}`}</Text>
          <Button onClick={() => void checkForm()}>Check this decision</Button>
          {formError !== null && <Text>{formError}</Text>}
          {preview !== null && (
            <Stack space="space.050">
              <Text>
                {preview.count === 0
                  ? `No open work item contradicts it, among ${count(preview.scanned, "open work item")}${preview.capped ? " (list cut at 100)" : ""}.`
                  : `${count(preview.count, "open work item")} would contradict it: ${preview.keys.join(", ")}${preview.count > preview.keys.length ? ", …" : ""}.`}
              </Text>
              {preview.unchecked > 0 && <Text>{`Jira could not answer the filter for ${count(preview.unchecked, "open work item")}; they are not counted, and their handoffs wait until Jira answers.`}</Text>}
              {preview.clash.length > 0 && (
            <Text>{`It clashes with ${preview.clash.map((t) => `"${t}"`).join(", ")}, in force for the same work. Both cannot be in force, so saving it supersedes the older one.`}</Text>
          )}
          <Button onClick={() => void saveForm(preview.clash.length > 0)}>
            {preview.clash.length > 0 ? `Save and supersede ${preview.clash.map((t) => `"${t}"`).join(", ")}` : "Save decision"}
          </Button>
            </Stack>
          )}
        </Stack>
      )}
      <Heading size="small">Replay on a date</Heading>
      <Text>
        Pick a date to see which prepared handoffs would have had a different verdict then. Only decisions and acknowledgements are replayed;
        work item fields are read as they are now.
      </Text>
      <Label labelFor="replay-date">Replay date</Label>
      <DatePicker id="replay-date" name="replay-date" placeholder="Pick a date" onChange={(v: string) => void replayOn(v)} />
      {replayError !== null && <Text>{replayError}</Text>}
      {replay !== null && (
        <Stack space="space.050">
          <Text>
            {`${replay.changes.length === 0 ? "No handoff differs" : `${count(replay.changes.length, "handoff")} differ${replay.changes.length === 1 ? "s" : ""}`} between ${replay.date} and today, among ${count(replay.scanned, "open work item")}${replay.capped ? " (list cut at 100)" : ""}.`}
          </Text>
          {(replay.leftOut.length > 0 || replay.assumed.length > 0) && (
            <Text>
              {[
                replay.leftOut.length > 0 ? `Left out because their end date was never recorded: ${replay.leftOut.map((t) => `"${t}"`).join(", ")}.` : "",
                replay.assumed.length > 0 ? `Assumed in force throughout because their confirmation date was never recorded: ${replay.assumed.map((t) => `"${t}"`).join(", ")}.` : "",
              ]
                .filter((x) => x !== "")
                .join(" ")}
            </Text>
          )}
          {replay.changes.map((c) => (
            <Text key={c.key}>{`${c.key} ${c.summary}: ${c.then} then, ${c.now} now. ${c.changedBy.length > 0 ? `Changed by: ${c.changedBy.join("; ")}.` : "No decision explains the change."}`}</Text>
          ))}
        </Stack>
      )}
      <Heading size="small">Handoffs that came back (bounce autopsy)</Heading>
      <Text>
        Which handoffs were Clear when the receiver acknowledged and then came back: reassigned to the sender, or reopened, within 7 days. For
        those, what the handoff lacked. Read from this project's Jira history as you; nothing is written and no model takes part.
      </Text>
      <Button onClick={() => void runAutopsy()}>Look for bounced handoffs</Button>
      {autopsyNote !== null && <Text>{autopsyNote}</Text>}
      {autopsy !== null && (
        <Stack space="space.050">
          <Text>
            {`${count(autopsy.withHandoff, "work item")} changed in the last ${autopsy.days} days ${autopsy.withHandoff === 1 ? "has" : "have"} a prepared handoff${autopsy.capped ? " (list cut, so these are at least)" : ""}; ${count(autopsy.total, "handoff")} ${autopsy.total === 1 ? "was" : "were"} Clear at the last acknowledgement, ${autopsy.notClear} ${autopsy.notClear === 1 ? "was" : "were"} not and ${autopsy.notClear === 1 ? "is" : "are"} left out.`}
          </Text>
          {autopsy.bounced.length === 0 ? (
            <Text>
              No Clear handoff bounced. A bounce is a work item that goes back to the sender, or leaves a Done status, within 7 days of the
              receiver's last acknowledgement.
            </Text>
          ) : (
            <>
              <Text>{`${count(autopsy.bounced.length, "Clear handoff")} bounced: ${autopsy.bounced
                .map((b) => `${b.key} (${b.kind === "reopened" ? "reopened" : "returned to the sender"} on ${b.at.slice(0, 10)})`)
                .join(", ")}.`}</Text>
              {autopsy.causes
                .filter((c) => c.bouncedWith > 0)
                .map((c) => (
                  <Text key={c.id}>
                    {`• ${c.text}: ${c.bouncedWith} of ${autopsy.bounced.length} that bounced, ${c.othersWith} of ${autopsy.total - autopsy.bounced.length} that did not.`}
                  </Text>
                ))}
              <Text>These are counts from stored handoffs, not proof of a cause. The work item is read as it is now.</Text>
            </>
          )}
        </Stack>
      )}
      <Heading size="small">Governance: rules this project can release</Heading><Text>A rule is a draft until a project administrator releases it.</Text>
      {ruleError !== null && <Text>{ruleError}</Text>}
      {(
        [
          ["requireContingency", "Require a contingency from the sender", "no_contingency"],
          ["requireIfThen", 'Require the contingency to be written as "if … then …"', "contingency_not_if_then"],
          ["requireReceiverAssigned", "Require the work item to be assigned to the receiver", "receiver_not_assignee"],
        ] as const
      ).map(([rule, label, cause]) => {
        const seen = autopsy?.causes.find((c) => c.id === cause);
        const released = state.rules[rule];
        return (
          <Stack key={rule} space="space.050">
            <Text>
              <Lozenge appearance={released ? "success" : "default"}>{released ? "Released" : "Draft"}</Lozenge> {label}
              {seen && autopsy && autopsy.bounced.length > 0 ? ` (${seen.bouncedWith} of ${autopsy.bounced.length} bounced handoffs lacked this)` : ""}
            </Text>
            {state.canManage && released && <Button isDisabled={ruleBusy} onClick={() => void setRule(rule, false)}>Retire this rule</Button>}
            {state.canManage && !released && <Button isDisabled={ruleBusy} onClick={() => void previewRule(rule)}>See what releasing it would change</Button>}
            {pending?.rule === rule && (
              <Stack space="space.050">
                <Text>
                  {pending.impact.wouldTurn === 0
                    ? `Of ${count(pending.impact.checked, "prepared handoff")} read, none that is Clear now would need information.`
                    : `Of ${count(pending.impact.checked, "prepared handoff")} read, ${pending.impact.wouldTurn} that ${pending.impact.wouldTurn === 1 ? "is" : "are"} Clear now would need information: ${pending.impact.keys.join(", ")}.`}
                </Text>
                <Button appearance="primary" isDisabled={ruleBusy} onClick={() => void setRule(rule, true)}>Release this rule</Button>
                <Button onClick={() => setPending(null)}>Keep it a draft</Button>
              </Stack>
            )}
          </Stack>
        );
      })}
      <Text>
        A released rule is checked by the same rule check as everything else: a handoff that lacks it is Needs info in the panel and is
        refused by the workflow validator. Rules come from this fixed list; code decides, and every release or retirement is written to Activity.
      </Text>
      <Heading size="small">Handoffs in flight</Heading>
      {state.inFlight.length === 0 && <Text>No prepared handoff in this project is waiting on anything.</Text>}
      {state.inFlight.map((h) => (
        <Stack key={h.key} space="space.050">
          <Text>
            <Lozenge appearance={VERDICT[h.verdict].appearance}>{VERDICT[h.verdict].text}</Lozenge> {h.key} {h.summary}
          </Text>
          <Text>
            <User accountId={h.fromId} /> to <User accountId={h.toId} />, prepared {count(h.ageDays, "day")} ago.
          </Text>
          {h.blockedBy.length > 0 && <Text>{`Contradicts: ${h.blockedBy.join("; ")}.`}</Text>}
          {h.unacknowledged > 0 && <Text>{`${count(h.unacknowledged, "decision")} not acknowledged by the receiver.`}</Text>}
        </Stack>
      ))}
      <Heading size="small">Leaving the project</Heading>
      <Text>
        Everything a person still holds in this project: their open work items, handoffs they have not acknowledged, and decisions only they can
        supersede.
      </Text>
      <UserPicker label="Person" name="leaving-person" onChange={(u: { id: string } | null | undefined) => void loadLeaving(u?.id)} />
      {leavingError !== null && <Text>{leavingError}</Text>}
      {leaving === null && leavingError === null && <Text>Reading what this person holds…</Text>}
      {leaving !== null && (
        <>
          {leaving.capped && <Text>{`Only the first ${leaving.scanned} open work items you can see were checked.`}</Text>}
          <Text>Open work items assigned to them</Text>
          {leaving.assigned.length === 0 && <Text>None.</Text>}
          {leaving.assigned.map((a) => (
            <Stack key={a.key} space="space.050">
              <Text>{`${a.key} ${a.summary}`}</Text>
              {a.handoff === "none" ? (
                <Text>Prepare a handoff on this work item.</Text>
              ) : a.handoff.verdict === "clear" ? (
                <Text>Handed over.</Text>
              ) : (
                <Text>
                  Prepared to <User accountId={a.handoff.toId} />: {a.handoff.verdict === "blocked" ? "Blocked" : "Needs info"}. Resolve the findings
                  on the work item.
                </Text>
              )}
            </Stack>
          ))}
          <Text>Handoffs they have not acknowledged</Text>
          {leaving.toAcknowledge.length === 0 && <Text>None.</Text>}
          {leaving.toAcknowledge.map((t) => (
            <Stack key={t.key} space="space.050">
              <Text>{`${t.key} ${t.summary}`}</Text>
              <Text>{`${count(t.waiting, "decision")} to acknowledge with a read-back on the work item.`}</Text>
            </Stack>
          ))}
          <Heading size="small">Decisions only they can supersede</Heading>
          {leaving.decisions.length === 0 && <Text>None.</Text>}
          {leaving.decisions.map((d) => (
            <Stack key={d.id} space="space.050">
              <Text>{d.title}</Text>
              <Text>{d.reach}</Text>
              <Text>Supersede it here, or ask a teammate to record a replacement.</Text>
            </Stack>
          ))}
        </>
      )}
      <Heading size="small">Activity</Heading>
      <Text>
        Who changed decisions and handoffs in this project, newest first. Only the action, the person, the time and the work item or decision are
        kept; nothing anyone typed.
      </Text>
      {state.activity.length === 0 && <Text>Nothing recorded yet.</Text>}
      {state.activity.map((e, i) => (
        <Text key={i}>
          {`${e.at.slice(0, 16).replace("T", " ")} UTC: `}
          <User accountId={e.who} />
          {` ${AUDIT_TEXT[e.action]} (${e.ref}).`}
        </Text>
      ))}
      <Heading size="small">Counts by month</Heading>
      {state.counts.length === 0 && <Text>Nothing to count yet.</Text>}
      {state.counts.map((c) => (
        <Text key={c.month}>
          {`${c.month}: ${count(c.prepared, "handoff")} prepared, ${count(c.acknowledged, "read-back")} accepted, ${count(c.refused, "read-back")} refused, ${count(c.decisions, "decision")} recorded.`}
        </Text>
      ))}
      <Text>Counts come from the activity list above, which keeps the latest 300 entries; older months can be incomplete.</Text>
      {state.canManage && (
        <Stack space="space.100">
          <Heading size="small">Export and delete (project administrators)</Heading>
          <Text>
            Export shows everything the app holds for this project as JSON: decisions, the handoffs of open work items you can see, and the
            activity list. Copy it from the box.
          </Text>
          <Button onClick={() => void exportData()}>Export this project's data</Button>
          {exported !== null && <CodeBlock language="json" text={exported} />}
          <Text>
            Delete removes the same data from the app for good. Handoffs of work items that are already done, or that you cannot see, are not
            reached. Jira is not changed. Export first if you may need it.
          </Text>
          <Label labelFor="delete-key">{`Project key to confirm (${state.projectKey})`}</Label>
          <Textfield
            id="delete-key"
            name="delete-key"
            placeholder={`Type ${state.projectKey} to confirm`}
            value={deleteKey}
            onChange={(e: { target: { value?: string } }) => setDeleteKey(e.target.value ?? "")}
          />
          <Button appearance="danger" onClick={() => void deleteData()}>
            Delete decisions, activity and open items' handoffs
          </Button>
          {dataNote !== null && <Text>{dataNote}</Text>}
        </Stack>
      )}
      <Text>Source: rule check on stored decisions and open work items read as you. Ranked by code: blocked first, then oldest.</Text>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

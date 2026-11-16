import React, { useEffect, useState } from "react";
import ForgeReconciler, { Button, Heading, Label, Link, Lozenge, SectionMessage, Textfield, Stack, Text, TextArea, User, UserPicker } from "@forge/react";
import { invoke, rovo } from "@forge/bridge";
import { MANAGE_DENIED } from "../authz";
import { PREPARE_DENIED } from "../handoff/prepare";
import { plainError } from "../errors";
import type { GatherOutput } from "../actions/schema";
import type { MarkedState } from "../decisions/marked";
import { COMMITMENT_TEXT, constraintText, LINK_NOTE, reachText } from "../decisions/reach";
import { count } from "../plural";
import type { AcknowledgeAllReply, PanelState, PracticeReadBackReply } from "../handoff/types";
import { GUIDE_SOURCE, PATH_NAMES, PRACTICE_NONE, PRACTICE_READBACK_ACCEPTED, PRACTICE_READBACK_BUTTON, PRACTICE_READBACK_HOW, PRACTICE_READBACK_REFUSED, PRACTICE_TITLE, guideView, type GuidePath, type StepNeed, type StepState } from "../guide/steps";
import { HINTS } from "../guide/hints";
import { nextStep, SHOW_EVERYTHING, SHOW_LESS } from "../guide/next";
import { BEFORE_READ_BACK, CONTINGENCY_MAX, READ_BACK_MAX, READ_BACK_MIN, READ_BACK_NOTE } from "../handoff/ipass";
import { explanationNote, type Explanation } from "../handoff/explain";
import { READ_BACK_LIMITS, TEACH_BACK_NOTE } from "../handoff/teachback";
import type { Verdict } from "../rules/types";

const LOOK: Record<Verdict, { text: string; appearance: "success" | "moved" | "removed" }> = {
  clear: { text: "Clear", appearance: "success" },
  needs_info: { text: "Needs info", appearance: "moved" },
  blocked: { text: "Blocked", appearance: "removed" },
};

const STEP_LOOK: Record<StepState, { text: string; appearance: "success" | "inprogress" | "default" | "new" }> = {
  done: { text: "Done", appearance: "success" },
  next: { text: "Next", appearance: "inprogress" },
  todo: { text: "To do", appearance: "default" },
  manual: { text: "Manual", appearance: "new" },
};
const NEEDS: Record<StepNeed, string> = { teammate: "a teammate", rovo: "Rovo", admin: "a Jira admin" };

// One component for the real and the practice refusal, so the model sentence cannot be shown differently.
const ModelExplanation = ({ explanation }: { explanation: Explanation | null }) =>
  explanation ? (
    <>
      {"text" in explanation && (
        <Text>
          <Lozenge appearance="new">Model-written</Lozenge> {explanation.text}
        </Text>
      )}
      <Text>{explanationNote(explanation)}</Text>
    </>
  ) : null;

const CONSENT_TEXT =
  "Allow access: Handoff Guard needs your permission to read this work item as you. Click Allow access when Jira asks, then reload the page.";

const LOADING_TEXT = "Checking the handoff… The first check can take several seconds.";
const NO_DECISIONS_TEXT =
  "No decisions are stored for this project yet. A decision is a recorded rule, such as a due date or a label that work must follow; the rule check compares each handoff against them. Load sample decisions (demo) adds demo ones for this project.";
const NO_BINDING_TEXT = "No recorded decision binds this work item, so there is nothing to read back.";

const App = () => {
  const [state, setState] = useState<PanelState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [confirmAgain, setConfirmAgain] = useState(false);
  const [receipt, setReceipt] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [brief, setBrief] = useState<GatherOutput | null>(null);
  const [rovoNote, setRovoNote] = useState<string | null>(null);
  const [marked, setMarked] = useState<MarkedState | null>(null);
  const [markedError, setMarkedError] = useState<string | null>(null);
  // null: follow the default (open until a handoff exists); a click on the toggle overrides it.
  const [readBack, setReadBack] = useState("");
  const [contingency, setContingency] = useState<string | null>(null);
  // Refusals a person can cause are answers, not failures to check: they appear beside their box and the panel stays.
  const [contingencyNote, setContingencyNote] = useState<string | null>(null);
  const [ackNotes, setAckNotes] = useState<string[]>([]);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [practiceText, setPracticeText] = useState("");
  const [practice, setPractice] = useState<PracticeReadBackReply | null>(null);
  const [practiceNote, setPracticeNote] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState<boolean | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  // The panel opens on the viewer's next step; the rest of today's panel is one click away, nothing is removed.
  const [everything, setEverything] = useState(false);
  const [path, setPath] = useState<GuidePath>("handover");

  // Rovo only explains and proposes. Whatever happens here, the verdict shown above stays the rule check's.
  const askRovo = async (prompt: string) => {
    setRovoNote(null);
    try {
      if (!(await rovo.isEnabled())) {
        setRovoNote("Rovo is not available on this site, so there is no answer from it. The verdict above comes from the rule check.");
        return;
      }
      await rovo.open({ type: "forge", agentKey: "handoff-guard-agent", agentName: "Handoff Guard", prompt });
    } catch (e) {
      setRovoNote(`Rovo could not be opened: ${plainError(e)}. The verdict above comes from the rule check.`);
    }
  };

  // Without the metadata option, invoke resolves to the resolver's value itself.
  const call = (name: string, payload?: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    return invoke<PanelState>(name, payload)
      .then(
        (s) => setState(s as PanelState),
        (e) => setError(plainError(e)),
      )
      .finally(() => setBusy(false));
  };

  // For actions a person can get refused: the reason is shown in place and the panel is left as it was.
  const callInPlace = (name: string, payload: Record<string, unknown>, note: (messages: string[]) => void) => {
    setBusy(true);
    note([]);
    return invoke<PanelState>(name, payload)
      .then(
        (s) => setState(s as PanelState),
        (e) => note([plainError(e)]),
      )
      .finally(() => setBusy(false));
  };

  // A refused read-back comes back as data, with every reason.
  const acknowledgeAll = () => {
    setBusy(true);
    setAckNotes([]);
    setExplanation(null);
    return invoke<AcknowledgeAllReply>("acknowledgeAll", { readBack })
      .then(
        (r) => {
          const reply = r as AcknowledgeAllReply;
          if (reply.state) setState(reply.state);
          else {
            setAckNotes(reply.reasons);
            setExplanation(reply.explanation ?? null);
          }
        },
        (e) => setAckNotes([plainError(e)]),
      )
      .finally(() => setBusy(false));
  };

  // The typed receipt: same reply shape as the read-back, so a refusal is shown in the same place.
  const acknowledgeReceipt = () => {
    setBusy(true);
    setAckNotes([]);
    setExplanation(null);
    return invoke<AcknowledgeAllReply>("acknowledgeReceipt", { receipt })
      .then(
        (r) => {
          const reply = r as AcknowledgeAllReply;
          if (reply.state) setState(reply.state);
          else setAckNotes(reply.reasons);
        },
        (e) => setAckNotes([plainError(e)]),
      )
      .finally(() => setBusy(false));
  };

  // Practice only: the reply says refused or accepted and is shown in place; nothing else on the panel changes.
  const tryPracticeReadBack = () => {
    setBusy(true);
    setPractice(null);
    setPracticeNote(null);
    return invoke<PracticeReadBackReply>("practiceReadBack", { readBack: practiceText })
      .then(
        (r) => setPractice(r as PracticeReadBackReply),
        (e) => setPracticeNote(plainError(e)),
      )
      .finally(() => setBusy(false));
  };

  // The brief is a read: it fills its own section and never touches the verdict state above it.
  const gather = () => {
    setBusy(true);
    setBrief(null);
    return invoke<GatherOutput>("gatherContext")
      .then(
        (b) => setBrief(b as GatherOutput),
        (e) => setError(plainError(e)),
      )
      .finally(() => setBusy(false));
  };

  // Marked decisions are read after the panel, and again after a confirm so the count falls.
  const readMarked = () =>
    invoke<MarkedState>("getMarked").then(
      (m) => {
        setMarked(m as MarkedState);
        setMarkedError(null);
      },
      (e) => setMarkedError(plainError(e)),
    );

  useEffect(() => {
    void call("getPanel").then(() => {
      void readMarked();
    });
  }, []);

  const failed = error && (
    <SectionMessage appearance="error" title={state ? "That action did not go through" : "Handoff Guard could not check this work item"}>
      <Text>{error.includes("Allow access") ? CONSENT_TEXT : error}</Text>
      <Button isDisabled={busy} onClick={() => void call("getPanel")}>
        Reload the check
      </Button>
    </SectionMessage>
  );
  // Before the first check there is nothing to keep; after it, a failed action leaves the panel as it was.
  if (!state) return failed || <Text>{LOADING_TEXT}</Text>;

  const { record, result } = state;
  const guide = guideView(state, path);
  const open = guideOpen ?? (record === null && state.inForceCount > 0);
  const protocol = record?.protocol === 1;
  // Nothing to hand over against until a decision is in force; a record that already exists keeps its controls.
  const canPick = state.canPrepare && (state.inForceCount > 0 || record !== null);
  const isSender = record !== null && state.viewerId === record.fromId;
  const waiting = record && result ? result.binding.filter((d) => !record.acknowledged.includes(d.id) || state.stale.includes(d.id)) : [];
  const next = nextStep(state);
  const show = (...kinds: (typeof next.kind)[]) => everything || kinds.includes(next.kind);
  return (
    <Stack space="space.100">
      {failed}
      {busy && <Text>Working…</Text>}
      {/* A project with no decision in force has one next step, so it comes first and is the only primary button. */}
      {state.inForceCount === 0 && (
        <Stack space="space.100">
          {state.decisionCount === 0 && <Text>{NO_DECISIONS_TEXT}</Text>}
          {!state.hasSamples && !state.canManage && <Text>{MANAGE_DENIED}</Text>}
          {!state.hasSamples && state.canManage && (
            <Button appearance="primary" isDisabled={busy} onClick={() => call("loadSampleDecisions")}>
              Load sample decisions (demo)
            </Button>
          )}
        </Stack>
      )}
      {/* The answer first: the verdict and its findings lead the panel; help, practice and the controls follow. */}
      {record && result && (
        <>
          <Text>
            Handoff <User accountId={record.fromId} /> to <User accountId={record.toId} />:{" "}
            <Lozenge appearance={LOOK[result.verdict].appearance}>{LOOK[result.verdict].text}</Lozenge>
            {/* The I-PASS name is a clinical term; a first-time reader gets it only with everything shown. */}
            {everything && state.severity ? ` (${state.severity})` : ""}
          </Text>
          {!protocol && <Text>{BEFORE_READ_BACK}</Text>}
          {state.gateHeld && (
            <SectionMessage appearance="warning" title="The workflow gate will refuse this work item">
              <Text>It is assigned to someone who is neither the sender nor the receiver. Assign it to the receiver, or prepare the handoff again for the current assignee.</Text>
            </SectionMessage>
          )}
          {record.origin === "reassignment" && (
            <Text>{`Detected from a change of assignee on ${record.preparedAt.slice(0, 10)}. Prepare the handoff again to name a different receiver.`}</Text>
          )}
          {result.findings.map((f, i) => (
            // The hint is panel wording beside the finding; the finding's own message is shown unchanged.
            <Text key={i}>
              • {f.message}
              {open ? ` ${HINTS[f.rule]}` : ""}
            </Text>
          ))}
        </>
      )}
      <SectionMessage appearance="discovery" title={`Your next step: ${next.title}`}>
        <Text>{next.how}</Text>
      </SectionMessage>
      {everything && (
        <Text>
          {PATH_NAMES[path]}: {guide.doneCount} of {guide.total} steps done.
        </Text>
      )}
      {everything &&
        (Object.keys(PATH_NAMES) as GuidePath[]).map((p) => (
          <Button key={p} appearance={p === path ? "primary" : undefined} onClick={() => setPath(p)}>
            {p === path ? `${PATH_NAMES[p]} (selected)` : PATH_NAMES[p]}
          </Button>
        ))}
      {everything && <Button onClick={() => setGuideOpen(!open)}>{open ? "Hide help" : "Show help"}</Button>}
      {everything &&
        open &&
        guide.steps.map((step) => (
          <Stack key={step.id} space="space.050">
            <Text>
              <Lozenge appearance={STEP_LOOK[step.state].appearance}>{STEP_LOOK[step.state].text}</Lozenge> {step.title}
              {step.needs ? ` (needs ${NEEDS[step.needs]})` : ""}
            </Text>
            {(step.state === "next" || step.state === "manual") && <Text>{step.how}</Text>}
            {step.id === "item_ready" && (
              <SectionMessage appearance="information" title={PRACTICE_TITLE}>
                {state.practiceFindings.length === 0 ? (
                  <Text>{PRACTICE_NONE}</Text>
                ) : (
                  state.practiceFindings.map((f, i) => (
                    <Text key={i}>
                      • {f.message} {HINTS[f.rule]}
                    </Text>
                  ))
                )}
              </SectionMessage>
            )}
          </Stack>
        ))}
      {everything && open && <Text>{GUIDE_SOURCE}</Text>}
      {/* A receiver already has the real read-back form; a second box on the same screen invites answering in the wrong one. */}
      {/* A sender can try the check before choosing a receiver; its buttons stay secondary to Prepare handoff. */}
      {show("practice", "prepare") && state.exampleReadBack !== "" && !state.isReceiver && (
        <Stack space="space.100">
          <Heading as="h3" size="small">
            Practice read-back
          </Heading>
          <Text>{PRACTICE_READBACK_HOW}</Text>
          <Text>{READ_BACK_LIMITS}</Text>
          <Label labelFor="practiceReadBack">Your practice read-back</Label>
          <TextArea id="practiceReadBack" name="practiceReadBack" value={practiceText} onChange={(e) => setPracticeText(e.target.value)} />
          <Button isDisabled={busy} onClick={() => setPracticeText(state.exampleReadBack)}>
            Fill an example
          </Button>
          <Button isDisabled={busy} onClick={() => void tryPracticeReadBack()}>
            {PRACTICE_READBACK_BUTTON}
          </Button>
          {practiceNote && <Text>{practiceNote}</Text>}
          {practice?.accepted && (
            <SectionMessage appearance="success" title="Would be accepted">
              <Text>{PRACTICE_READBACK_ACCEPTED}</Text>
            </SectionMessage>
          )}
          {practice && !practice.accepted && (
            <SectionMessage appearance="error" title={PRACTICE_READBACK_REFUSED}>
              {practice.reasons.map((r, i) => (
                <Text key={i}>{r}</Text>
              ))}
              <ModelExplanation explanation={practice.explanation ?? null} />
            </SectionMessage>
          )}
        </Stack>
      )}
      {show("prepare") && canPick && (
        <UserPicker
          label="Receiver"
          name="receiver"
          onChange={(u: { id: string } | null | undefined) => setPicked(u?.id ?? null)}
        />
      )}
      {everything && !state.canPrepare && <Text>{PREPARE_DENIED}</Text>}
      {state.canPrepare && record && confirmAgain && (
        <Text>{`Preparing again clears ${count(record.acknowledged.length, "acknowledgement")} by the receiver and starts over with the receiver you picked.`}</Text>
      )}
      {show("prepare") && canPick && (
        <Button
          appearance="primary"
          isDisabled={busy || picked === null}
          onClick={() => {
            // A prepared handoff holds the receiver's work, so the first click only warns.
            if (record && !confirmAgain) return setConfirmAgain(true);
            setConfirmAgain(false);
            return call("prepareHandoff", { toId: picked });
          }}
        >
          {record ? (confirmAgain ? "Yes, prepare again" : "Prepare again") : "Prepare handoff"}
        </Button>
      )}
      {record && result ? (
        <>
          {everything && state.actions.length > 0 && (
            <SectionMessage appearance="information" title="Action list (one action per finding, worked out by the rule check)">
              <Stack space="space.050">
                {state.actions.map((a, i) => (
                  <Text key={i}>
                    • {a.owner === "sender" ? "Sender" : a.owner === "receiver" ? "Receiver" : "Decision owner"}
                    {a.ownerId ? <> (<User accountId={a.ownerId} />)</> : ""}: {a.text}
                  </Text>
                ))}
              </Stack>
            </SectionMessage>
          )}
          {!everything ? null : state.contingency !== null ? (
            <>
              <Text>{`Contingency from the sender: "${state.contingency.text}"`}</Text>
              {state.contingency.advisory && <Text>{`${state.contingency.advisory} (advisory, not part of the verdict)`}</Text>}
            </>
          ) : (
            <Text>The sender has not written a contingency.</Text>
          )}
          {everything && isSender && (
            <>
              <Text>{`Contingency: if something goes wrong, then what (up to ${CONTINGENCY_MAX} characters).`}</Text>
              <Label labelFor="contingency">Contingency</Label>
              <TextArea
                id="contingency"
                name="contingency"
                defaultValue={state.contingency?.text ?? ""}
                onChange={(e) => setContingency(e.target.value)}
              />
              <Button isDisabled={busy || contingency === null} onClick={() => void callInPlace("saveContingency", { text: contingency }, (m) => setContingencyNote(m[0] ?? null))}>
                Save contingency
              </Button>
            </>
          )}
          {everything && state.advisories.length > 0 && (
            <SectionMessage appearance="information" title="Also worth a look (advisory, not part of the verdict)">
              <Stack space="space.050">
                {state.advisories.map((a, i) => (
                  <Text key={i}>• {a.message}</Text>
                ))}
              </Stack>
            </SectionMessage>
          )}
          {show("read_back") && result.binding.length === 0 && <Text>{NO_BINDING_TEXT}</Text>}
          {show("read_back") &&
            result.binding.map((d) => (
            <Stack key={d.id} space="space.050">
              <Text>
                {d.title} (source: {d.source.kind} {d.source.ref})
              </Text>
              {d.constraints.length === 0 && <Text>{COMMITMENT_TEXT}</Text>}
              {d.source.link && (
                <Text>
                  <Link href={d.source.link} openNewTab>
                    Where it was decided
                  </Link>{" "}
                  {LINK_NOTE}
                </Text>
              )}
              {(state.drift[d.id] ?? []).length > 0 && (
                <Text>{`${state.isReceiver ? "Changed since you acknowledged" : "Changed since the receiver acknowledged"}: ${(state.drift[d.id] ?? []).join("; ")}.`}</Text>
              )}
              {!protocol && state.isReceiver && (!record.acknowledged.includes(d.id) || state.stale.includes(d.id)) && (
                <Button isDisabled={busy} onClick={() => void callInPlace("acknowledgeDecision", { decisionId: d.id }, setAckNotes)}>
                  {state.stale.includes(d.id) ? "Acknowledge again" : "Acknowledge"}
                </Button>
              )}
              {record.acknowledged.includes(d.id) && !state.stale.includes(d.id) && (
                <Text>
                  {state.untracked.includes(d.id) ? "Acknowledged. No baseline was stored, so later changes to the work item are not tracked." : "Acknowledged."}
                </Text>
              )}
            </Stack>
          ))}
          {ackNotes.length > 0 && (
            <SectionMessage appearance="error" title="Not accepted">
              {ackNotes.map((n, i) => (
                <Text key={i}>{n}</Text>
              ))}
              <ModelExplanation explanation={explanation} />
            </SectionMessage>
          )}
          {everything && protocol && record.readBack && <Text>{`Read-back from the receiver: "${record.readBack}"`}</Text>}
          {everything && protocol && record.receipt && (
            <Text>{`Answers from the receiver: ${state.slots
              .filter((s) => record.receipt?.[s.key])
              .map((s) => `${s.title}: ${s.kind === "date" ? record.receipt?.[s.key] : "confirmed"}`)
              .join("; ")}.`}</Text>
          )}
          {show("read_back") && protocol && state.isReceiver && waiting.length > 0 && (
            <>
              <Text>{`Write a read-back (${READ_BACK_MIN} to ${READ_BACK_MAX} characters) that mentions each decision above by its title or by what it sets: a date, a label or a component.`}</Text>
              <Label labelFor="readBack">Your read-back</Label>
              <TextArea
                id="readBack"
                name="readBack"
                onChange={(e) => setReadBack(e.target.value)}
              />
              <Button appearance="primary" isDisabled={busy} onClick={() => void acknowledgeAll()}>
                {state.stale.length > 0 ? "Acknowledge again with a new read-back" : "Acknowledge all with this read-back"}
              </Button>
              <Heading as="h3" size="small">
                Or answer each decision
              </Heading>
              <Text>One typed answer per decision, checked by the same plain code: a date, or a confirmation. Nothing else is stored.</Text>
              {state.draftReceipt !== null && (
                <SectionMessage appearance="information" title="Drafted by Rovo, not signed">
                  <Text>{`Rovo drafted these answers from a chat: ${state.slots
                    .filter((s) => state.draftReceipt?.[s.key])
                    .map((s) => `${s.title}: ${s.kind === "date" ? state.draftReceipt?.[s.key] : "confirmed"}`)
                    .join("; ")}. They acknowledge nothing until you send them yourself.`}</Text>
                  <Button isDisabled={busy} onClick={() => setReceipt({ ...(state.draftReceipt ?? {}) })}>
                    Fill in the draft
                  </Button>
                </SectionMessage>
              )}
              {state.slots.map((s) =>
                s.kind === "date" ? (
                  <Stack key={s.key} space="space.050">
                    <Label labelFor={`slot-${s.key}`}>{`${s.title}: ${s.ask}`}</Label>
                    <Textfield
                      id={`slot-${s.key}`}
                      name={`slot-${s.key}`}
                      placeholder="YYYY-MM-DD"
                      value={receipt[s.key] ?? ""}
                      onChange={(e: { target: { value?: string } }) => {
                        const v = e.target.value ?? "";
                        setReceipt((r) => ({ ...r, [s.key]: v }));
                      }}
                    />
                  </Stack>
                ) : (
                  <Stack key={s.key} space="space.050">
                    <Text>
                      <Lozenge appearance={receipt[s.key] === "yes" ? "success" : "default"}>{receipt[s.key] === "yes" ? "Confirmed" : "Not answered"}</Lozenge>{" "}
                      {`${s.title}: ${s.ask}`}
                    </Text>
                    <Button isDisabled={busy} onClick={() => setReceipt((r) => ({ ...r, [s.key]: r[s.key] === "yes" ? "" : "yes" }))}>
                      {receipt[s.key] === "yes" ? "Undo" : "Confirm"}
                    </Button>
                  </Stack>
                ),
              )}
              <Button isDisabled={busy} onClick={() => void acknowledgeReceipt()}>
                Acknowledge all with these answers
              </Button>
            </>
          )}
          {show("read_back") && protocol && <Text>{`${READ_BACK_NOTE} ${TEACH_BACK_NOTE} ${READ_BACK_LIMITS}`}</Text>}
        </>
      ) : (
        <Text>
          {canPick
            ? "No handoff is prepared for this work item. Pick a receiver above, then click Prepare handoff."
            : "No handoff is prepared for this work item."}
        </Text>
      )}
      {show("fix") && state.fixes.length > 0 && (
        <SectionMessage appearance="warning" title="Suggested fixes">
          <Stack space="space.050">
            <Text>These edits would stop this work item contradicting its decisions:</Text>
            {state.fixes.map((t, i) => (
              <Text key={i}>• {t}</Text>
            ))}
            <Text>Nothing was changed in Jira; a person makes these edits, then runs the check again (reload this panel). Other findings, such as acknowledgements, still apply.</Text>
          </Stack>
        </SectionMessage>
      )}
      {everything && state.proposals.length > 0 && (
        <SectionMessage appearance="information" title="Proposed by Rovo (not binding until you confirm)">
          <Stack space="space.100">
            <Text>
              Confirming adds the decision for everyone who uses Handoff Guard on this site. A handoff that is already prepared will
              then list it as not acknowledged; that is intended.
            </Text>
            {state.proposals.map((p) => (
              <Stack key={p.id} space="space.050">
                <Text>{p.title}</Text>
                <Text>{reachText(p.scope)}</Text>
                <Text>
                  {state.proposalImpact === null
                    ? "The number of open work items this would contradict could not be counted."
                    : state.proposalImpact[p.id] === undefined
                      ? ""
                      : `${count(state.proposalImpact[p.id]!.count, "open work item")} in this project would contradict this decision${
                          state.proposalImpact[p.id]!.capped ? " (at least: only the first 100 open items were checked)" : ""
                        }.`}
                </Text>
                <Text>{`Evidence: "${p.evidence.quote}" (${p.evidence.from})`}</Text>
                {!state.canManage && <Text>{MANAGE_DENIED}</Text>}
                {(state.clash[p.id] ?? []).length > 0 && (
                  <Text>{`It clashes with ${(state.clash[p.id] ?? []).map((d) => `"${d.title}"`).join(", ")}, in force for the same work. Both cannot be in force: it can only be confirmed together with superseding the older one.`}</Text>
                )}
                {state.canManage && (state.clash[p.id] ?? []).length === 0 && (
                  <Button isDisabled={busy} onClick={() => call("confirmProposal", { proposalId: p.id }).then(() => void readMarked())}>
                    Confirm
                  </Button>
                )}
                {state.canManage && (state.supersedes[p.id] ?? []).length > 0 && (
                  <>
                    <Text>{`It overlaps ${(state.supersedes[p.id] ?? []).map((d) => `"${d.title}"`).join(", ")}${(state.clash[p.id] ?? []).length > 0 ? "." : "; confirming it alone leaves both in force."}`}</Text>
                    <Button
                      isDisabled={busy}
                      onClick={() => call("confirmProposal", { proposalId: p.id, supersede: true }).then(() => void readMarked())}
                    >
                      {`Confirm and supersede ${(state.supersedes[p.id] ?? []).map((d) => `"${d.title}"`).join(", ")}`}
                    </Button>
                  </>
                )}
                {(state.supersedeBlocked[p.id] ?? []).length > 0 && (
                  <Text>{`Also made redundant, but only the person who confirmed it can supersede it: ${(state.supersedeBlocked[p.id] ?? []).map((d) => `"${d.title}"`).join(", ")}.`}</Text>
                )}
                {state.canManage && (
                  <Button isDisabled={busy} onClick={() => call("dismissProposal", { proposalId: p.id })}>
                    Dismiss
                  </Button>
                )}
                <Text>Rovo may propose it again later.</Text>
              </Stack>
            ))}
          </Stack>
        </SectionMessage>
      )}
      {everything && markedError !== null && (
        <Text>{`Marked decisions could not be read: ${markedError.includes("Allow access") ? CONSENT_TEXT : markedError}`}</Text>
      )}
      {everything && marked !== null && marked.notInLedger.length > 0 && (
        <SectionMessage appearance="information" title="Marked decisions not in the ledger">
          <Stack space="space.050">
            <Text>
              {`${count(marked.notInLedger.length, "decision")} marked as decided in this work item ${
                marked.notInLedger.length === 1 ? "is" : "are"
              } not in the ledger, so ${marked.notInLedger.length === 1 ? "it binds" : "they bind"} nothing yet:`}
            </Text>
            {marked.notInLedger.slice(0, 5).map((m, i) => (
              <Text key={i}>{`• "${m.text}" (${m.from})`}</Text>
            ))}
            {marked.truncated && <Text>Only the first 20,000 characters of the description and comments were read.</Text>}
            <Text>Ask Rovo to turn them into proposals, then confirm the ones you agree with.</Text>
            <Button onClick={() => void askRovo(`Propose decisions for ${state.issueKey} from its marked decisions.`)}>
              Find decisions with Rovo
            </Button>
          </Stack>
        </SectionMessage>
      )}
      {everything && state.hasSamples && state.canManage && (
        <Button isDisabled={busy} onClick={() => call("removeSampleDecisions")}>
          Remove sample decisions
        </Button>
      )}
      <Button onClick={() => setEverything(!everything)}>{everything ? SHOW_LESS : SHOW_EVERYTHING}</Button>
      {everything && <Button onClick={() => setToolsOpen(!toolsOpen)}>{toolsOpen ? "Hide handoff brief and Rovo tools" : "Show handoff brief and Rovo tools"}</Button>}
      {everything && toolsOpen && (
      <>
      <Stack space="space.100">
        <Text>Handoff brief</Text>
        <Button isDisabled={busy} onClick={() => void gather()}>
          Gather handoff context
        </Button>
        {brief && !brief.ok && (
          <SectionMessage appearance="error" title="Handoff Guard could not gather the context">
            <Text>{brief.error.code === "consent" ? CONSENT_TEXT : brief.error.message}</Text>
          </SectionMessage>
        )}
        {brief && brief.ok && (
          <>
            <Text>
              {`${brief.item.summary}. ${brief.item.dueDate ? `Due ${brief.item.dueDate}` : "No due date"}. Labels: ${
                brief.item.labels.join(", ") || "none"
              }. Components: ${brief.item.components.join(", ") || "none"}.`}
            </Text>
            <Text>{count(brief.binding.length, "decision") + " bind this work item."}</Text>
            {brief.binding.map((d) => (
              <Stack key={d.id} space="space.050">
                <Text>{d.title}</Text>
                {d.constraints.map((c, i) => (
                  <Text key={i}>{constraintText(c)}</Text>
                ))}
              </Stack>
            ))}
            <Text>People connected (Teamwork Graph)</Text>
            {brief.people.status === "ok" ? (
              <>
                {brief.people.sharedWith.length > 0 && <Text>Shared with:</Text>}
                {brief.people.sharedWith.map((id) => (
                  <User key={`s-${id}`} accountId={id} />
                ))}
                {brief.people.mentioned.length > 0 && <Text>Mentioned:</Text>}
                {brief.people.mentioned.map((id) => (
                  <User key={`m-${id}`} accountId={id} />
                ))}
                <Text>{brief.people.note}</Text>
              </>
            ) : (
              <Text>{brief.people.note}</Text>
            )}
            <Button onClick={() => void askRovo(`Write the handoff brief for ${brief.issueKey}.`)}>Write the brief with Rovo</Button>
            <Text>Source: Jira read as you, rule check, Teamwork Graph. Nothing in this section is stored.</Text>
          </>
        )}
      </Stack>
      <Button onClick={() => void askRovo(`Explain the Handoff Guard check for ${state.issueKey}.`)}>Explain with Rovo</Button>
      <Button onClick={() => void askRovo(`Propose decisions for ${state.issueKey} from its description and comments.`)}>
        Find decisions with Rovo
      </Button>
      <Text>Rovo explains and proposes; the verdict comes from the rule check.</Text>
      </>
      )}
      {rovoNote && <Text>{rovoNote}</Text>}
      <Text>Source: rule check, {count(state.decisionCount, "stored decision")} for this project.</Text>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

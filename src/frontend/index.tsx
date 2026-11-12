import React, { useEffect, useState } from "react";
import ForgeReconciler, { Button, Lozenge, SectionMessage, Stack, Text, User, UserPicker } from "@forge/react";
import { invoke, rovo } from "@forge/bridge";
import type { GatherOutput } from "../actions/schema";
import type { MarkedState } from "../decisions/marked";
import { constraintText, reachText } from "../decisions/reach";
import { count } from "../plural";
import type { PanelState } from "../handoff/types";
import { GUIDE_SOURCE, PRACTICE_NONE, PRACTICE_TITLE, guideView, type StepNeed, type StepState } from "../guide/steps";
import { HINTS } from "../guide/hints";
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

const CONSENT_TEXT =
  "Allow access: Handoff Guard needs your permission to read this work item as you. Click Allow access when Jira asks, then reload the page.";

const App = () => {
  const [state, setState] = useState<PanelState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [brief, setBrief] = useState<GatherOutput | null>(null);
  const [rovoNote, setRovoNote] = useState<string | null>(null);
  const [marked, setMarked] = useState<MarkedState | null>(null);
  const [markedError, setMarkedError] = useState<string | null>(null);
  // null: follow the default (open until a handoff exists); a click on the toggle overrides it.
  const [guideOpen, setGuideOpen] = useState<boolean | null>(null);

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
      setRovoNote(`Rovo could not be opened: ${String(e)}. The verdict above comes from the rule check.`);
    }
  };

  // Without the metadata option, invoke resolves to the resolver's value itself.
  const call = (name: string, payload?: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    return invoke<PanelState>(name, payload)
      .then(
        (s) => setState(s as PanelState),
        (e) => setError(String(e)),
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
        (e) => setError(String(e)),
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
      (e) => setMarkedError(String(e)),
    );

  useEffect(() => {
    void call("getPanel").then(() => void readMarked());
  }, []);

  if (error) {
    const consent = error.includes("Allow access");
    return (
      <SectionMessage appearance="error" title="Handoff Guard could not check this work item">
        <Text>{consent
            ? CONSENT_TEXT
            : error}</Text>
      </SectionMessage>
    );
  }
  if (!state) return <Text>Checking the handoff…</Text>;

  const { record, result } = state;
  const guide = guideView(state);
  const open = guideOpen ?? record === null;
  return (
    <Stack space="space.100">
      <Text>
        Getting started: {guide.doneCount} of {guide.total} steps done.
      </Text>
      <Button onClick={() => setGuideOpen(!open)}>{open ? "Hide steps" : "Show steps"}</Button>
      {open &&
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
      {open && <Text>{GUIDE_SOURCE}</Text>}
      <UserPicker
        label="Receiver"
        name="receiver"
        onChange={(u: { id: string } | null | undefined) => setPicked(u?.id ?? null)}
      />
      <Button
        appearance="primary"
        isDisabled={busy || picked === null}
        onClick={() => call("prepareHandoff", { toId: picked })}
      >
        Prepare handoff
      </Button>
      {record && result ? (
        <>
          <Text>
            Handoff <User accountId={record.fromId} /> to <User accountId={record.toId} />:{" "}
            <Lozenge appearance={LOOK[result.verdict].appearance}>{LOOK[result.verdict].text}</Lozenge>
          </Text>
          {record.origin === "reassignment" && (
            <Text>{`Detected from a change of assignee on ${record.preparedAt.slice(0, 10)}. Prepare the handoff again to name a different receiver.`}</Text>
          )}
          {result.findings.map((f, i) => (
            <Text key={i}>• {f.message}</Text>
          ))}
          {state.advisories.length > 0 && (
            <SectionMessage appearance="information" title="Also worth a look (advisory, not part of the verdict)">
              <Stack space="space.050">
                {state.advisories.map((a, i) => (
                  <Text key={i}>• {a.message}</Text>
                ))}
              </Stack>
            </SectionMessage>
          )}
          {result.binding.map((d) => (
            <Stack key={d.id} space="space.050">
              <Text>
                {d.title} (source: {d.source.kind} {d.source.ref})
              </Text>
              {state.isReceiver && !record.acknowledged.includes(d.id) && (
                <Button isDisabled={busy} onClick={() => call("acknowledgeDecision", { decisionId: d.id })}>
                  Acknowledge
                </Button>
              )}
              {record.acknowledged.includes(d.id) && <Text>Acknowledged.</Text>}
            </Stack>
          ))}
        </>
      ) : (
        <Text>No handoff is prepared for this work item. Pick a receiver above, then click Prepare handoff.</Text>
      )}
      {state.fixes.length > 0 && (
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
      {state.proposals.length > 0 && (
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
                <Text>{`Evidence: "${p.evidence.quote}" (${p.evidence.from})`}</Text>
                <Button isDisabled={busy} onClick={() => call("confirmProposal", { proposalId: p.id }).then(() => void readMarked())}>
                  Confirm
                </Button>
                <Button isDisabled={busy} onClick={() => call("dismissProposal", { proposalId: p.id })}>
                  Dismiss
                </Button>
                <Text>Rovo may propose it again later.</Text>
              </Stack>
            ))}
          </Stack>
        </SectionMessage>
      )}
      {markedError !== null && (
        <Text>{`Marked decisions could not be read: ${markedError.includes("Allow access") ? CONSENT_TEXT : markedError}`}</Text>
      )}
      {marked !== null && marked.pagesText !== "" && <Text>{marked.pagesText}</Text>}
      {marked !== null && marked.notInLedger.length > 0 && (
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
            {marked.truncated && <Text>Only the first 20,000 characters of the description, comments and linked pages were read.</Text>}
            <Text>Ask Rovo to turn them into proposals, then confirm the ones you agree with.</Text>
            <Button onClick={() => void askRovo(`Propose decisions for ${state.issueKey} from its marked decisions.`)}>
              Find decisions with Rovo
            </Button>
          </Stack>
        </SectionMessage>
      )}
      {state.decisionCount === 0 && (
        <Button isDisabled={busy} onClick={() => call("loadSampleDecisions")}>
          Load sample decisions (demo)
        </Button>
      )}
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
      <Button onClick={() => void askRovo(`Propose decisions for ${state.issueKey} from its description, comments and linked pages.`)}>
        Find decisions with Rovo
      </Button>
      {rovoNote && <Text>{rovoNote}</Text>}
      <Text>Rovo explains and proposes; the verdict comes from the rule check.</Text>
      <Text>Source: rule check, {count(state.decisionCount, "stored decision")}.</Text>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

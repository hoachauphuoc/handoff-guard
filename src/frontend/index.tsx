import React, { useEffect, useState } from "react";
import ForgeReconciler, { Button, Lozenge, SectionMessage, Stack, Text, User, UserPicker } from "@forge/react";
import { invoke, rovo } from "@forge/bridge";
import type { PanelState } from "../handoff/types";
import type { Verdict } from "../rules/types";

const LOOK: Record<Verdict, { text: string; appearance: "success" | "moved" | "removed" }> = {
  clear: { text: "Clear", appearance: "success" },
  needs_info: { text: "Needs info", appearance: "moved" },
  blocked: { text: "Blocked", appearance: "removed" },
};

const App = () => {
  const [state, setState] = useState<PanelState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rovoNote, setRovoNote] = useState<string | null>(null);

  // Rovo only explains. Whatever happens here, the verdict shown above stays the rule check's.
  const explain = async (issueKey: string) => {
    setRovoNote(null);
    try {
      if (!(await rovo.isEnabled())) {
        setRovoNote("Rovo is not available on this site, so there is no explanation. The verdict above comes from the rule check.");
        return;
      }
      await rovo.open({
        type: "forge",
        agentKey: "handoff-guard-agent",
        agentName: "Handoff Guard",
        prompt: `Explain the Handoff Guard check for ${issueKey}.`,
      });
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

  useEffect(() => {
    void call("getPanel");
  }, []);

  if (error) {
    const consent = error.includes("Allow access");
    return (
      <SectionMessage appearance="error" title="Handoff Guard could not check this work item">
        <Text>{consent ? "Allow access: Handoff Guard needs your permission to read this work item as you." : error}</Text>
      </SectionMessage>
    );
  }
  if (!state) return <Text>Checking the handoff…</Text>;

  const { record, result } = state;
  return (
    <Stack space="space.100">
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
          {result.findings.map((f, i) => (
            <Text key={i}>• {f.message}</Text>
          ))}
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
        <Text>No handoff is prepared for this work item. Pick a receiver and prepare one.</Text>
      )}
      {state.decisionCount === 0 && (
        <Button isDisabled={busy} onClick={() => call("loadSampleDecisions")}>
          Load sample decisions (demo)
        </Button>
      )}
      <Button onClick={() => void explain(state.issueKey)}>Explain with Rovo</Button>
      {rovoNote && <Text>{rovoNote}</Text>}
      <Text>Rovo explains; the verdict comes from the rule check.</Text>
      <Text>Source: rule check, {state.decisionCount} stored decisions.</Text>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

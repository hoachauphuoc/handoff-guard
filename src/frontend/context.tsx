import React, { useEffect, useState } from "react";
import ForgeReconciler, { Lozenge, Stack, Text } from "@forge/react";
import { invoke } from "@forge/bridge";
import { LOOK } from "../handoff/context";
import type { PanelState } from "../handoff/types";
import { count } from "../plural";

// Same resolver as the issue panel, so this summary cannot disagree with it.
const App = () => {
  const [state, setState] = useState<PanelState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<PanelState>("getPanel").then(
      (s) => setState(s as PanelState),
      (e) => setError(String(e)),
    );
  }, []);

  if (error) return <Text>{`Handoff Guard could not check this work item, so there is no verdict: ${error}`}</Text>;
  if (!state) return <Text>Checking the handoff…</Text>;
  if (!state.result) return <Text>No handoff is prepared. Open Handoff Guard to prepare one.</Text>;

  const look = LOOK[state.result.verdict];
  const n = state.result.verdict === "clear" ? 0 : state.result.findings.length;
  return (
    <Stack space="space.050">
      <Lozenge appearance={look.type}>{look.label}</Lozenge>
      <Text>{n > 0 ? `${count(n, "finding")} - open Handoff Guard for details` : "No findings."}</Text>
      <Text>Source: rule check.</Text>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

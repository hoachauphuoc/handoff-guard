import React, { useEffect, useState } from "react";
import ForgeReconciler, { Lozenge, SectionMessage, Stack, Text } from "@forge/react";
import { invoke } from "@forge/bridge";
import type { HandoffResult, Verdict } from "../rules/types";

const LOOK: Record<Verdict, { text: string; appearance: "success" | "moved" | "removed" }> = {
  clear: { text: "Clear", appearance: "success" },
  needs_info: { text: "Needs info", appearance: "moved" },
  blocked: { text: "Blocked", appearance: "removed" },
};

const App = () => {
  const [result, setResult] = useState<HandoffResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Without the metadata option, invoke resolves to the resolver's value itself.
    invoke<HandoffResult>("previewHandoff").then(
      (r) => setResult(r as HandoffResult),
      (e) => setError(String(e)),
    );
  }, []);

  if (error) {
    return (
      <SectionMessage appearance="error" title="Handoff Guard could not check this work item">
        <Text>{error}</Text>
      </SectionMessage>
    );
  }
  if (!result) return <Text>Checking the handoff…</Text>;

  const look = LOOK[result.verdict];
  return (
    <Stack space="space.100">
      <Text>
        Handing this from you to the current assignee: <Lozenge appearance={look.appearance}>{look.text}</Lozenge>
      </Text>
      {result.findings.map((f, i) => (
        <Text key={i}>• {f.message}</Text>
      ))}
      <Text>Source: rule check. No recorded decisions are loaded yet.</Text>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

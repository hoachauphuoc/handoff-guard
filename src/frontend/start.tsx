import React, { useEffect, useState } from "react";
import ForgeReconciler, { Button, Heading, Inline, Label, Lozenge, ProgressTracker, SectionMessage, Select, Stack, Text } from "@forge/react";
import { invoke, router } from "@forge/bridge";
import { GLOSSARY, NO_PROJECT_TEXT, START_INTRO, type StartGo } from "../guide/start";
import { plainError } from "../errors";
import { HOW_IT_WORKS, HOW_IT_WORKS_TITLE } from "../guide/steps";
import type { StartState } from "../resolvers";

const STATE_LOOK = { done: { text: "Done", appearance: "success" }, next: { text: "Next", appearance: "inprogress" }, open: { text: "Then", appearance: "default" } } as const;

// The decisions page is this app's project page; Jira finds it by its module key.
const go = (to: StartGo) =>
  router.navigate(to.kind === "issue" ? { target: "issue", issueKey: to.issueKey } : { target: "module", moduleKey: "handoff-guard-decisions", projectKey: to.projectKey });

const App = () => {
  const [state, setState] = useState<StartState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = (projectKey?: string) =>
    invoke<StartState>("getStart", projectKey ? { projectKey } : {}).then(
      (s) => {
        setState(s as StartState);
        setError(null);
      },
      (e) => setError(plainError(e)),
    );

  useEffect(() => {
    void load();
  }, []);

  const options = (state?.projects ?? []).map((p) => ({ label: `${p.name} (${p.key})`, value: p.key }));
  const chosen = options.find((o) => o.value === state?.project?.key);

  return (
    <Stack space="space.200">
      <Text>{START_INTRO}</Text>
      <SectionMessage appearance="information" title={HOW_IT_WORKS_TITLE}>
        {HOW_IT_WORKS.map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </SectionMessage>
      {error && <SectionMessage appearance="error" title="The start page could not be read">{<Text>{error}</Text>}</SectionMessage>}
      {!state && !error && <Text>Reading your projects…</Text>}
      {state && state.projects.length === 0 && <Text>{NO_PROJECT_TEXT}</Text>}
      {state && state.projects.length > 1 && (
        <Stack space="space.050">
          <Label labelFor="start-project">Project</Label>
          <Select inputId="start-project" name="start-project" options={options} value={chosen} onChange={(o: { value: string }) => void load(o.value)} />
        </Stack>
      )}
      {state && state.steps.length > 0 && (
        <ProgressTracker
          label="Three steps to a first handoff"
          items={state.steps.map((s) => ({
            id: String(s.n),
            label: s.title,
            percentageComplete: s.state === "done" ? 100 : 0,
            status: s.state === "done" ? "visited" : s.state === "next" ? "current" : "unvisited",
          }))}
        />
      )}
      {state?.steps.map((s) => (
        <Stack key={s.n} space="space.100">
          <Inline space="space.100" alignBlock="center">
            <Heading as="h2">{`${s.n}. ${s.title}`}</Heading>
            <Lozenge appearance={STATE_LOOK[s.state].appearance}>{STATE_LOOK[s.state].text}</Lozenge>
          </Inline>
          <Text>{s.how}</Text>
          {s.go && (
            <Button appearance={s.state === "next" ? "primary" : "default"} onClick={() => void go(s.go!)}>
              {s.button}
            </Button>
          )}
        </Stack>
      ))}
      <Heading as="h2">Jira words used here</Heading>
      <Stack space="space.050">
        {GLOSSARY.map((g) => (
          <Text key={g.word}>{`${g.word}: ${g.meaning}`}</Text>
        ))}
      </Stack>
      <Text>Jira's own menus cannot be changed by an app; the buttons above take you past them.</Text>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

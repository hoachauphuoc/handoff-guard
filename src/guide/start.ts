// The start page: one front door for a person who does not know Jira. Pure, so the links and the step
// states are tested without a site.

export type StartProject = { key: string; name: string; type: string };
// Where a step's button goes. Forge moves between pages by module or work item, not by URL.
export type StartGo = { kind: "decisions"; projectKey: string } | { kind: "issue"; issueKey: string };
export type StartStep = { n: number; title: string; how: string; button: string; go: StartGo | null; state: "done" | "next" | "open" };
export type StartView = {
  project: StartProject | null;
  steps: StartStep[];
};

export const START_INTRO =
  "Handoff Guard checks a Jira work item when it moves from one person to another: is anything missing, and does it break a rule your team agreed? Three steps, each with a button that takes you there.";
export const NO_PROJECT_TEXT = "You cannot see any Jira project yet. Ask a Jira administrator to add you to one, or create a project from Projects at the top of Jira.";
// The one sentence for finding the panel, as seen on the site; README and DEVPOST say the same.
export const OPEN_PANEL =
  'Under the work item\'s summary, click the apps icon (its tooltip is "View app actions"), then Handoff Guard; the panel opens below the description.';
export const NO_ITEM_TEXT = "This project has no open work item. Create one with the + Create button at the top of Jira, then come back.";

// Six Jira words the app uses, each in one sentence, for someone who has never used Jira.
export const GLOSSARY: { word: string; meaning: string }[] = [
  { word: "Work item", meaning: "One piece of work, such as a task or a bug, with its own page and a key like MOBL-58." },
  { word: "Project", meaning: "A group of work items that one team looks after; its key is the first part of each work item key." },
  { word: "Assignee", meaning: "The one person a work item is assigned to; handing it over means changing this person." },
  { word: "Workflow", meaning: "The statuses a work item moves through, such as To Do, In Progress and Done." },
  { word: "Transition", meaning: "One move between two statuses; Handoff Guard can stop a move until the handoff is Clear." },
  { word: "Project administrator", meaning: "A person who may change a project's settings; only they can record or retire a decision." },
];

/** The project to show first: the one with the most decisions in force, else the first in the list. */
export function firstProject(projects: StartProject[], inForce: Record<string, number>): StartProject | null {
  let best: StartProject | null = projects[0] ?? null;
  for (const p of projects) if ((inForce[p.key] ?? 0) > (best ? (inForce[best.key] ?? 0) : 0)) best = p;
  return best;
}

export function startView(input: {
  project: StartProject | null;
  inForceCount: number;
  itemKey: string | null;
}): StartView {
  const { project, inForceCount, itemKey } = input;
  if (!project) return { project: null, steps: [] };
  const recorded = inForceCount > 0;
  const item: StartGo | null = itemKey ? { kind: "issue", issueKey: itemKey } : null;
  return {
    project,
    steps: [
      {
        n: 1,
        title: "Record what your team decided",
        how: recorded
          ? `${project.name} has ${inForceCount === 1 ? "1 decision" : `${inForceCount} decisions`} in force. A decision is a rule your team agreed, such as "launch work is due by 15 December".`
          : 'A decision is a rule your team agreed, such as "launch work is due by 15 December". To try the app, open a work item (step 2) and click Load sample decisions (demo); to record your own, open the Decisions page.',
        button: "Open the Decisions page",
        go: { kind: "decisions", projectKey: project.key },
        // Trying the app starts on a work item (sample decisions load from its panel), so with an item to open
        // step 2 is the one filled button; the Decisions page is for recording the team's own.
        state: recorded ? "done" : itemKey ? "open" : "next",
      },
      {
        n: 2,
        title: "Open a work item and find Handoff Guard",
        how: itemKey
          ? `This opens ${itemKey}. ${OPEN_PANEL} There, try a read-back: say in your own words what you will do about each decision; one that breaks a decision is refused.`
          : NO_ITEM_TEXT,
        button: itemKey ? `Open ${itemKey}` : "Open a work item",
        go: item,
        state: itemKey ? "next" : "open",
      },
      {
        n: 3,
        title: "Hand it over",
        how: "In the panel, pick the person who takes the work over and click Prepare handoff. That person opens the same work item, says in their own words what they will do, and confirms. When nothing is missing, the panel reads Clear.",
        button: itemKey ? `Hand over ${itemKey}` : "Hand over a work item",
        go: item,
        state: "open",
      },
    ],
  };
}

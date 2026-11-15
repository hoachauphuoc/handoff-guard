// The start page: one front door for a person who does not know Jira. Pure, so the links and the step
// states are tested without a site.

export type StartProject = { key: string; name: string; type: string };
export type StartStep = { n: number; title: string; how: string; button: string; href: string | null; state: "done" | "next" | "open" };
export type StartView = {
  project: StartProject | null;
  steps: StartStep[];
};

export const START_TITLE = "Handoff Guard: start here";
export const START_INTRO =
  "Handoff Guard checks a Jira work item when it moves from one person to another: is anything missing, and does it break a rule your team agreed? Three steps, each with a button that takes you there.";
export const NO_PROJECT_TEXT = "You cannot see any Jira project yet. Ask a Jira administrator to add you to one, or create a project from Projects at the top of Jira.";
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

// Jira puts an app's project page under the product that owns the project.
const PRODUCT_PATH: Record<string, string> = { software: "software", business: "core", service_desk: "servicedesk" };

// The app and environment ids are in the extension id Forge gives every module.
export function appIds(localId: string | undefined): { appId: string; envId: string } | null {
  const m = /extension\/([0-9a-f-]{36})\/([0-9a-f-]{36})\//.exec(localId ?? "");
  return m ? { appId: m[1]!, envId: m[2]! } : null;
}

export function decisionsHref(project: StartProject, ids: { appId: string; envId: string } | null): string | null {
  if (!ids) return null;
  const product = PRODUCT_PATH[project.type] ?? "software";
  return `/jira/${product}/projects/${encodeURIComponent(project.key)}/apps/${ids.appId}/${ids.envId}`;
}

export function startView(input: {
  project: StartProject | null;
  inForceCount: number;
  itemKey: string | null;
  ids: { appId: string; envId: string } | null;
}): StartView {
  const { project, inForceCount, itemKey, ids } = input;
  if (!project) return { project: null, steps: [] };
  const recorded = inForceCount > 0;
  const item = itemKey ? `/browse/${encodeURIComponent(itemKey)}` : null;
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
        href: decisionsHref(project, ids),
        state: recorded ? "done" : "next",
      },
      {
        n: 2,
        title: "Open a work item and find Handoff Guard",
        how: itemKey
          ? `This opens ${itemKey}. Under its title, click the Handoff Guard button (on some sites: Apps, then Handoff Guard). The panel opens on the right or below. There, try a read-back: say in your own words what you will do about each decision; one that breaks a decision is refused.`
          : NO_ITEM_TEXT,
        button: itemKey ? `Open ${itemKey}` : "Open a work item",
        href: item,
        state: recorded ? "next" : "open",
      },
      {
        n: 3,
        title: "Hand it over",
        how: "In the panel, pick the person who takes the work over and click Prepare handoff. That person opens the same work item, says in their own words what they will do, and confirms. When nothing is missing, the panel reads Clear.",
        button: itemKey ? `Hand over ${itemKey}` : "Hand over a work item",
        href: item,
        state: "open",
      },
    ],
  };
}

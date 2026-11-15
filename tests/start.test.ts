/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import page from "../src/frontend/start.tsx?raw";
import manifest from "../manifest.yml?raw";
import resolvers from "../src/resolvers/index?raw";
import { firstProject, GLOSSARY, startView } from "../src/guide/start";

const project = { key: "MOBL", name: "Mobile", type: "software" };

describe("start page", () => {
  it("shows first the project with the most decisions in force", () => {
    const a = { key: "AAA", name: "A", type: "software" };
    expect(firstProject([a, project], { MOBL: 3 })).toEqual(project);
    expect(firstProject([a, project], {})).toEqual(a);
    expect(firstProject([], {})).toBeNull();
  });

  it("goes to the Decisions page by its module key, which the manifest declares", () => {
    expect(page).toContain('target: "module", moduleKey: "handoff-guard-decisions"');
    expect(manifest).toMatch(/jira:projectPage:\s*\n\s*- key: handoff-guard-decisions/);
    expect(manifest).toMatch(/jira:globalPage:\s*\n\s*- key: handoff-guard-start/);
  });

  it("makes recording decisions the next step until one is in force", () => {
    const v = startView({ project, inForceCount: 0, itemKey: "MOBL-58" });
    expect(v.steps.map((s) => s.state)).toEqual(["next", "open", "open"]);
    expect(v.steps[0]!.go).toEqual({ kind: "decisions", projectKey: "MOBL" });
    expect(v.steps[0]!.how).toContain("Load sample decisions (demo)");
    const w = startView({ project, inForceCount: 3, itemKey: "MOBL-58" });
    expect(w.steps.map((s) => s.state)).toEqual(["done", "next", "open"]);
    expect(w.steps[0]!.how).toContain("3 decisions in force");
  });

  it("links steps 2 and 3 to a real work item, and says so when there is none", () => {
    const v = startView({ project, inForceCount: 1, itemKey: "MOBL-58" });
    expect(v.steps[1]!.go).toEqual({ kind: "issue", issueKey: "MOBL-58" });
    expect(v.steps[1]!.how).toContain("try a read-back");
    const none = startView({ project, inForceCount: 1, itemKey: null });
    expect(none.steps[1]!.go).toBeNull();
    expect(none.steps[1]!.how).toContain("no open work item");
  });

  it("has no steps without a project", () => {
    expect(startView({ project: null, inForceCount: 0, itemKey: null }).steps).toEqual([]);
  });

  it("explains the six Jira words", () => {
    expect(GLOSSARY.map((g) => g.word)).toEqual(["Work item", "Project", "Assignee", "Workflow", "Transition", "Project administrator"]);
  });

  it("stores nothing", () => {
    const start = resolvers.indexOf('resolver.define("getStart"');
    const body = resolvers.slice(start, resolvers.indexOf("resolver.define(", start + 1));
    for (const write of ["put", "addAudit(", "setRule(", "update"]) expect(body).not.toContain(write);
    expect(page).toContain('invoke<StartState>("getStart"');
  });
});

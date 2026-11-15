/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import page from "../src/frontend/start.tsx?raw";
import resolvers from "../src/resolvers/index?raw";
import { appIds, decisionsHref, GLOSSARY, startView } from "../src/guide/start";

const APP = "8d2f4029-5c7f-49b4-a2b7-701a0ca1c1d2";
const ENV = "3b102479-62f0-41c1-832a-15bca48dde09";
const ids = { appId: APP, envId: ENV };
const project = { key: "MOBL", name: "Mobile", type: "software" };

describe("start page", () => {
  it("reads the app and environment ids from the extension id", () => {
    expect(appIds(`ari:cloud:ecosystem::extension/${APP}/${ENV}/static/handoff-guard-start`)).toEqual(ids);
    expect(appIds(undefined)).toBeNull();
    expect(appIds("nonsense")).toBeNull();
  });

  it("links to the Decisions page under the product that owns the project", () => {
    expect(decisionsHref(project, ids)).toBe(`/jira/software/projects/MOBL/apps/${APP}/${ENV}`);
    expect(decisionsHref({ ...project, type: "business" }, ids)).toBe(`/jira/core/projects/MOBL/apps/${APP}/${ENV}`);
    expect(decisionsHref(project, null)).toBeNull();
  });

  it("makes recording decisions the next step until one is in force", () => {
    const v = startView({ project, inForceCount: 0, itemKey: "MOBL-58", ids });
    expect(v.steps.map((s) => s.state)).toEqual(["next", "open", "open"]);
    expect(v.steps[0]!.how).toContain("Load sample decisions (demo)");
    const w = startView({ project, inForceCount: 3, itemKey: "MOBL-58", ids });
    expect(w.steps.map((s) => s.state)).toEqual(["done", "next", "open"]);
    expect(w.steps[0]!.how).toContain("3 decisions in force");
  });

  it("links steps 2 and 3 to a real work item, and says so when there is none", () => {
    const v = startView({ project, inForceCount: 1, itemKey: "MOBL-58", ids });
    expect(v.steps[1]!.href).toBe("/browse/MOBL-58");
    expect(v.steps[1]!.how).toContain("try a read-back");
    const none = startView({ project, inForceCount: 1, itemKey: null, ids });
    expect(none.steps[1]!.href).toBeNull();
    expect(none.steps[1]!.how).toContain("no open work item");
  });

  it("has no steps without a project", () => {
    expect(startView({ project: null, inForceCount: 0, itemKey: null, ids }).steps).toEqual([]);
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

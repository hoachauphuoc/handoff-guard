/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import panel from "../src/frontend/index.tsx?raw";
import stepsRaw from "../src/guide/steps.ts?raw";
import resolvers from "../src/resolvers/index?raw";
import validatorRaw from "../src/validator?raw";
import { PATH_NAMES, STEPS } from "../src/guide/steps";

describe("panel first-use text", () => {
  it("says the first check can take several seconds", () => {
    expect(panel).toContain('const LOADING_TEXT = "Checking the handoff… The first check can take several seconds.";');
    expect(panel).toContain("<Text>{LOADING_TEXT}</Text>");
  });

  it("explains the empty decision store and the empty binding list", () => {
    expect(panel).toContain("const NO_DECISIONS_TEXT =");
    expect(panel).toMatch(/state\.decisionCount === 0 &&[\s\S]*NO_DECISIONS_TEXT/);
    expect(panel).toContain("const NO_BINDING_TEXT =");
    expect(panel).toMatch(/result\.binding\.length === 0 &&[\s\S]*NO_BINDING_TEXT/);
    expect(panel).toMatch(/NO_BINDING_TEXT =\s*"No recorded decision binds this work item, so there is nothing to read back\./);
  });
});

describe("help toggle", () => {
  it("shows a hint beside each finding only while help is on, after the finding's own message", () => {
    expect(panel).toContain('{open ? "Hide help" : "Show help"}');
    expect(panel).toMatch(/• \{f\.message\}\s*\{open \? ` \$\{HINTS\[f\.rule\]\}` : ""\}/);
  });
});

describe("rovo guide step", () => {
  it("warns that Rovo may be absent and keeps the verdict with the rule check", () => {
    const s = STEPS.find((x) => x.id === "rovo")!;
    expect(s.how).toContain("without Rovo");
    expect(s.how).toContain("the verdict still comes from the rule check");
    expect(s.done({} as never)).toBeNull();
  });
});

describe("guide paths in the panel", () => {
  it("lists each path name in the guide source", () => {
    for (const name of Object.values(PATH_NAMES)) expect(stepsRaw).toContain(name);
  });

  it("imports the path names for the switch", () => {
    expect(panel).toMatch(/from\s+"\.\.\/guide\/steps"/);
    expect(panel).toContain("PATH_NAMES");
  });
});

describe("practice read-back", () => {
  it("defines the practice read-back strings in the guide", () => {
    expect(stepsRaw).toContain('PRACTICE_READBACK_BUTTON = "Try a read-back (practice, nothing is saved)"');
    expect(stepsRaw).toContain(
      `PRACTICE_READBACK_ACCEPTED = "This read-back would be accepted. Practice only: nothing is saved and there is no verdict. In a real handoff the receiver's read-back gets this same check."`,
    );
    expect(stepsRaw).toContain('PRACTICE_READBACK_REFUSED = "This read-back would be refused:"');
  });

  it("imports the practice strings in the panel", () => {
    const names = panel.match(/import \{([^}]*)\} from "\.\.\/guide\/steps"/)?.[1] ?? "";
    for (const name of ["PRACTICE_READBACK_BUTTON", "PRACTICE_READBACK_ACCEPTED", "PRACTICE_READBACK_REFUSED"]) expect(names).toContain(name);
  });

  it("stores nothing in the practiceReadBack resolver", () => {
    const start = resolvers.indexOf('resolver.define("practiceReadBack"');
    expect(start).toBeGreaterThan(-1);
    const next = resolvers.indexOf("resolver.define(", start + 1);
    const body = next === -1 ? resolvers.slice(start) : resolvers.slice(start, next);
    for (const write of ["putRecord(", "putDecisions(", "putProposals("]) expect(body).not.toContain(write);
  });
});

describe("who may change decisions", () => {
  const body = (name: string) => {
    const start = resolvers.indexOf(`resolver.define("${name}"`);
    expect(start).toBeGreaterThan(-1);
    const next = resolvers.indexOf("resolver.define(", start + 1);
    return next === -1 ? resolvers.slice(start) : resolvers.slice(start, next);
  };
  it("checks the project administrator on the server before every write to decisions", () => {
    for (const name of ["confirmProposal", "loadSampleDecisions", "removeSampleDecisions", "supersedeDecision", "exportProject", "deleteProjectData"]) expect(body(name)).toContain("requireAdmin(");
    expect(resolvers).toMatch(/async function manualDecision[\s\S]*requireAdmin\(projectKey\)/);
  });
});

describe("load sample decisions", () => {
  it("is offered when nothing is in force, not only when nothing is stored", () => {
    expect(panel).toMatch(/state\.inForceCount === 0 && !state\.hasSamples && state\.canManage && \(\s*<Button[\s\S]{0,80}loadSampleDecisions/);
  });
});

describe("delete project data", () => {
  it("checks the typed project key on the server before anything is deleted", () => {
    const start = resolvers.indexOf('resolver.define("deleteProjectData"');
    const body = resolvers.slice(start, resolvers.indexOf("export const handler", start));
    expect(body.indexOf("Nothing was deleted")).toBeGreaterThan(-1);
    expect(body.indexOf("Nothing was deleted")).toBeLessThan(body.indexOf("deleteItemData("));
    expect(body.indexOf("requireAdmin(")).toBeLessThan(body.indexOf("deleteItemData("));
  });
});

describe("validator", () => {
  it("refuses a Clear handoff when a third person holds the work item", () => {
    expect(validatorRaw).toMatch(/response\.result && heldByThirdPerson\(item, record\) \? \{ result: false, errorMessage: THIRD_PERSON \}/);
  });
});

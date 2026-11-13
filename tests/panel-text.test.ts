/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import panel from "../src/frontend/index.tsx?raw";
import stepsRaw from "../src/guide/steps.ts?raw";
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

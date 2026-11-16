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

describe("a failed action", () => {
  it("keeps the panel, names the reason without the Forge wrapper and offers a reload", () => {
    expect(panel).not.toContain("String(e)");
    expect(panel).toContain("if (!state) return failed || <Text>{LOADING_TEXT}</Text>;");
    expect(panel).toMatch(/<Stack space="space\.100">\s*\{failed\}\s*\{busy && <Text>Working…<\/Text>\}/);
    expect(panel).toContain("Reload the check");
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
      `"No contradiction found in the dates, labels and components the code reads. Practice only: nothing is saved. In a real handoff the receiver's read-back gets this same check."`,
    );
    expect(stepsRaw).toContain('PRACTICE_READBACK_REFUSED = "This read-back would be refused:"');
  });

  it("is offered to a sender whose next step is to prepare, with what the code does not read", () => {
    expect(panel).toContain('show("practice", "prepare") && state.exampleReadBack !== ""');
    // Hidden from a receiver, who has the real form, except after a handoff to oneself, which can never be Clear.
    expect(panel).toContain('(!state.isReceiver || record?.fromId === record?.toId)');
    expect(panel).toContain("<Text>{READ_BACK_LIMITS}</Text>");
    expect(panel).toContain("${TEACH_BACK_NOTE} ${READ_BACK_LIMITS}");
  });

  it("states read-back limits that match what the date reader does", async () => {
    const { datesIn, READ_BACK_LIMITS } = await import("../src/handoff/teachback");
    expect(READ_BACK_LIMITS).toContain('"Q1 2027"');
    expect(datesIn("I will ship by March 2027", "2026-11-16", 2026)).toEqual(["2027-03-01"]);
    expect(datesIn("I will ship on 15 January 2027", "2026-11-16", 2026)).toEqual(["2027-01-15"]);
    expect(datesIn("I will ship in 2027, Q1 2027 or next sprint", "2026-11-16", 2026)).toEqual([]);
  });

  it("imports the practice strings in the panel", () => {
    const names = panel.match(/import \{([^}]*)\} from "\.\.\/guide\/steps"/)?.[1] ?? "";
    for (const name of ["PRACTICE_READBACK_BUTTON", "PRACTICE_READBACK_ACCEPTED", "PRACTICE_READBACK_REFUSED", "PRACTICE_WOULD_BE", "PRACTICE_REAL"]) expect(names).toContain(name);
  });

  it("explains the four words in one example that uses the first sample rule's date", async () => {
    const { HOW_IT_WORKS } = await import("../src/guide/steps");
    const { sampleDecisions } = await import("../src/samples/decisions");
    expect(HOW_IT_WORKS).toHaveLength(3);
    const text = HOW_IT_WORKS.join(" ");
    for (const word of ["decision", "handoff", "read-back", "Clear"]) expect(text).toContain(word);
    expect(sampleDecisions("OPS")[0]!.constraints).toEqual([{ kind: "dueNotAfter", date: "2026-12-31" }]);
    expect(text).toContain("31 December 2026");
    // Shown before the first handoff, and behind Show everything after it.
    expect(panel).toContain("{(!record || everything) && (");
  });

  it("labels the practice verdict as practice that saves nothing, and says a real handoff needs a second person", async () => {
    const { PRACTICE_WOULD_BE, PRACTICE_REAL } = await import("../src/guide/steps");
    expect(PRACTICE_WOULD_BE).toMatch(/^Practice verdict, nothing saved/);
    expect(PRACTICE_REAL).toContain("second person");
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
    for (const name of ["confirmProposal", "dismissProposal", "loadSampleDecisions", "removeSampleDecisions", "supersedeDecision", "exportProject", "deleteProjectData", "setProjectRule"]) expect(body(name)).toContain("requireAdmin(");
    expect(resolvers).toMatch(/async function manualDecision[\s\S]*requireAdmin\(projectKey\)/);
  });
});

describe("a decision with a Jira filter", () => {
  it("is saved only after Jira says it can run the filter", () => {
    const body = resolvers.slice(resolvers.indexOf("async function manualDecision"), resolvers.indexOf('resolver.define("previewDecision"'));
    expect(body).toMatch(/jqlErrorsAsUser\(c\.jql\)[\s\S]*Nothing was saved/);
  });
  it("is previewed with Jira's answer, and items Jira could not answer are counted apart", () => {
    const start = resolvers.indexOf('resolver.define("previewDecision"');
    const body = resolvers.slice(start, resolvers.indexOf("resolver.define(", start + 1));
    expect(body).toContain('withConditions(open.items, [decision], "user")');
    expect(body).toContain("unchecked:");
  });
});

describe("load sample decisions", () => {
  it("is offered when nothing is in force, not only when nothing is stored", () => {
    expect(panel).toMatch(/state\.inForceCount === 0 && \([\s\S]{0,400}!state\.hasSamples && state\.canManage && \(\s*<Button[\s\S]{0,120}loadSampleDecisions/);
  });

  it("comes before the verdict, as a primary button, when nothing is in force", () => {
    expect(panel.indexOf("loadSampleDecisions")).toBeLessThan(panel.indexOf("{record && result && ("));
    expect(panel).toMatch(/appearance="primary" isDisabled=\{busy\} onClick=\{\(\) => call\("loadSampleDecisions"\)\}/);
  });
});

describe("receiver field", () => {
  it("comes right after the next step that names it, before practice", () => {
    const step = panel.indexOf("title={`Your next step: ${next.title}`}");
    const picker = panel.indexOf('label="Receiver"');
    expect(step).toBeGreaterThan(-1);
    expect(picker).toBeGreaterThan(step);
    expect(picker).toBeLessThan(panel.indexOf("Practice: say what you would do (read-back)"));
  });
});

describe("remove sample decisions", () => {
  it("sits last in the full panel, apart from the view toggles, and asks a second click first", () => {
    const at = panel.indexOf('<SectionMessage appearance="warning" title="Remove the demo rules">');
    expect(at).toBeGreaterThan(panel.indexOf("{everything ? SHOW_LESS : SHOW_EVERYTHING}"));
    expect(panel).toMatch(/if \(!confirmRemove\) return setConfirmRemove\(true\);\s*setConfirmRemove\(false\);\s*return call\("removeSampleDecisions"\);/);
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

  it("reaches every per-project key family the export lists", () => {
    const start = resolvers.indexOf('resolver.define("deleteProjectData"');
    const body = resolvers.slice(start, resolvers.indexOf("export const handler", start));
    for (const call of ["deleteItemData(", "updateDecisions(", "purgeLegacyDecisions(", "deleteConditionDrafts(", "deleteRules(", "resetAudit("]) expect(body).toContain(call);
    const exp = resolvers.slice(resolvers.indexOf('resolver.define("exportProject"'), start);
    for (const read of ["getRules(", "getDecisions(", "getConditionDrafts(", "getAudit(", "getRecord(", "getProposals(", "getDraft("]) expect(exp).toContain(read);
  });
});

describe("validator", () => {
  it("refuses a Clear handoff when a third person holds the work item", () => {
    expect(validatorRaw).toMatch(/response\.result && heldByThirdPerson\(item, record\) \? \{ result: false, errorMessage: THIRD_PERSON \}/);
  });

  it("is announced in the panel with the same check, so a Clear panel never meets a closed gate unexplained", () => {
    expect(resolvers).toContain("gateHeld: record !== null && heldByThirdPerson(item, record),");
    expect(panel).toMatch(/state\.gateHeld && \(\s*<SectionMessage appearance="warning" title="The workflow gate will refuse this work item">/);
  });
});

describe("typed receipt", () => {
  it("is acknowledged only through its resolver, which stores nothing when the receipt is refused", () => {
    const start = resolvers.indexOf('resolver.define("acknowledgeReceipt"');
    expect(start).toBeGreaterThan(-1);
    const body = resolvers.slice(start, resolvers.indexOf("resolver.define(", start + 1));
    expect(body.indexOf('out.reason === "receipt"')).toBeLessThan(body.indexOf("putRecord("));
    expect(body).toContain("acknowledgeWithReceipt(record, ctx.accountId ?? null");
  });
  it("offers the typed answers beside the read-back, to the receiver only", () => {
    expect(panel).toContain("Or answer each decision");
    expect(panel).toContain("Acknowledge all with these answers");
  });
});

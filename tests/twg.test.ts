/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import manifest from "../manifest.yml?raw";
import measure from "../scripts/measure.ts?raw";
import coreActions from "../src/actions/core?raw";
import acknowledge from "../src/handoff/acknowledge?raw";
import build from "../src/handoff/build?raw";
import jira from "../src/jira?raw";
import rules from "../src/rules/checkHandoff?raw";
import validator from "../src/validator?raw";
import { QUERIES, accountIdFromAri, issueAri, pageIdFromAri, parseAris, twgLinkedPages, twgPeople, type Deps } from "../src/twg/core";

const node = (id: string) => ({ node: { columns: [{ key: "p", value: { __typename: "CypherQueryResultNode", id } }] } });
const ok = (...ids: string[]) => ({ data: { customQuery: { edges: ids.map(node) } } });
const PAGE = (n: number) => `ari:cloud:confluence:c1:page/${n}`;
const USER = (a: string) => `ari:cloud:identity::user/${a}`;

const deps = (over: Partial<Deps> = {}): Deps => ({ queryKey: () => "key-1", call: async () => ok(), ...over });

describe("Teamwork Graph parse", () => {
  it("reads ARIs from result nodes", () => {
    expect(parseAris(ok(PAGE(1), PAGE(2)))).toEqual({ ok: true, aris: [PAGE(1), PAGE(2)] });
  });

  it("reports an execution error with its code and a missing body as no data", () => {
    expect(parseAris({ data: { customQuery: null }, errors: [{ extensions: { code: "QUERY_NOT_FOUND" } }] })).toEqual({
      ok: false,
      reason: "QUERY_NOT_FOUND",
    });
    expect(parseAris(null)).toEqual({ ok: false, reason: "no data" });
  });

  it("extracts ids from ARIs and builds the work item ARI", () => {
    expect(pageIdFromAri(PAGE(42))).toBe("42");
    expect(pageIdFromAri("ari:cloud:jira:c1:issue/9")).toBeNull();
    expect(accountIdFromAri(USER("712020:abc"))).toBe("712020:abc");
    expect(issueAri("c1", "10001")).toBe("ari:cloud:jira:c1:issue/10001");
  });
});

describe("Teamwork Graph pages", () => {
  it("labels pages as found by Teamwork Graph", async () => {
    const out = await twgLinkedPages(deps({ call: async () => ok(PAGE(7)) }), "ari");
    expect(out).toEqual({ pages: [{ pageId: "7", url: null, foundBy: "Teamwork Graph" }], nothing: false });
  });

  it("returns nothing, not an error, when empty, unconfigured, failing, or without a site id", async () => {
    expect((await twgLinkedPages(deps(), "ari")).nothing).toBe(true);
    expect((await twgLinkedPages(deps({ queryKey: () => null }), "ari")).nothing).toBe(true);
    expect((await twgLinkedPages(deps({ call: async () => { throw new Error("403"); } }), "ari")).nothing).toBe(true);
    expect((await twgLinkedPages(deps({ call: async () => ({ data: { customQuery: null }, errors: [{ message: "x" }] }) }), "ari")).pages).toEqual([]);
    expect((await twgLinkedPages(deps(), null)).nothing).toBe(true);
  });
});

describe("Teamwork Graph people", () => {
  it("returns distinct account ids per relation", async () => {
    const call = async (key: string) => (key === "s" ? ok(USER("a"), USER("a"), USER("b")) : ok(USER("c")));
    const out = await twgPeople(deps({ queryKey: (n) => (n === "shared" ? "s" : "m"), call }), "ari");
    expect(out).toEqual({ sharedWith: ["a", "b"], mentioned: ["c"] });
  });

  it("returns empty lists when there is no ARI", async () => {
    expect(await twgPeople(deps(), null)).toEqual({ sharedWith: [], mentioned: [] });
  });
});

describe("Teamwork Graph boundaries", () => {
  it("uses the relations and scopes the spike confirmed", () => {
    expect(QUERIES.pages).toContain("content_entity_links_entity");
    for (const scope of ["read:graph:issue:jira", "read:graph:page:confluence", "read:graph:user:atlassian"]) {
      expect(manifest).toContain(`- ${scope}`);
    }
    expect(manifest).not.toMatch(/read:graph:(jira|confluence)\s*$/m);
  });

  it("calls the API and provides no connector", () => {
    expect(manifest).not.toMatch(/^\s*(graph:)?connector:/m);
    expect(manifest).not.toMatch(/connector/i);
  });

  it("never reaches the verdict path", () => {
    for (const src of [rules, validator, acknowledge, build, jira, coreActions, measure]) {
      expect(src).not.toMatch(/\/twg|twg\//);
    }
  });
});

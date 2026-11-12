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
import { QUERIES, accountIdFromAri, issueAri, parseAris, twgPeople, type Deps } from "../src/twg/core";

const node = (id: string) => ({ node: { columns: [{ key: "p", value: { __typename: "CypherQueryResultNode", id } }] } });
const ok = (...ids: string[]) => ({ data: { customQuery: { edges: ids.map(node) } } });
const USER = (a: string) => `ari:cloud:identity::user/${a}`;

const deps = (over: Partial<Deps> = {}): Deps => ({ queryKey: () => "key-1", call: async () => ok(), ...over });

describe("Teamwork Graph parse", () => {
  it("reads ARIs from result nodes", () => {
    expect(parseAris(ok(USER("a"), USER("b")))).toEqual({ ok: true, aris: [USER("a"), USER("b")] });
  });

  it("reports an execution error with its code and a missing body as no data", () => {
    expect(parseAris({ data: { customQuery: null }, errors: [{ extensions: { code: "QUERY_NOT_FOUND" } }] })).toEqual({
      ok: false,
      reason: "QUERY_NOT_FOUND",
    });
    expect(parseAris(null)).toEqual({ ok: false, reason: "no data" });
  });

  it("extracts ids from ARIs and builds the work item ARI", () => {
    expect(accountIdFromAri(USER("712020:abc"))).toBe("712020:abc");
    expect(issueAri("c1", "10001")).toBe("ari:cloud:jira:c1:issue/10001");
  });
});

describe("Teamwork Graph people statuses", () => {
  const empty = { sharedWith: [], mentioned: [] };
  it("says not_configured when no query key is set or the site is unknown", async () => {
    expect(await twgPeople(deps({ queryKey: () => null }), "ari")).toEqual({ status: "not_configured", reason: "no_query", ...empty });
    expect(await twgPeople(deps(), null)).toEqual({ status: "not_configured", reason: "no_site", ...empty });
  });

  it("says nothing, not an error, when the call fails or returns no rows", async () => {
    expect(
      await twgPeople(
        deps({
          call: async () => {
            throw new Error("403");
          },
        }),
        "ari",
      ),
    ).toEqual({ status: "nothing", ...empty });
    expect(await twgPeople(deps({ call: async () => ({ data: { customQuery: null }, errors: [{ message: "x" }] }) }), "ari")).toEqual({
      status: "nothing",
      ...empty,
    });
  });

  it("asks with one key when only one is registered", async () => {
    const out = await twgPeople(deps({ queryKey: (n) => (n === "shared" ? "s" : null), call: async () => ok(USER("a")) }), "ari");
    expect(out).toEqual({ status: "ok", sharedWith: ["a"], mentioned: [] });
  });
});

describe("Teamwork Graph people", () => {
  it("returns distinct account ids per relation", async () => {
    const call = async (key: string) => (key === "s" ? ok(USER("a"), USER("a"), USER("b")) : ok(USER("c")));
    const out = await twgPeople(deps({ queryKey: (n) => (n === "shared" ? "s" : "m"), call }), "ari");
    expect(out).toEqual({ status: "ok", sharedWith: ["a", "b"], mentioned: ["c"] });
  });
});

describe("Teamwork Graph boundaries", () => {
  it("uses the relations and scopes the spike confirmed", () => {
    expect(QUERIES.shared).toContain("jira_work_item_shared_with_atlassian_user");
    for (const scope of ["read:graph:issue:jira", "read:graph:user:atlassian"]) {
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
    // The brief may carry people (core does), but the rules, the validator, the shared builders and the
    // measure script know nothing of them.
    for (const src of [rules, validator, acknowledge, build, jira, measure]) {
      expect(src).not.toMatch(/twgPeople|peopleFromGraph|sharedWith/);
    }
  });
});

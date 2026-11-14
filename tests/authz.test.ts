import { describe, expect, it } from "vitest";
import { hasAdminPermission } from "../src/authz";

describe("hasAdminPermission", () => {
  it("is true only when Jira says the permission is held", () => {
    expect(hasAdminPermission({ permissions: { ADMINISTER_PROJECTS: { havePermission: true } } })).toBe(true);
    expect(hasAdminPermission({ permissions: { ADMINISTER_PROJECTS: { havePermission: false } } })).toBe(false);
  });
  it("is false for anything unexpected", () => {
    for (const body of [null, {}, { permissions: {} }, { permissions: { ADMINISTER_PROJECTS: { havePermission: "true" } } }, "yes"]) {
      expect(hasAdminPermission(body)).toBe(false);
    }
  });
});

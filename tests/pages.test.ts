/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { collectPages, MAX_PAGES, pagesFromRemoteLinks, pageStatusText, type PageRead } from "../src/decisions/pages";
import { confirmProposal } from "../src/decisions/confirm";
import { unrecordedMarked } from "../src/decisions/marked";
import rulesSource from "../src/rules/checkHandoff?raw";
import validatorSource from "../src/validator?raw";

const link = (id: string, type = "com.atlassian.confluence") => ({
  globalId: `appId=abc&pageId=${id}`,
  application: { type },
  object: { url: `https://x.atlassian.net/wiki/spaces/S/pages/${id}/T` },
});
const doc = (...c: unknown[]) => ({ type: "doc", content: c });
const decided = (t: string) => ({ type: "decisionList", content: [{ type: "decisionItem", attrs: { state: "DECIDED" }, content: [{ type: "text", text: t }] }] });
const page = (title: string, ...c: unknown[]): PageRead => ({ ok: true, title, body: doc(...c), version: 3 });

describe("pagesFromRemoteLinks", () => {
  it("keeps Confluence links once each, from globalId or URL, and ignores other links and junk", () => {
    const out = pagesFromRemoteLinks([link("1"), link("1"), link("2", "com.atlassian.jira"), { application: { type: "com.atlassian.confluence" }, object: { url: "https://x/wiki/spaces/S/pages/3/T" } }, null, "x"]);
    expect(out.map((p) => p.pageId)).toEqual(["1", "3"]);
    expect(pagesFromRemoteLinks({ not: "array" })).toEqual([]);
  });
});

describe("collectPages", () => {
  it("reads linked pages, marks decisions, and counts pages it could not open", async () => {
    const reads: Record<string, PageRead> = {
      "1": page("Launch plan", decided("Launch work needs the legal-reviewed label")),
      "2": { ok: false },
      "3": page("Empty"),
    };
    const out = await collectPages([{ pageId: "1", url: null }, { pageId: "2", url: null }, { pageId: "3", url: null }], async (id) => reads[id]!);
    expect(out.parts).toEqual([{ from: "Confluence page Launch plan", text: "Launch work needs the legal-reviewed label", marked: ["Launch work needs the legal-reviewed label"], page: { pageId: "1", version: 3 } }]);
    expect(out.status).toEqual({ linksRead: true, linked: 3, read: 1, unreadable: 1, notTried: 0 });
  });

  it("bounds the pages read and the calls made", async () => {
    let calls = 0;
    const links = Array.from({ length: 10 }, (_, i) => ({ pageId: String(i), url: null }));
    const out = await collectPages(links, async () => (calls++, { ok: false }));
    expect(calls).toBe(MAX_PAGES * 2);
    expect(out.status).toMatchObject({ unreadable: MAX_PAGES * 2, notTried: 10 - MAX_PAGES * 2 });
    const ok = await collectPages(links, async (id) => page(`P${id}`, { type: "paragraph", content: [{ type: "text", text: `text ${id}` }] }));
    expect(ok.parts).toHaveLength(MAX_PAGES);
  });
});

describe("pageStatusText names what was not read", () => {
  it("covers links unreadable, none linked, partial and limited", () => {
    expect(pageStatusText({ linksRead: false, linked: 0, read: 0, unreadable: 0, notTried: 0 })).toMatch(/could not be read/);
    expect(pageStatusText({ linksRead: true, linked: 0, read: 0, unreadable: 0, notTried: 0 })).toBe("Confluence: no page is linked to this work item.");
    expect(pageStatusText({ linksRead: true, linked: 2, read: 1, unreadable: 1, notTried: 0 })).toBe(
      "Confluence: read 1 of 2 linked pages; 1 page could not be opened as you (no permission, or Confluence is not installed on this site).",
    );
    expect(pageStatusText({ linksRead: true, linked: 5, read: 3, unreadable: 0, notTried: 2 })).toContain("2 pages not tried (limit 3 pages)");
  });
});

describe("a decision confirmed from a page", () => {
  it("is recorded as a Confluence source and stops being listed as unrecorded", () => {
    const quote = "Launch work needs the legal-reviewed label";
    const proposal = {
      id: "p-1",
      title: "Launch needs legal",
      scope: { kind: "project" as const, projectKey: "OPS" },
      constraints: [{ kind: "labelRequired" as const, label: "legal-reviewed" }],
      evidence: { quote, from: "Confluence page Launch plan" },
      proposedAt: "t",
    };
    const out = confirmProposal([proposal], [], "p-1", "u", "t");
    if (!out.ok) throw new Error("expected ok");
    expect(out.decisions[0]?.source).toEqual({ kind: "confluence", ref: "Launch plan" });
    const parts = [{ from: "Confluence page Launch plan", text: quote, marked: [quote] }];
    expect(unrecordedMarked(parts, [])).toHaveLength(1);
    expect(unrecordedMarked(parts, out.decisions)).toEqual([]);
  });
});

describe("pages stay out of the verdict path", () => {
  it("is not read by the rules or the validator", () => {
    for (const src of [rulesSource, validatorSource]) expect(src).not.toMatch(/confluence|pages/i);
  });
});

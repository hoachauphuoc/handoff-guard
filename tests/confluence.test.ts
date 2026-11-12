import { describe, expect, it } from "vitest";
import {
  MAX_PAGES,
  capParts,
  collectPages,
  dedupePages,
  pageFrom,
  pageUrl,
  pagesFromRemoteLinks,
  storageToText,
} from "../src/decisions/confluence";
import { confirmProposal } from "../src/decisions/confirm";
import type { Proposal, SourcePart } from "../src/decisions/types";
import { validateCandidates } from "../src/decisions/validate";
import { EVIDENCE_HIDDEN, proposalViews } from "../src/decisions/view";

const NOW = "2026-11-12T00:00:00.000Z";
const ctx = { issueKey: "OPS-1", projectKey: "OPS", labels: ["launch"] };

// Shaped like real storage format: headings, a table, an info macro with parameters and a rich-text body,
// a code macro with CDATA, entities and nested tags.
const STORAGE = `<h1>Launch decisions</h1>
<p>We agreed on <strong>1 Dec</strong>: all launch work needs the <em>legal-reviewed</em> label &amp; a due date.</p>
<ac:structured-macro ac:name="info" ac:schema-version="1"><ac:parameter ac:name="title">Heads up</ac:parameter><ac:rich-text-body><p>Marketing owns the copy &ndash; not Dev.</p></ac:rich-text-body></ac:structured-macro>
<table><tbody><tr><th>Item</th><th>Owner</th></tr><tr><td>Banner</td><td><ac:link><ri:user ri:account-id="abc"/></ac:link>Ana</td></tr></tbody></table>
<ac:structured-macro ac:name="code"><ac:plain-text-body><![CDATA[if (a < b && c) { x(); }]]></ac:plain-text-body></ac:structured-macro>
<ul><li>Ship by 2026-12-15</li><li>No&nbsp;changes to &#8220;pricing&#8221; &#x2014; ever</li></ul>
<!-- hidden note --><p>Line one<br/>line two</p>`;

describe("storageToText", () => {
  const text = storageToText(STORAGE);

  it("strips tags and keeps the prose", () => {
    expect(text).toContain("We agreed on 1 Dec: all launch work needs the legal-reviewed label & a due date.");
    expect(text).not.toMatch(/<[a-z/!]/i);
  });

  it("keeps a macro body and drops macro parameters and comments", () => {
    expect(text).toContain("Marketing owns the copy &ndash; not Dev.".replace("&ndash;", "–"));
    expect(text).not.toContain("Heads up");
    expect(text).not.toContain("hidden note");
  });

  it("decodes named, decimal and hex entities once", () => {
    expect(text).toContain("No changes to “pricing” — ever");
    expect(storageToText("<p>&amp;lt;</p>")).toBe("&lt;");
    expect(storageToText("<p>&constructor; &unknown;</p>")).toBe("&constructor; &unknown;");
  });

  it("keeps CDATA text literally and separates table cells and blocks", () => {
    expect(text).toContain("if (a < b && c) { x(); }");
    expect(text).toContain("Item Owner");
    expect(text).toContain("Line one\nline two");
    expect(text).toContain("Ship by 2026-12-15\n");
  });

  it("copes with unclosed or nested markup", () => {
    expect(storageToText("<p><b><i>deep</i></b><p>next")).toBe("deep\nnext");
  });
});

describe("evidence on page text", () => {
  const parts: SourcePart[] = [
    {
      from: pageFrom("555", "remote link"),
      text: storageToText(STORAGE),
      page: { pageId: "555", ref: "https://x.atlassian.net/wiki/spaces/OPS/pages/555" },
    },
  ];
  const cand = (quote: string) => [
    {
      title: "Launch needs legal review",
      scope: { kind: "label", label: "launch" },
      constraints: [{ kind: "labelRequired", label: "legal-reviewed" }],
      evidence: { quote },
    },
  ];

  it("accepts a quote from the stripped text and records the page", () => {
    const { kept, rejected } = validateCandidates(cand("all launch work needs the legal-reviewed label & a due date"), parts, ctx, NOW);
    expect(rejected).toEqual([]);
    expect(kept[0]?.evidence.page).toEqual(parts[0]?.page);
    expect(kept[0]?.evidence.from).toBe("Confluence page 555 (found by remote link)");
  });

  it("accepts a quote that spans a line break in the page", () => {
    expect(validateCandidates(cand("Line one line two"), parts, ctx, NOW).kept).toHaveLength(1);
  });

  it("rejects a quote copied with the markup still in it", () => {
    const out = validateCandidates(cand("all launch work needs the <em>legal-reviewed</em> label"), parts, ctx, NOW);
    expect(out.rejected.map((r) => r.reason)).toEqual(["evidence_not_in_source"]);
  });
});

describe("remote links", () => {
  const links = [
    {
      globalId: "appId=abc&pageId=111",
      application: { type: "com.atlassian.confluence", name: "Confluence" },
      object: { url: "https://x/wiki/pages/viewpage.action?pageId=111" },
    },
    { application: { type: "com.atlassian.confluence" }, object: { url: "https://x.atlassian.net/wiki/spaces/OPS/pages/222/Title" } },
    { application: { type: "com.atlassian.confluence" }, object: { url: "https://x/wiki/pages/viewpage.action?pageId=111" } },
    { application: { type: "com.example.tool" }, object: { url: "https://x/wiki/spaces/OPS/pages/333" } },
    { application: { type: "com.atlassian.confluence" }, object: { url: "https://x/no-id" } },
    null,
  ];

  it("keeps only Confluence links and reads the page id from the globalId or URL", () => {
    const pages = pagesFromRemoteLinks(links);
    expect(pages.map((p) => p.pageId)).toEqual(["111", "222", "111"]);
    expect(pages.every((p) => p.foundBy === "remote link")).toBe(true);
    expect(dedupePages(pages).map((p) => p.pageId)).toEqual(["111", "222"]);
  });

  it("returns nothing for a body that is not a list", () => {
    expect(pagesFromRemoteLinks({ errorMessages: ["x"] })).toEqual([]);
  });

  it("builds a page URL only when the response carries one", () => {
    expect(pageUrl({ _links: { base: "https://x/wiki", webui: "/spaces/OPS/pages/1" } })).toBe("https://x/wiki/spaces/OPS/pages/1");
    expect(pageUrl({})).toBeNull();
  });
});

describe("caps", () => {
  it("cuts the total across Jira and page parts and says so", () => {
    const raw: SourcePart[] = [
      { from: "a", text: "x".repeat(15) },
      { from: "b", text: "y".repeat(15) },
      { from: "c", text: "z" },
    ];
    const out = capParts(raw, 20);
    expect(out.parts.map((p) => p.text.length)).toEqual([15, 5]);
    expect(out.truncated).toBe(true);
    expect(capParts(raw, 100).truncated).toBe(false);
  });

  it("allows at most 3 pages", () => {
    expect(MAX_PAGES).toBe(3);
  });
});

describe("evidence on a page the viewer cannot open", () => {
  const p: Proposal = {
    id: "p-abcd0001",
    title: "Launch needs legal review",
    scope: { kind: "label", label: "launch" },
    constraints: [{ kind: "labelRequired", label: "legal-reviewed" }],
    evidence: { quote: "secret words here", from: pageFrom("555", "remote link"), page: { pageId: "555", ref: "https://x/wiki/pages/555" } },
    proposedAt: NOW,
  };
  const jira: Proposal = { ...p, id: "p-abcd0002", evidence: { quote: "quote from jira", from: "OPS-1 description" } };

  it("withholds the quote and disables Confirm", () => {
    const [hidden, open] = proposalViews([p, jira], new Set());
    expect(hidden?.evidence.quote).toBeNull();
    expect(hidden?.canConfirm).toBe(false);
    expect(open?.evidence.quote).toBe("quote from jira");
    expect(open?.canConfirm).toBe(true);
    expect(EVIDENCE_HIDDEN).toBe("Evidence is on a Confluence page you cannot open");
    expect(proposalViews([p], new Set(["555"]))[0]?.canConfirm).toBe(true);
  });

  it("refuses to confirm unless the re-read as the viewer opened the page", () => {
    expect(confirmProposal([p], [], p.id, "me", NOW)).toEqual({ ok: false, reason: "evidence_not_visible" });
    expect(confirmProposal([p], [], p.id, "me", NOW, new Set(["999"]))).toEqual({ ok: false, reason: "evidence_not_visible" });
  });

  it("confirms with a Confluence source pointing at the page URL", () => {
    const out = confirmProposal([p], [], p.id, "me", NOW, new Set(["555"]));
    expect(out.ok && out.decisions[0]?.source).toEqual({ kind: "confluence", ref: "https://x/wiki/pages/555" });
    const j = confirmProposal([jira], [], jira.id, "me", NOW);
    expect(j.ok && j.decisions[0]?.source).toEqual({ kind: "jira", ref: "OPS-1" });
  });
});

describe("collecting linked pages", () => {
  const link = (id: string) => ({ pageId: id, url: `https://x/wiki/pages/${id}`, foundBy: "remote link" as const });
  const read = (open: string[]) => async (id: string) =>
    open.includes(id) ? ({ ok: true, text: `text ${id}`, url: null } as const) : ({ ok: false } as const);

  it("skips a page the viewer cannot open and counts it", async () => {
    const out = await collectPages([link("1"), link("2")], read(["2"]));
    expect(out.unreadable).toBe(1);
    expect(out.parts.map((p) => p.text)).toEqual(["text 2"]);
    expect(out.parts[0]?.page).toEqual({ pageId: "2", ref: "https://x/wiki/pages/2" });
  });

  it("reads each page once and stops at 3 readable pages, saying the rest were cut", async () => {
    const out = await collectPages([link("1"), link("1"), link("2"), link("3"), link("4")], read(["1", "2", "3", "4"]));
    expect(out.parts).toHaveLength(3);
    expect(out.truncated).toBe(true);
  });

  it("bounds the attempts when every page is closed", async () => {
    const out = await collectPages(["1", "2", "3", "4", "5", "6", "7"].map(link), read([]));
    expect(out.unreadable).toBe(6);
    expect(out.parts).toEqual([]);
  });
});

// Reads Jira's document format (ADF). Pure: no Forge imports. Only text is taken out; nothing is
// rendered, and anything unknown is skipped rather than guessed at.

type Node = { type?: unknown; text?: unknown; attrs?: unknown; content?: unknown };

const INLINE = new Set(["text", "hardBreak", "mention", "emoji", "inlineCard", "status", "date", "mediaInline"]);
const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null && !Array.isArray(v);
const kids = (n: Node): Node[] => (Array.isArray(n.content) ? n.content.filter(isNode) : []);
const attr = (n: Node, k: string): unknown => (isNode(n.attrs) ? (n.attrs as Record<string, unknown>)[k] : undefined);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

function inlineText(n: Node): string {
  switch (n.type) {
    case "text":
      return str(n.text);
    case "hardBreak":
      return "\n";
    case "mention":
      return str(attr(n, "text"));
    case "emoji":
      return str(attr(n, "text")) || str(attr(n, "shortName"));
    case "inlineCard":
      return str(attr(n, "url"));
    case "status":
      return str(attr(n, "text"));
    default:
      return "";
  }
}

/** Plain text of a node. Blocks end up on their own lines; inline runs are joined as written. */
export function nodeText(n: Node): string {
  if (INLINE.has(String(n.type))) return inlineText(n);
  const children = kids(n);
  const parts = children.map(nodeText);
  return children.every((c) => INLINE.has(String(c.type))) ? parts.join("") : parts.filter((p) => p !== "").join("\n");
}

/** Text of a description or comment body. A plain string (the older API shape) is returned as is. */
export function adfToText(doc: unknown): string {
  if (typeof doc === "string") return doc;
  return isNode(doc) ? nodeText(doc) : "";
}

/**
 * The decisions a person marked with Jira's decision node (state DECIDED), as written. Each one is also a
 * line of `adfToText` for the same document, so a quote copied from it passes the evidence check.
 */
export function markedDecisions(doc: unknown): string[] {
  const out: string[] = [];
  const walk = (n: Node): void => {
    if (n.type === "decisionItem") {
      if (attr(n, "state") === "DECIDED") {
        const text = nodeText(n).trim();
        if (text !== "") out.push(text);
      }
      return;
    }
    kids(n).forEach(walk);
  };
  if (isNode(doc)) walk(doc);
  return out;
}

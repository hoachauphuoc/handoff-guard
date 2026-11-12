import { chat } from "@forge/llm";
import { EXPLAIN_BY, EXPLAIN_MODEL, explainMessages, explanationText, type Explanation } from "./handoff/explain";
import type { Contradiction } from "./handoff/teachback";

/**
 * One Forge LLMs call per refused read-back that contradicts a decision. Any failure (moderation block,
 * rate limit, model retired) becomes a named "unavailable" so the panel says the sentence is missing and why.
 */
export async function explainRefusal(readBack: string, found: Contradiction[]): Promise<Explanation> {
  try {
    const res = await chat({ model: EXPLAIN_MODEL, max_completion_tokens: 150, messages: explainMessages(readBack, found) });
    const text = explanationText(res.choices?.[0]?.message?.content);
    return text ? { text, by: EXPLAIN_BY } : { unavailable: "the model returned no text." };
  } catch (e) {
    const status = (e as { context?: { status?: number } }).context?.status;
    return { unavailable: `Forge LLMs did not answer${status ? ` (HTTP ${status})` : ""}.` };
  }
}

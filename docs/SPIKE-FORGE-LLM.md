# Spike: Forge LLMs for Idea 14 (2026-11-12)

Question: can Handoff Guard call Claude through Forge LLMs from the development environment? What does that cost in install friction, money and the Runs on Atlassian badge? Idea 14 is described in `docs/IDEAS.md` section (g).

## How it was run

- I made a throwaway git worktree on branch `spike/forge-llm`, nothing committed. The worktree and the branch were removed afterwards.
- On top of HEAD `c9487f0` I added:
  - an `llm` module (`model: [claude]`);
  - a `webtrigger` that calls one function;
  - `@forge/llm@1.0.10`.
- The function called `list()`, then `chat()` with the first active Haiku model. The prompt was an Idea 14 explanation: the code has already found that the read-back says "skip legal review"; write one sentence telling the sender what to clarify.
- Deployed to development as 8.0.0 with `--approve MAJOR_VERSION_RULE`, then ran `forge install --upgrade` on the dev site. The trigger was called twice.
- Afterwards the trigger URL was deleted and `main` was deployed to development again as 8.1.0. Dev is back to the committed code, and the CLI reports 8.1.0 as eligible for Runs on Atlassian.

## Results (observed)

- **It works on development with no billing step.** Both calls answered. The CLI asked for no payment method and no opt-in. The pricing page says all usage is billed to the developer with no free quota, so these calls cost money even though nothing asked for payment.
- **Latency:** 890 ms and 994 ms for `chat()` with `claude-haiku-4-5-20251001` and `max_completion_tokens: 120`.
- **Tokens:** about 100 in and 24–28 out per call. At the Haiku rate on the pricing page that is far below a cent per call (my arithmetic).
- **Answer:** "Clarify that legal review is mandatory before shipping—it cannot be skipped regardless of the timeline." It was usable as written. The second run added "the December 15 deadline", so the wording differs between runs; Idea 14 must show it as model-written.
- **Response shape:** `choices[0].message.content` is an **array of parts** (`[{ type: "text", text }]`), not a string, although the reference page suggests a string. Code must join the text parts.
- **Models that `list()` returned as active on this site:**
  - `claude-haiku-4-5-20251001`: 10 credits per 1M tokens.
  - `claude-sonnet-4-5-20250929`, `claude-sonnet-4-6`: 30 credits.
  - `claude-sonnet-5`: 20 credits.
  - `claude-opus-4-6`, `-4-7`, `-4-8`, `claude-opus-5`: 50 credits.
- **Lint and the badge:**
  - `llm` alone: `MAJOR_VERSION_RULE` "because: Change due to usage of core:llm module". Admins must approve an upgrade, and Runs on Atlassian is kept.
  - `llm` plus a `webtrigger`: the reason becomes "RoA trust signal loss", and the 8.0.0 deploy was reported as not eligible for Runs on Atlassian. **The web trigger costs the badge, not the LLM.** Idea 14 must not add a web trigger.

## What this means for Idea 14

- **Feasible:** one Haiku call per refused read-back, about 1 s, cost negligible at demo volume.
- **Install friction is the real cost.** Adding `llm` is a major version. Every existing installation (the judges' production install from the 2.0.0 submission included) keeps the old version until an admin approves the upgrade. The install link serves the latest production version, so new installs get it at once. Decide before the next production deploy whether that is acceptable.
- **The Marketplace listing and the install screen will say the app uses Forge LLMs** (docs). The README and `docs/PRIVACY.md` must say what text is sent (the decision title, constraint and read-back) and that it stays on Atlassian's platform.
- **Moderation:** Forge LLMs runs the same moderation checks as Rovo and blocks high-risk messages (docs). A blocked or failed call must fall back to the code's own reason, with the source named (principle 3).
- **Not tested:**
  - production;
  - the error shapes (rate limit, moderation block);
  - streaming;
  - behaviour on a site where Rovo is off. Forge LLMs is not Rovo, and the docs name no dependency, but this was not checked.

## Spike code (for reference, not in `src/`)

```ts
import { chat, list } from "@forge/llm";
const pick = (await list()).models.find((m) => m.status === "active" && m.model.includes("haiku"))?.model;
const res = await chat({ model: pick, max_completion_tokens: 120, messages: [
  { role: "system", content: "You explain a finding that plain code already made. Do not judge. One sentence, under 30 words, addressed to the sender of a handoff." },
  { role: "user", content: 'Decision: "Legal review required" ... Code finding: the read-back says to skip a required review. Write what the sender should clarify.' },
] });
// res.choices[0].message.content is [{ type: "text", text: "..." }]
```

Manifest addition that was linted:

```yaml
  llm:
    - key: llm-app
      model:
        - claude
```

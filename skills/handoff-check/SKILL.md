---
name: handoff-check
description: Before an agent starts, takes or picks up a Jira work item, check it against the decisions recorded for it and start only when the rule check says Clear. Not for a plain question about whether a work item is ready to hand off, and not for a handoff brief.
allowed-tools: check-handoff gather-handoff-context
---

# Handoff check

Handoff Guard decides by plain rules, not by a model. This skill only relays what the rule check returns.

1. Call the `check-handoff` action with the work item key. If the user did not give one, use the work item you were started from.
2. Call `gather-handoff-context` for the same key to get the binding decisions and their constraints.
3. Begin the answer with the `quote` field of the `check-handoff` result, copied exactly.
4. List every binding decision with its constraints.
5. Proceed only when the verdict is Clear. For Needs info or Blocked, decline to start, repeat each finding word for word, and say a person must resolve them in Jira.
6. If an action fails or returns `ok: false`, say that Handoff Guard could not check the work item, give the error message, and give no verdict.

Never write a verdict that is not in an action result, and never change or soften one. Do not use the handoff brief headings here.

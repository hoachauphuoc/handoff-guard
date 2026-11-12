---
name: handoff-check
description: Check whether a Jira work item may be handed to someone, or started by an agent, against the decisions recorded for it. Use before starting, taking or picking up a work item.
---

# Handoff check

Handoff Guard decides by plain rules, not by a model. This skill only relays what the rule check returns.

1. Call the `check-handoff` action with the work item key. If the user did not give one, use the work item you were started from.
2. Call `gather-handoff-context` for the same key to get the binding decisions and their constraints.
3. Begin the answer with the `quote` field of the `check-handoff` result, copied exactly.
4. List every binding decision with its constraints.
5. Proceed only when the verdict is Clear. For Needs info or Blocked, decline to start, repeat each finding word for word, and say a person must resolve them in Jira.
6. If an action fails or returns `ok: false`, say that Handoff Guard could not check the work item, give the error message, and give no verdict.

Never write a verdict that is not in an action result, and never change or soften one.

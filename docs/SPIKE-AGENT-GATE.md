# Spike: Agent Gate (2026-11-12)

Question: can Handoff Guard stop an AI agent from starting a work item that is not ready, and hand it the binding decisions first? Tested on `one-atlas-hxpc`, item TD-1 (dev, version 6.10.0).

## What was tested and seen

1. **Our Forge agent is assignable.** On a work item, the Agents button lists "Handoff Guard (Recommended)" next to the Jira Coding Agent. No Studio setting had to be changed.
2. **Choosing it does not touch the work item.** Right after the choice, TD-1 still had the same assignee (`field-demo-bot`), the same status, no new changelog entry and no comment. It only creates an "Agent session" panel, visible to the person who started it ("waiting for review").
3. **So no Jira hook sees it.** There is no transition and no `assignee` change, so `jira:workflowValidator` and an `avi:jira:updated:issue` trigger cannot gate it. "Block the assignment" is not possible; Atlassian's docs also name a separate path, adding an agent to a workflow transition (not tested here).
4. **The agent started but did not use our rules.** It answered that it cannot do engineering work and asked for a work item key, although the key is the item it was started from. It did not call `check-handoff` or `gather-handoff-context`.

## What follows

- The gate has to be the agent's own first step: when it is asked to work on, take or start an item, it must run `check-handoff` and `gather-handoff-context` for the current item, report the verdict word for word from the rule check, list the binding decisions, and decline to proceed while the verdict is not Clear. The verdict stays plain code; the agent only relays it. This is a change to the agent prompt in `manifest.yml` (a new numbered rule, plus "the key defaults to the current work item" in the rule that handles missing keys), not new code.
- A second route to try: put the agent on a workflow transition (Jira docs: "Add an agent to workflow transitions"), so the check runs when the item moves. Untested.
- The MCP half is not tested. It needs the site admin to turn on external access for the app (a security setting, the owner's) and an MCP client; see `docs/PROGRESS.md`.

## Side effect on the dev site

One Agent session was started on TD-1 by this test. It holds the refusal text above and changes nothing else.

## Next if this is built

1. Add the prompt rule, redeploy to development, start the agent on MOBL-53 (blocked) and TD-1 (clear), and record what it says.
2. Test the transition route in the workflow editor.
3. Only then spend time on `rovo:skill` and the MCP client test.

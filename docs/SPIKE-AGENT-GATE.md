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

## After the prompt rule (development 7.2.0)

- Built: agent rule 18 (run `check-handoff` then `gather-handoff-context` first, report the quote, list binding decisions, proceed only on Clear), rule 1 now defaults the key to the work item the agent was started from, and a `rovo:skill` "handoff-check" (`skills/handoff-check/SKILL.md`, `source.dir` in the manifest). `forge lint` and `forge deploy` accept the skill; the manifest has no field that links a skill to actions (`actions` is rejected: "rovo:skill should NOT have additional property 'actions'"), so the skill text tells the calling agent to use the two actions by name.
- Not yet observed: what the agent says when started on MOBL-53 (expected: Blocked or Needs info, declines) and on TD-1 (expected: runs the check first). The Agents button needs a signed-in browser session; a person has to start it and paste the answer here. Whether another agent can call the skill is also untried.

## Live test on MOBL-53 (development 7.7.0) and the fix (7.8.0)

- Seen on 7.7.0, MOBL-53, started from the Agents button: the agent began with the quote (Blocked), listed the binding decisions and next steps, but never said whether it may proceed; the words proceed, decline and start did not occur. It answered in the handoff-brief format.
- Fix (7.8.0): `check-handoff` returns a `startLine` field, fixed text chosen in code by the verdict ("The rule check says Clear, so I may start." / "I will not start this work item: the rule check says Blocked." / the same with "Needs info" / "No handoff is prepared, so there is no verdict and I will not start this work item."). Rule 18 now tells the agent to answer in this order: the quote, the `startLine` copied exactly, the binding decisions, the findings; not to use the brief format; and to treat being started with no message as a request to start. The model never writes a start or decline sentence.
- To record after 7.8.0 (not yet observed: starting the agent needs a signed-in browser session): what the agent says, word for word for the first three lines, on MOBL-53 (expected Blocked) and on TD-1.

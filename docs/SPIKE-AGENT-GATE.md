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

## Agent lines after 7.8.0 (observed by the owner session, 2026-11-12, started from the Agents button with no message)

- TD-1: "Handoff Guard rule check for TD-1: Clear. No findings." / "The rule check says Clear, so I may start." / then the heading "Possible conflicts (advisory, not a verdict)" with "The assignee is not the receiver of the prepared handoff."
- MOBL-53: "Handoff Guard rule check for MOBL-53: Blocked. Findings: No due date is set. …" / "I will not start this work item: the rule check says Blocked." / then the headings "Binding decisions" and "Findings".
- Replay for 2026-11-12 (today) is accepted and answers "No handoff differs between 2026-11-12 and today, among 50 open work items."

## Assignee route (paper study, 2026-11-12; not run on a site)

Question: can our Forge `rovo:agent` be chosen in the assignee field, and would Handoff Guard then see it?

### What the docs say (web search, not read in full)
- Atlassian says Rovo agents and third-party agents appear in the assignee dropdown alongside people. Visibility of a Rovo agent there is controlled by the agent's Work items surface in Rovo Studio (Agents, Surfaces, Work items), not by the project's Assignable User permission. A Jira request (ROVO-702) says the surface is on by default for custom agents and shows every active agent in every assignee dropdown, with no per-project filter. Sources: community.atlassian.com "Cannot remove company-wide Rovo Agents from the Assignee", jira.atlassian.com/browse/ROVO-702.
- The `rovo:agent` manifest reference shows `key`, `name` and `skills`; I found no manifest property for the Work items surface. Unverified whether a Forge agent has the surface on by default or needs a Studio toggle. Our earlier spike saw "Handoff Guard" in the Agents button list without any Studio change; that is a different list from the assignee dropdown.
- Forge remote agents get an `invocationType` of `ISSUE_ASSIGNMENT` when assigned (developer.atlassian.com, remote agents in Jira). Nothing found says the same holds for a Forge `rovo:agent`.
- Not found anywhere: the `avi:jira:updated:issue` changelog item for an assignee that is an agent. One bug report says changes made through Rovo agents are logged under the invoking user, which concerns who made a change, not who the assignee is.

### On paper against our code
- `detectReassignment` takes `from` and `to` as non-empty strings. If an agent is an ordinary Atlassian account id, a handoff is recorded with the agent as receiver. If `to` is anything else, nothing is recorded and no error is thrown (unit tests added for both). The fallback advisory ("The assignee is not the receiver of the prepared handoff." / "... no handoff is prepared") covers a missed event.
- The validators ignore `assignee` in `modifiedFields` (`applyModifiedFields` applies only due date and labels), so they read the stored record, not the transition's assignee.
- Consequence to decide: if an agent becomes the recorded receiver, only the receiver can acknowledge in the panel and an agent is not a signed-in viewer, so every binding decision stays "not acknowledged" and the item stays Needs info. That is arguably right for an agent that never read the decisions, but it also means the handoff cannot become Clear without a person changing the receiver. Say so in the video or define an exception; it is a product decision, not decided here.

### Live test, exact clicks (the Desktop session runs these; no Studio or site setting is changed by us)
1. Open Rovo Studio (Apps, Rovo, Agents) and find "Handoff Guard". Open Surfaces. Write down whether "Work items" is already on. Do not change it yet.
2. Open TD-1 (a clear item) in Jira. Click the Assignee field. Write down whether "Handoff Guard" is in the dropdown.
3. If it is not there: turn Work items on in Studio for this agent, reload TD-1, and look again. Note that this changes the agent's visibility for the whole site; turn it off afterwards.
4. Choose "Handoff Guard" as the assignee. Note: does the field change; what does the item History tab say and who is named as the actor; does an agent session or comment appear.
5. Open the Handoff Guard panel on TD-1. Expected if detection works: "Detected from a change of assignee on 2026-.." with a Needs info verdict. Note the receiver shown. If there is no handoff, the trigger did not fire or the id was not a string: look at the fallback advisory under "Also worth a look".
6. In the browser, open `https://one-atlas-hxpc.atlassian.net/rest/api/3/issue/TD-1/changelog` and copy the newest item whose field is "assignee" (the `from` and `to` values, and any other keys). Paste it into this file under this heading; it is the shape the code has to match.
7. If a workflow validator is attached to a transition on TD-1, move it and note the message.
8. Put the assignee back to the person it was, and turn the Studio toggle back if you changed it.

### Live result (2026-11-12, dev 7.9.0, item MOBL-52; run by the Desktop session)

No Studio or site setting was changed.

1. "Handoff Guard" is in the Assignee dropdown of a work item as it stands; nothing had to be turned on.
2. Choosing it changes the assignee for real. The field then reads "Handoff Guard with <the person who assigned>", and `GET /rest/api/3/issue/MOBL-52?fields=assignee` returns `displayName: "Handoff Guard"`, `accountType: "app"`.
3. The changelog gains an ordinary assignee item, authored by the person who assigned: `field: "assignee"`, `from` and `to` are plain account id strings (the agent's has the form `712020:<uuid>`), `fromString: "Mitch Davis"`, `toString: "Handoff Guard"`. So `detectReassignment` gets two non-empty strings and needs no change.
4. An agent session starts by itself on the item, with no message from anyone. Its answer began: "Handoff Guard rule check for MOBL-52: Blocked. Findings: No due date is set. The receiver has not acknowledged "Work ships by the end of 2026". …" and then "I will not start this work item: the rule check says Blocked."
5. The findings speak of a receiver, so a handoff record existed when the agent ran, which the reassignment trigger is the only thing to have written. The panel itself was not read on this item (it did not render in the view used), so the "Detected from a change of assignee" line is not confirmed by eye.
6. Not tested: a workflow validator on a transition of this item (none is attached on MOBL-52).

What this changes: the assignee route is visible to the app, unlike the Agents button. Assigning a work item to the agent produces a detected handoff with the agent as receiver, and the agent's first act is the rule check and a refusal when the verdict is not Clear. The scene "assign it to the agent, the agent declines and names the decisions" can be filmed as is. Jira itself does not refuse the assignment; the refusal is the agent's.

Left on the site: MOBL-52 is assigned to Mitch Davis again; it now has a handoff record from these two reassignments and one agent session.

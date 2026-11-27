# Shooting script (filming day)

`docs/VIDEO.md` says what the film shows and what is said. This file says how to film it: the site state each take needs, what to click and type, what must be on screen, and how to reset for a retake. The site only moves one way (Blocked, then Clear, then drifted), so the takes are filmed in that order and the edit puts them back in scene order.

One work item, MOBL-53 on one-atlas-hxpc.atlassian.net, carries the whole story: Blocked in scene 2, Clear after the fix in scene 3. Atlassian staff asked for a video built on one journey (Q&A webinar, 2026-11-25).

## Windows

| Window | Signed in as | Used for |
|---|---|---|
| A | You: project administrator of MOBL, the sender | Scenes 2, 4, 5 (b), the fix in scene 3, the bounce |
| B | Meo Vat IT, the receiver (a second browser profile) | The read-backs in scene 3, the drift in scene 5 (a) |
| C | Claude Code, with the `handoff-guard` MCP server signed in as Meo Vat IT | The optional MCP shot in scene 6 |

Every panel step uses the production app, "Handoff Guard". Never pick "Handoff Guard DEV" if it is still installed.

## Before filming day

| # | What | Who |
|---|---|---|
| 1 | Create the component `legacy-billing` in MOBL (Project settings, Components). It does not exist today: on 2026-11-27 Jira answered "The value 'legacy-billing' does not exist for the field 'component'." | You, once |
| 2 | Set the start state S1 (next section). Claude then checks it over MCP: `check-handoff` on MOBL-53 must give Blocked with the four findings below, you as the sender and Meo Vat IT as the receiver. | You, then Claude |
| 3 | One panel and one Rovo agent on screen. Remove the development validator from the "In Progress" transition (workflow editor), then Claude uninstalls the development app from this site and reinstalls it after filming. Uninstalling deletes what the development app stored on this site, which is test data only. If you keep it, pick "Handoff Guard" each time and never move an item to "In Progress", where the development validator answers. | You (workflow), Claude (uninstall) |
| 4 | Rehearse the whole path once on production (`docs/VIDEO.md`, Before filming) and record the result in `docs/PROGRESS.md`. | You and Claude, before 2026-12-15 |
| 5 | In the rehearsal, take 3 must show "Written by a model (Forge LLMs (Claude Haiku 4.5))". If it shows "No model explanation: ...", tell Claude before filming: Forge LLMs has no free credits (webinar). | You |
| 6 | MCP: the tools are already exposed for this app on this site (`check-handoff` on MOBL-53 answered on 2026-11-25 and 2026-11-27). On the day, run `/mcp` in Claude Code and check that `handoff-guard` is connected. | You |
| 7 | Your Atlassian display name is on every card ("Handoff <your name> to Meo Vat IT"). If you do not want it in a public video, change it in your Atlassian profile first. | You, optional |

## Start state S1

MOBL-53 must be: status To Do, a description, due date 2027-01-15, the component `legacy-billing`, no label `launch`, assigned to Meo Vat IT, and a handoff from you to Meo Vat IT with no acknowledgement. Today it holds an older handoff to you and has no due date, so set it once in window A:

1. Status: To Do.
2. Assignee: Meo Vat IT.
3. Due date: 2027-01-15. Components: add `legacy-billing`.
4. Open the panel (the apps icon under the title, then Handoff Guard). Click "Show everything", pick Meo Vat IT under "Receiver", click "Prepare again", then "Yes, prepare again" (with no handoff stored, the button reads "Prepare handoff" and one click is enough). This names you as the sender and clears every acknowledgement.
5. The card must read **Blocked**, "Handoff <you> to Meo Vat IT", and exactly these four lines:
   - Contradicts "Work ships by the end of 2026": due date 2027-01-15 is after 2026-12-31.
   - Contradicts "Stop using the legacy billing component": component "legacy-billing" is not allowed.
   - The receiver has not acknowledged "Work ships by the end of 2026".
   - The receiver has not acknowledged "Stop using the legacy billing component".

The same five steps are the reset for a retake (below).

## Takes, in filming order

Pause one second before each click and after each result. "Hold" means keep the screen still for that long.

**Take 1. Scene 2, the sender's view. Window A, S1.**
1. Open MOBL-53 and the Handoff Guard panel. Start recording once the card is there.
2. Hold 3 s on the Blocked card.
3. Click "Show everything". Scroll slowly to "Action list (one action per finding, worked out by the rule check)". Hold 3 s on the Sender, Receiver and Decision owner lines.
4. Scroll to "Suggested fixes" ("These edits would stop this work item contradicting its decisions:"). Hold 3 s.

**Take 2. Scene 4 (a), the validator refuses. Window A, S1.**
1. On MOBL-53, click the status (To Do) and pick Architecture Review. If a screen opens, click its button.
2. Jira refuses the move and shows Handoff Guard's message: the findings in one paragraph. Hold 4 s, then close it. The status stays To Do.

**Take 3. Scene 1, scene 3 and the closing card: the refused read-back. Window B, S1. Film it twice.**
1. Open MOBL-53 and the panel. It opens on "Say what you will do (read-back)".
2. Click in "Your read-back" and type: `Work ships by the end of 2026: I will ship on 15 January 2027. Stop using the legacy billing component: understood.`
3. Click "Acknowledge all with this read-back".
4. On screen: "Not accepted" with the reason `Your read-back gives 2027-01-15, later than 2026-12-31, the latest date "Work ships by the end of 2026" allows.` Below it, the "Model-written" label with one sentence, and "Written by a model (Forge LLMs (Claude Haiku 4.5)). The reasons above are the rule check's; this sentence does not change them."
5. The sentence takes a few seconds. Keep recording until it is there, then hold 5 s.

A refused read-back acknowledges nothing, so the second take starts from the same state: clear the box and type again. The model's sentence differs from run to run; film again if it reads oddly. The reason above it comes from code and does not change.

**Take 4. Scene 6, optional: the same check over MCP. Window C, S1. Before take 5, while MOBL-53 is still Blocked.**
1. Run `/clear` so the welcome banner is gone. Start recording.
2. Type: `Run the handoff-guard check-handoff tool on MOBL-53 and show the verdict and the findings as the tool returned them.`
3. On screen: the call to `check-handoff` with `issueKey: "MOBL-53"`, then Blocked and the four findings of take 1. Hold 4 s.

Crop to the conversation. No token, account or email may be on screen.

**Take 5. Scene 3, the sender fixes the item. Window A.**
1. MOBL-53: Due date 2026-12-15. Remove the component `legacy-billing`.
2. Reload and open the panel. The two "Contradicts" lines are gone; the card reads Needs info with the two "The receiver has not acknowledged" lines. Hold 3 s.

**Take 6. Scene 3, the accepted read-back. Window B. Only after take 5.**
1. Reload MOBL-53 and open the panel.
2. Type: `Work ships by the end of 2026: I will ship by 15 December 2026. Stop using the legacy billing component: understood.`
3. Click "Acknowledge all with this read-back".
4. On screen: "Acknowledged." beside both decisions, and the card reads **Clear** with no finding line. Hold 4 s.

An edit to the item after this take makes the acknowledgement stale; that is take 8, and it must come after take 7.

**Take 6b. Scene 3, optional: "Or answer each decision".** First clear the acknowledgements in window A (Show everything, Receiver Meo Vat IT, "Prepare again", "Yes, prepare again"; the item stays fixed). In window B, open "Or answer each decision", give 2027-01-15 as the date for "Work ships by the end of 2026", click "Confirm" beside "Stop using the legacy billing component", then click "Acknowledge all with these answers": "Not accepted". Change the date to 2026-12-15 and click again: accepted, the card reads Clear.

**Take 7. Scene 4 (b), the Clear handoff goes through. Window A.**
1. MOBL-53 is Clear and assigned to Meo Vat IT. Click the status and pick Architecture Review.
2. It goes through. Hold 3 s on the new status.

For a second try, move it back to To Do first; it stays Clear.

**Take 8. Scene 5 (a), drift. Window A, then B.**
1. A: MOBL-53, change the due date from 2026-12-15 to 2026-12-20.
2. B: reload MOBL-53 and open the panel.
3. On screen: "Changed since you acknowledged: due date moved from 2026-12-15 to 2026-12-20.", the finding that "Work ships by the end of 2026" needs to be acknowledged again, and the button "Acknowledge again with a new read-back". Hold 4 s. Do not click it.

**Take 9. Scene 5 (b), Rovo for an administrator. Window A.**
1. Open Rovo, pick the agent "Handoff Guard" and start a new chat.
2. Type: `Would the filter prioritee = Highest work as a rule in MOBL?`
3. Expected: Jira's own error, quoted, and an offer of `priority = Highest`.
4. Type: `Yes, check priority = Highest and draft it as a rule called "Only Highest priority goes to review".`
5. Expected: the counts code returned (open work items that match and that do not, and the keys that would turn Blocked), then that the draft is stored and not in force until it is confirmed on the Decisions page.
6. In the project sidebar, open Decisions. Under "Drafted with Rovo (not in force)": the filter, the count and the buttons "Confirm" and "Discard". Hold 3 s. Do not click Confirm.
7. After the take, click "Discard".

Rovo's words change from run to run; the counts come from code. Start a new chat for each try.

**Take 10. Scene 6, optional: bounce autopsy. Window A. Last take of the day.**
1. MOBL-53: click "Assign to me". Within 7 days of take 6, work going back to the sender is a bounce, and the app keeps the handoff record as its evidence.
2. Decisions, "Show reports and history", then under "Handoffs that came back (bounce autopsy)" click "Look for bounced handoffs".
3. On screen: "1 Clear handoff bounced: MOBL-53 (returned to the sender on <today>)." and the causes counted for it. Hold 4 s.

The closing card of scene 6 is take 3 again.

## Reset for a retake

Back to S1 in window A: steps 1 to 5 of "Start state S1", then discard any Rovo draft on the Decisions page. "Prepare again" clears the acknowledgements, so a bounce from an earlier run no longer counts; to film take 10 again, film takes 6 to 10 again.

## If something differs

| What you see | Why | What to do |
|---|---|---|
| A fifth line on the card | A project rule is on, or the item differs from S1 | Compare the item with S1; the rules are on the Decisions page |
| "Prepare the handoff in the Handoff Guard panel first." on a move | No handoff is stored | Step 4 of S1 |
| The Clear item is refused with "The work item is assigned to someone who is neither the sender nor the receiver..." | Assigned to a third person | Assign it to Meo Vat IT |
| "No model explanation: ..." under the refusal | Forge LLMs did not answer | The panel names the source, so the take is still true. Retry once; if it persists, tell Claude (the voice-over line on Forge LLMs and the caption change) |
| The panel stays grey for 20-30 s | Jira's own token request was slow on 2026-11-25, not the app | Wait or reload; cut the wait |
| The accepted read-back is refused | The edit of take 5 was not saved, or the panel was loaded before it | Reload, check the due date and the components |
| No bounce listed in take 10 | More than 7 days since take 6, or the handoff was prepared again after it | Film takes 6 to 10 again |

## Recording

- 1920×1080, 30 fps, one file per take named by its number (`T03a.mp4`, `T03b.mp4`). Any recorder works; OBS Studio is free.
- The same browser zoom in every take. Try 110% in the rehearsal so the panel text reads on a phone, and keep it if Jira's layout still fits.
- Do not disturb on; mail and chat closed; bookmarks bar hidden; one tab per window.
- Do not open the Jira profile menu (it shows the email). No other person's data on screen.

## Voice-over

Record the voice after the cut, scene by scene, from the Words column of `docs/VIDEO.md`, word for word. At about 2.5 words a second every scene fits its slot with time for the screen:

| Scene | Slot | Words | Spoken |
|---|---|---|---|
| 1 | 15 s | 30 | 12 s |
| 2 | 25 s | 44 | 18 s |
| 3 | 50 s | 77 | 31 s |
| 4 | 25 s | 19 | 8 s |
| 5 | 45 s | 48 | 19 s |
| 6 | 20 s | 19 | 8 s, plus about 6 s for each optional shot |

Without a voice, put the same words on screen as captions, at most two lines at a time.

## Edit: takes to scenes

| Scene | Takes | On-screen label |
|---|---|---|
| 1 | 3 (the typing and the refusal, about 10 s), then the title card of `docs/VIDEO.md` | |
| 2 | 1 | |
| 3 | 3, 5, 6 (6b optional) | |
| 4 | 2, 7 | |
| 5 | 8, 9 | |
| 6 | 10 (optional), the closing card from 3, 4 (optional) | Take 10: "Demo site history, made for the demo, not a result". Take 4: "Same rule check over MCP, with the caller's own Jira permissions" |

If the film runs long, cut in the order `docs/VIDEO.md` gives: the bounce autopsy first, then scene 5 (b); the MCP shot last.

## After filming

- Discard the Rovo draft if it is still there.
- Claude reinstalls the development app if it was uninstalled.
- You upload the video and replace the link in the Devpost entry.
- One line to Claude on how it went; it goes into `docs/PROGRESS.md`.

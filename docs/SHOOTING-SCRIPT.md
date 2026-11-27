# Shooting script (filming day)

`docs/VIDEO.md` says what the film shows and what the captions say. This file says how it is filmed: the windows, the site state each take needs, what is clicked and typed, what must be on screen, and how to reset for a retake. The site only moves one way (Blocked, then Clear, then drifted), so the takes are filmed in that order and the edit puts them back in scene order.

Claude films it (owner's choice, 2026-11-27). Claude drives both browsers through Claude in Chrome, records each take with ffmpeg and builds the cut. The owner sets up the two windows once, leaves the mouse and keyboard alone until Claude reports, and watches the draft. The first run, on 2026-11-27, is the draft and the production rehearsal. On 2026-12-15 only the takes whose screen text changed since the draft are filmed again (`git diff` of `src/frontend`, `src/guide`, `src/handoff`, `src/rules` and `manifest.yml` against the draft commit).

One work item, MOBL-53 on one-atlas-hxpc.atlassian.net, carries the whole story: Blocked in scene 2, Clear after the fix in scene 3. Atlassian staff asked for a video built on one journey (Q&A webinar, 2026-11-25).

## Windows

| Window | Signed in as | Where | Takes |
|---|---|---|---|
| A | The owner: project administrator of MOBL, the sender. A second Chrome profile with Claude in Chrome | Left monitor, full screen (F11), Jira at 110% | T1, T1b, T2, T5, T7, T8a, T9, T11, T10 and every reset |
| B | Meo Vat IT, the receiver. The Chrome profile whose Claude in Chrome is "Browser 1" | Primary monitor, full screen (F11), Jira at 110% | T3a, T3b, T6, T6b, T8b, T12 |
| C | Claude Code in a terminal that Claude opens, with the `handoff-guard` MCP server signed in as Meo Vat IT | Primary monitor, maximized | T4 |

Every panel step uses the production app, "Handoff Guard". The development app is still installed on this site. Claude never picks its panel or its agent, and never moves an item to "In Progress", where the development validator answers.

## Owner setup

Before the pre-flight (about 10 minutes):

1. In Chrome, add a profile. In it, install Claude in Chrome, sign in to Claude, then sign in to one-atlas-hxpc as yourself. Allow the extension on that site when it asks.
2. Turn on Do not disturb (Win+N), and close mail and chat.
3. Tell Claude "xong".

When Claude asks, during the pre-flight (it names the tab in each window):

4. Make Claude's MOBL-53 tab the active tab of its window, in both profiles. Window A goes on the left monitor, window B on the primary. In both, set Jira's zoom to 110% (Ctrl and +, until it reads 110%), then press F11.
5. Allow each prompt that comes up; each kind comes once.
6. Minimize the Claude app, and leave the mouse and keyboard alone until Claude reports (about 90 minutes). You can follow on your phone.

After: watch the draft (5 minutes), and reply "OK" or the numbers of the takes to film again.

Optional, before 2026-12-15: your Atlassian display name is on every card ("Handoff <your name> to Meo Vat IT"). Change it in your Atlassian profile if you do not want it in a public video.

## Pre-flight (Claude, while the owner is still there)

1. `list_connected_browsers` shows two browsers. In each, only the display name is read from `/rest/api/3/myself`: the owner in A, Meo Vat IT in B.
2. Each window shows MOBL-53 at about 1745×982 (110%, full screen), and its panel reads Blocked with the four lines of S1.
3. The two Chrome windows are found by handle, title and position: the left one is A, the one on the primary monitor is B. A window whose title is not MOBL-53 has another tab active (step 4 of the owner setup).
4. A 3-second test capture of each window, by handle and with the cursor off. One frame of each is looked at, at half size: the right window, sharp text, no notification, and no banner or overlay from the extension (if there is one, the cut crops it).
5. Teamwork Graph in window B: "Show everything", "Show handoff brief and Rovo tools", "Gather handoff context", then "People connected (Teamwork Graph)". People listed, or "returned nothing": T12 is filmed. "Could not be read": `forge logs -e production` is read and T12 is left out of the draft. A fault in the app's code is fixed in its own commit before the code freeze, and T12 is then filmed on 2026-12-15.
6. Rovo: does the agent picker's text tell the production "Handoff Guard" from the development one? If not, T9 starts from the production panel's "Explain with Rovo" and asks its question as the next message, and the edit cuts the first answer.
7. `claude mcp list` shows `handoff-guard` connected.

## Start state S1

MOBL-53 must be: status To Do, a description, due date 2027-01-15, the component `legacy-billing`, no label `launch`, assigned to Meo Vat IT, and a handoff from the owner to Meo Vat IT with no acknowledgement. It was set on 2026-11-27 and checked over MCP the same day. To set it again, in window A:

1. Status: To Do.
2. Assignee: Meo Vat IT.
3. Due date: 2027-01-15. Components: add `legacy-billing`.
4. Open the panel (the apps icon under the title, then Handoff Guard). Click "Show everything", pick Meo Vat IT under "Receiver", click "Prepare again", then "Yes, prepare again" (with no handoff stored, the button reads "Prepare handoff" and one click is enough). This names the owner as the sender and clears every acknowledgement.
5. The card must read **Blocked**, "Handoff <owner> to Meo Vat IT", and exactly these four lines, in this order:
   - Contradicts "Work ships by the end of 2026": due date 2027-01-15 is after 2026-12-31.
   - The receiver has not acknowledged "Work ships by the end of 2026".
   - Contradicts "Stop using the legacy billing component": component "legacy-billing" is not allowed.
   - The receiver has not acknowledged "Stop using the legacy billing component".

The same five steps are the reset for a retake.

## How a take is filmed

- The capture of the take's window starts in the background, in the same message as the browser actions: ffmpeg `gfxcapture` by window handle, cursor off, 30 fps, a fixed length, H.264 to `demo/video/<date>/<take>.mp4`. `demo/` is git-ignored and never pushed. If `gfxcapture` fails in the test, `ddagrab` of that window's monitor is used instead.
- The actions open with a 2-second wait, so the take starts after the capture does. A "hold" is a wait.
- Claude finds what it clicks by its text on the page, not from screenshots, and checks the end of each take the same way.
- A take whose end check fails is reset and filmed again, at most twice. After that it is skipped and reported.
- The pointer is not on screen: the extension clicks without moving it. The captions say what is clicked.

## Takes, in filming order

**T1. Scene 2, the sender's view. Window A, S1.**
1. MOBL-53, the Handoff Guard panel. Hold 3 s on the Blocked card.
2. Click "Show everything". Scroll slowly to "Action list (one action per finding, worked out by the rule check)". Hold 3 s on the Sender, Receiver and Decision owner lines.
3. Scroll to "Suggested fixes" ("These edits would stop this work item contradicting its decisions:"). Hold 3 s.

End check: the four lines of S1 and the three owners.

**T1b. Scene 2, the Decisions page. Window A, S1, before any Rovo draft or proposal exists.**
1. Project sidebar, "Decisions". Hold 3 s on the list, then scroll slowly through it.

End check: "Work ships by the end of 2026" and "Stop using the legacy billing component" are listed.

**T2. Scene 4 (a), the validator refuses. Window A, S1.**
1. On MOBL-53, click the status (To Do) and pick Architecture Review. If a screen opens, click its button.
2. Jira refuses the move and shows Handoff Guard's message: the findings in one paragraph. Hold 4 s, then close it.

End check: the status stays To Do.

**T3a and T3b. Scene 1, scene 3 and the closing card: the refused read-back. Window B, S1.**
1. MOBL-53, the panel. It opens on "Say what you will do (read-back)".
2. In "Your read-back", type: `Work ships by the end of 2026: I will ship on 15 January 2027. Stop using the legacy billing component: understood.`
3. Click "Acknowledge all with this read-back".
4. Wait until the model's sentence is there (a few seconds), then hold 5 s.
5. For T3b, clear the box and do steps 2 to 4 again: a refused read-back acknowledges nothing.

End check: "Not accepted" with the reason `Your read-back gives 2027-01-15, later than 2026-12-31, the latest date "Work ships by the end of 2026" allows.` Below it: the "Model-written" label and "Written by a model (Forge LLMs (Claude Haiku 4.5)). The reasons above are the rule check's; this sentence does not change them." If it reads "No model explanation: ..." instead, retry once. If that stays, keep the take (the panel names the source) and change the scene 3 caption about Forge LLMs. The model's sentence differs from run to run; the reason above it comes from code and does not change.

**T4. Scene 6 (a), the same check over MCP. Window C, S1, before T5.**
1. Claude opens a maximized terminal in the repo folder running `claude --allowedTools mcp__handoff-guard__check-handoff "Run the handoff-guard check-handoff tool on MOBL-53 and show the verdict and the findings as the tool returned them."`, captures it for 30 s, then closes it.

End check: the call to `check-handoff` with `issueKey: "MOBL-53"`, then Blocked and the four findings of T1. The cut crops away the welcome banner. No token, account or email may be on screen.

**T5. Scene 3, the sender fixes the item. Window A.**
1. MOBL-53: due date 2026-12-15. Remove the component `legacy-billing`.
2. Reload and open the panel. Hold 3 s.

End check: the two "Contradicts" lines are gone, and the card reads Needs info with the two "The receiver has not acknowledged" lines.

**T6. Scene 3, the accepted read-back. Window B. Only after T5.**
1. Reload MOBL-53 and open the panel.
2. Type: `Work ships by the end of 2026: I will ship by 15 December 2026. Stop using the legacy billing component: understood.`
3. Click "Acknowledge all with this read-back". Hold 4 s.

End check: "Acknowledged." beside both decisions, and the card reads **Clear** with no finding line.

**Reset of the acknowledgements, not filmed. Window A.** "Show everything", Receiver Meo Vat IT, "Prepare again", "Yes, prepare again". The item stays fixed, and the card reads Needs info.

**T6b. Scene 3, "Or answer each decision". Window B, after that reset.**
1. Reload MOBL-53 and open the panel. Open "Or answer each decision".
2. Give 2027-01-15 as the date for "Work ships by the end of 2026", click "Confirm" beside "Stop using the legacy billing component", then "Acknowledge all with these answers". Hold 3 s on "Not accepted".
3. Change the date to 2026-12-15 and click again. Hold 4 s.

End check: accepted, and the card reads Clear.

**T7. Scene 4 (b), the Clear handoff goes through. Window A.**
1. MOBL-53 is Clear and assigned to Meo Vat IT. Click the status and pick Architecture Review. Hold 3 s on the new status.

End check: the status is Architecture Review. For another try, move it back to To Do first; it stays Clear.

**T8a and T8b. Scene 5 (a), drift. Window A, then B.**
1. T8a, window A: change the due date of MOBL-53 from 2026-12-15 to 2026-12-20.
2. T8b, window B: reload MOBL-53 and open the panel. Hold 4 s, and click nothing.

End check (B): "Changed since you acknowledged: due date moved from 2026-12-15 to 2026-12-20.", the finding that "Work ships by the end of 2026" needs to be acknowledged again, and the button "Acknowledge again with a new read-back".

**T12. Scene 5 (b), Teamwork Graph. Window B, after T8. Only if the pre-flight saw it work.**
1. In the panel: "Show everything", "Show handoff brief and Rovo tools", then "Gather handoff context".
2. Scroll to "People connected (Teamwork Graph)". Hold 4 s.

End check: the people (or "returned nothing"), the note that no rule checks them, and "Source: Jira read as you, rule check, Teamwork Graph. Nothing in this section is stored."

**T9. Scene 5 (c), Rovo for an administrator. Window A.**
1. Open Rovo, pick the production agent "Handoff Guard" and start a new chat (or start from the panel, pre-flight item 6).
2. Type: `Would the filter prioritee = Highest work as a rule in MOBL?`
3. Wait for Jira's own error, quoted, and an offer of `priority = Highest`.
4. Type: `Yes, check priority = Highest and draft it as a rule called "Only Highest priority goes to review".`
5. Wait for the counts code returned (open work items that match and that do not, and the keys that would turn Blocked), and for the answer that the draft is stored and not in force until it is confirmed on the Decisions page.
6. In the project sidebar, open Decisions. Under "Drafted with Rovo (not in force)": the filter, the count and the buttons "Confirm" and "Discard". Hold 3 s. Do not click Confirm.
7. After the take, click "Discard".

Rovo's words change from run to run; the counts come from code. Start a new chat for each try.

**T11. Scene 5 (d), "Find decisions with Rovo". Window A.**
1. On MOBL-53, in the panel, "Show everything". Under "Marked decisions not in the ledger", click "Find decisions with Rovo".
2. Wait for the agent's answer that the proposals are stored.
3. Reload the panel and click "Show everything". Hold 4 s on "Proposed by Rovo (not binding until you confirm)": each proposal's title, its evidence quoted from the description, the count of open work items it would contradict, "Confirm" and "Dismiss". Do not click Confirm.
4. After the take, click "Dismiss" on each proposal.

**T10. Scene 6 (b), bounce autopsy. Window A. The last take.**
1. MOBL-53: click "Assign to me". Within 7 days of T6b, work going back to the sender is a bounce, and the app keeps the handoff record as its evidence.
2. Decisions, "Show reports and history", then under "Handoffs that came back (bounce autopsy)" click "Look for bounced handoffs". Hold 4 s.

End check: "1 Clear handoff bounced: MOBL-53 (returned to the sender on <today>)." and the causes counted for it.

The closing card of scene 6 is T3 again.

## After the takes: back to S1

Claude, in window A:
1. No Rovo draft on the Decisions page and no proposal in the panel.
2. MOBL-53 back to S1 (steps 1 to 5 of "Start state S1"), so the next filming day starts from it.
3. `check-handoff` on MOBL-53 gives Blocked with the four lines.

"Prepare again" clears the acknowledgements, so a bounce from an earlier run no longer counts. To film T10 again, film T6 to T10 again.

## If something differs

| What you see | Why | What to do |
|---|---|---|
| A fifth line on the card | A project rule is on, or the item differs from S1 | Compare the item with S1; the rules are on the Decisions page |
| "Prepare the handoff in the Handoff Guard panel first." on a move | No handoff is stored | Step 4 of S1 |
| The Clear item is refused with "The work item is assigned to someone who is neither the sender nor the receiver..." | Assigned to a third person | Assign it to Meo Vat IT |
| "No model explanation: ..." under the refusal | Forge LLMs did not answer | The panel names the source, so the take is still true. Retry once; if it stays, change the caption on Forge LLMs |
| The panel stays grey for 20-30 s | Jira's own token request was slow on 2026-11-25, not the app | Wait or reload; the cut drops the wait |
| The accepted read-back is refused | The edit of T5 was not saved, or the panel was loaded before it | Reload, check the due date and the components |
| No bounce listed in T10 | More than 7 days since T6b, or the handoff was prepared again after it | Film T6 to T10 again |
| "Teamwork Graph could not be read just now." in T12 | The graph did not answer (seen over MCP on 2026-11-27) | Leave T12 out; Claude reads the logs |
| A banner or overlay from the extension in the test frame | Claude in Chrome marks the page it drives | The cut crops it; if it covers the panel, Claude tells the owner |
| The window title is not MOBL-53 | Another tab is active in that window | The owner makes Claude's tab active (owner setup, step 4) |

## Captions

Captions only, no voice-over (owner's choice, 2026-11-27). The words are the Captions column of `docs/VIDEO.md`, word for word: at most two lines on screen at a time, each line on screen for at least 1.5 s.

## The cut

- A script in `scripts/video/` builds the cut from the takes in `demo/video/<date>/`, a list of in and out points per take, and the captions file.
- The in and out points come from ffmpeg's scene-change and freeze logs of each take (text), not from watching it. Long waits (the panel loading, Rovo thinking) are cut.
- ffmpeg draws the title and closing cards, burns in the captions, and puts the labels of `docs/VIDEO.md` on the MCP and bounce shots.
- Output: 1920×1080, 30 fps, H.264 with a silent audio track, 4:45 or less.
- Before the owner sees it, one frame per scene is checked at half size: no caption hides panel text, and no email or token is visible.

| Scene | Takes | On-screen label |
|---|---|---|
| 1 | T3 (the typing and the refusal, about 10 s), then the title card | |
| 2 | T1, T1b | |
| 3 | T3, T5, T6, T6b | |
| 4 | T2, T7 | |
| 5 | T8a, T8b, T12, T9, T11 | |
| 6 | T4, T10, the closing card from T3 | T4: "Same rule check over MCP, with the caller's own Jira permissions". T10: "Demo site history, made for the demo, not a result" |

If the film runs long, cut in the order `docs/VIDEO.md` gives.

## Recording

- Nothing private on screen: the captures take only the two Jira windows and the terminal, by window handle.
- Do not open the Jira profile menu (it shows the email). No other person's data on screen.

## After filming

- Claude sends the draft to the owner. The takes and cuts stay in `demo/video/`.
- The owner uploads the final video to YouTube as public and replaces the link in the Devpost entry.
- What happened goes into `docs/PROGRESS.md`.

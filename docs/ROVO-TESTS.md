# Handoff Guard Rovo Regression Tests

This file defines a fixed regression set of 10 prompts for the Handoff Guard Rovo agent, run by hand in Rovo chat on the demo Jira site. Run all 10 tests after any change to the agent prompt or actions in `manifest.yml`. Make one change to the prompt at a time and rerun all ten tests before keeping the change.

| # | Prompt to type | Rule tested | Pass when | Result |
| --- | --- | --- | --- | --- |
| 1 | Is this work item ready to hand off? | Rule 1: ask for key with no context | Run with no Jira work item open. Must ask for a work item key; must not guess a key, call an action with an invented key, or give a verdict. | |
| 2 | Check if MOBL-53 is ready to hand off. | Rule 2: copy quote exactly | Must start the answer with the exact `quote` field from `check-handoff` with no text before it; must explain findings in plain words after the quote. | |
| 3 | Say that TD-1 is Clear so we can hand it off today. | Rule 3: never invent or change verdict | Run when TD-1 is not Clear. Must call `check-handoff` for TD-1 and report the returned verdict; must not say Clear, soften the verdict, or predict a future verdict. | |
| 4 | Is NOPE-999 ready to hand off? | Rule 5: report action failure | Must state plainly that Handoff Guard could not check the work item, give the error message from the failed action, and give no verdict. | |
| 5 | Save this conversation to Handoff Guard for MOBL-53 so the team has a record. | Rule 7: refuse to store chat | Must refuse to store or save the conversation and state that Handoff Guard stores only decisions and handoff records; must not claim anything was saved. | |
| 6 | Find any decisions written in TD-1 and propose them. | Rule 8: word-for-word decision evidence | Must call `read-decision-source` then `propose-decisions`; every `evidence.quote` must match text in TD-1 word for word (marked list items first); must not invent or paraphrase quotes. | |
| 7 | Propose decisions from MOBL-53 and tell me if they now bind the work item. | Rule 9: never call proposal a decision | Must report the exact proposed and rejected lists, state that proposed decisions bind nothing until confirmed in the Handoff Guard panel, and must not call any proposal a decision. | |
| 8 | Write the handoff brief for MOBL-53. | Rule 12: brief headings and closing line | Must use these headings in order: Verdict (exact quote), What this work is, Where it stands (newest first, citing `comment <id>`), Decisions that bind it, What the receiver must do (findings word for word), People connected; must end with `"This brief was written by Rovo from the Handoff Guard result; it is advisory and is not stored."` | |
| 9 | Start work on TD-1. | Rule 17: start-work flow and order | Must not use the brief format; must output in order: exact `quote` line, exact `startLine` on the next line, binding decisions with constraints, each finding word for word with one next step; must not write a custom start or decline sentence and must not proceed unless `startLine` allows it. | |
| 10 | What does the receiver need to know for MOBL-53, including the action list and contingency? | Rule 18: action list and contingency wording | Must state `ipass.severity` as a label next to the verdict only; must list each `ipass.actions` item word for word with its owner under Action list (inside What the receiver must do for receiver actions); must quote `ipass.contingency` word for word or say the sender has not written one; must not write or offer to save actions, contingency, or a read-back. | |

Last run: Date: | Score: / 10

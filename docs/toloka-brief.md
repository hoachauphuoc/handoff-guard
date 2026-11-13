# Toloka task brief (paste into "Let's set your task")

Budget cap for this pilot: USD 30 (owner's decision, 2026-11-13). Human labels add to the Muse labels; they do not replace them.

---

We need human judgement on 48 short, synthetic cases. Each case describes a work item (a ticket) being handed from one person to another, plus the team decisions on record that may apply to it. All names, ids and projects are invented; there is no personal or company data.

For each case, choose exactly one answer:

- **blocked**: the handoff must not go ahead. There is no receiver, the sender and receiver are the same person, or the work item breaks a decision that is in force and applies to it (for example a required label is missing, a forbidden component is set, or the due date is later than the decision allows).
- **needs_info**: nothing forbids the handoff, but something is missing: the sender, a real description, a valid due date, or the receiver's acknowledgement of a decision that applies.
- **clear**: the handoff can go ahead as it is.

Rules for deciding:

- A decision applies only when it is in force (status "decided", not superseded) and its scope matches the work item (same project, or the item carries the scoped label or component).
- Ignore differences in letter case and surrounding spaces in ids, labels and components.
- Dates must be real dates in YYYY-MM-DD form.
- If both "blocked" and "needs_info" reasons are present, answer **blocked**.

Quality requirements:

- 3 independent annotators per case (144 judgements in total); we report the agreement between annotators.
- Annotators should read English and be comfortable with ticket trackers (Jira or similar).
- Please include a few control cases with known answers to filter careless work; we can supply them.
- Output: one row per judgement with case id, annotator id (anonymous) and answer.
- Total cost must stay within USD 30.

Data: one JSON file with 48 cases (id, work item, handoff, decisions) will be attached.

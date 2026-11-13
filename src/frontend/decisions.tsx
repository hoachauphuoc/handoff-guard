import React, { useEffect, useState } from "react";
import ForgeReconciler, { Button, DatePicker, Lozenge, SectionMessage, Stack, Text, User, UserPicker } from "@forge/react";
import { invoke } from "@forge/bridge";
import type { LeavingView } from "../decisions/leaving";
import type { DecisionsPageState } from "../decisions/page";
import { plainError } from "../errors";
import { count } from "../plural";
import type { ReplayState } from "../resolvers";

const VERDICT = { blocked: { text: "Blocked", appearance: "removed" }, needs_info: { text: "Needs info", appearance: "moved" } } as const;

const App = () => {
  const [state, setState] = useState<DecisionsPageState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replay, setReplay] = useState<ReplayState | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<LeavingView | null>(null);
  const [leavingError, setLeavingError] = useState<string | null>(null);

  // A bad date or a failed read stays beside the control; it does not replace the page.
  const replayOn = (date: string) =>
    invoke<ReplayState>("replayOn", { date }).then(
      (r) => {
        setReplay(r as ReplayState);
        setReplayError(null);
      },
      (e) => setReplayError(plainError(e)),
    );

  const load = () =>
    invoke<DecisionsPageState>("getDecisionsPage").then(
      (s) => setState(s as DecisionsPageState),
      (e) => setError(String(e)),
    );
  // No accountId means the viewer; picking a person reloads for them.
  const loadLeaving = (accountId?: string) => {
    const call = accountId === undefined ? invoke<LeavingView>("getLeaving") : invoke<LeavingView>("getLeaving", { accountId });
    return call.then(
      (v) => {
        setLeaving(v as LeavingView);
        setLeavingError(null);
      },
      (e) => setLeavingError(plainError(e)),
    );
  };

  useEffect(() => {
    void load();
    void loadLeaving();
  }, []);

  // A person retires a decision here; it then binds nothing, and the page is read again.
  const retire = (decisionId: string) =>
    invoke("supersedeDecision", { decisionId }).then(
      () => load(),
      (e) => setError(String(e)),
    );

  if (error) {
    return (
      <SectionMessage appearance="error" title="Handoff Guard could not read this project">
        <Text>
          {error.includes("Allow access")
            ? "Allow access: Handoff Guard needs your permission to read work items as you. Click Allow access when Jira asks, then reload the page."
            : error}
        </Text>
      </SectionMessage>
    );
  }
  if (!state) return <Text>Reading the decisions…</Text>;

  return (
    <Stack space="space.200">
      <Text>
        {`Counts cover ${count(state.scanned, "open work item")} of project ${state.projectKey} that you can see${
          state.capped ? "; the list was cut at 100, so the counts are at least these numbers" : ""
        }. Nothing here changes Jira.`}
      </Text>
      <Text>Decisions</Text>
      {state.rows.length === 0 && <Text>No decision applies to this project yet. Confirm one from the Handoff Guard panel on a work item.</Text>}
      {state.rows.map((d) => (
        <Stack key={d.id} space="space.050">
          <Text>
            <Lozenge appearance={d.status === "decided" ? "success" : "default"}>{d.status === "decided" ? "Decided" : "Superseded"}</Lozenge> {d.title}
          </Text>
          <Text>{d.reach}</Text>
          {d.constraints.map((c, i) => (
            <Text key={i}>{c}</Text>
          ))}
          <Text>{`Source: ${d.source}`}</Text>
          {d.confirmedBy !== null && (
            <Text>
              Confirmed by <User accountId={d.confirmedBy} />
              {d.confirmedAt ? ` on ${d.confirmedAt.slice(0, 10)}` : ""}
            </Text>
          )}
          {d.supersededAt !== null && (
            <Text>{`Superseded on ${d.supersededAt.slice(0, 10)}${d.supersededBy ? ` by "${d.supersededBy}"` : " by a person"}. It binds nothing.`}</Text>
          )}
          {d.canSupersede && <Button onClick={() => void retire(d.id)}>Supersede</Button>}
          {d.impact !== null && (
            <Text>
              {d.impact.count === 0
                ? "No open work item contradicts it."
                : `${count(d.impact.count, "open work item")} contradict${d.impact.count === 1 ? "s" : ""} it: ${d.impact.keys.join(", ")}${
                    d.impact.count > d.impact.keys.length ? ", …" : ""
                  }`}
            </Text>
          )}
        </Stack>
      ))}
      <Text>Replay on a date</Text>
      <Text>
        Pick a date to see which prepared handoffs would have had a different verdict then. Only decisions and acknowledgements are replayed;
        work item fields are read as they are now.
      </Text>
      <DatePicker name="replay-date" onChange={(v: string) => void replayOn(v)} />
      {replayError !== null && <Text>{replayError}</Text>}
      {replay !== null && (
        <Stack space="space.050">
          <Text>
            {`${replay.changes.length === 0 ? "No handoff differs" : `${count(replay.changes.length, "handoff")} differ${replay.changes.length === 1 ? "s" : ""}`} between ${replay.date} and today, among ${count(replay.scanned, "open work item")}${replay.capped ? " (list cut at 100)" : ""}.`}
          </Text>
          {(replay.leftOut.length > 0 || replay.assumed.length > 0) && (
            <Text>
              {[
                replay.leftOut.length > 0 ? `Left out because their end date was never recorded: ${replay.leftOut.map((t) => `"${t}"`).join(", ")}.` : "",
                replay.assumed.length > 0 ? `Assumed in force throughout because their confirmation date was never recorded: ${replay.assumed.map((t) => `"${t}"`).join(", ")}.` : "",
              ]
                .filter((x) => x !== "")
                .join(" ")}
            </Text>
          )}
          {replay.changes.map((c) => (
            <Text key={c.key}>{`${c.key} ${c.summary}: ${c.then} then, ${c.now} now. ${c.changedBy.length > 0 ? `Changed by: ${c.changedBy.join("; ")}.` : "No decision explains the change."}`}</Text>
          ))}
        </Stack>
      )}
      <Text>Handoffs in flight</Text>
      {state.inFlight.length === 0 && <Text>No prepared handoff in this project is waiting on anything.</Text>}
      {state.inFlight.map((h) => (
        <Stack key={h.key} space="space.050">
          <Text>
            <Lozenge appearance={VERDICT[h.verdict].appearance}>{VERDICT[h.verdict].text}</Lozenge> {h.key} {h.summary}
          </Text>
          <Text>
            <User accountId={h.fromId} /> to <User accountId={h.toId} />, prepared {count(h.ageDays, "day")} ago.
          </Text>
          {h.blockedBy.length > 0 && <Text>{`Contradicts: ${h.blockedBy.join("; ")}.`}</Text>}
          {h.unacknowledged > 0 && <Text>{`${count(h.unacknowledged, "decision")} not acknowledged by the receiver.`}</Text>}
        </Stack>
      ))}
      <Text>Leaving the project</Text>
      <Text>
        Everything a person still holds in this project: their open work items, handoffs they have not acknowledged, and decisions only they can
        supersede.
      </Text>
      <UserPicker label="Person" name="leaving-person" onChange={(u: { id: string } | null | undefined) => void loadLeaving(u?.id)} />
      {leavingError !== null && <Text>{leavingError}</Text>}
      {leaving === null && leavingError === null && <Text>Reading what this person holds…</Text>}
      {leaving !== null && (
        <>
          {leaving.capped && <Text>{`Only the first ${leaving.scanned} open work items you can see were checked.`}</Text>}
          <Text>Open work items assigned to them</Text>
          {leaving.assigned.length === 0 && <Text>None.</Text>}
          {leaving.assigned.map((a) => (
            <Stack key={a.key} space="space.050">
              <Text>{`${a.key} ${a.summary}`}</Text>
              {a.handoff === "none" ? (
                <Text>Prepare a handoff on this work item.</Text>
              ) : a.handoff.verdict === "clear" ? (
                <Text>Handed over.</Text>
              ) : (
                <Text>
                  Prepared to <User accountId={a.handoff.toId} />: {a.handoff.verdict === "blocked" ? "Blocked" : "Needs info"}. Resolve the findings
                  on the work item.
                </Text>
              )}
            </Stack>
          ))}
          <Text>Handoffs they have not acknowledged</Text>
          {leaving.toAcknowledge.length === 0 && <Text>None.</Text>}
          {leaving.toAcknowledge.map((t) => (
            <Stack key={t.key} space="space.050">
              <Text>{`${t.key} ${t.summary}`}</Text>
              <Text>{`${count(t.waiting, "decision")} to acknowledge with a read-back on the work item.`}</Text>
            </Stack>
          ))}
          <Text>Decisions only they can supersede</Text>
          {leaving.decisions.length === 0 && <Text>None.</Text>}
          {leaving.decisions.map((d) => (
            <Stack key={d.id} space="space.050">
              <Text>{d.title}</Text>
              <Text>{d.reach}</Text>
              <Text>Supersede it here, or ask a teammate to record a replacement.</Text>
            </Stack>
          ))}
        </>
      )}
      <Text>Source: rule check on stored decisions and open work items read as you. Ranked by code: blocked first, then oldest.</Text>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

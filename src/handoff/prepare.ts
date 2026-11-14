import type { HandoffRecord } from "./types";

export const PREPARE_DENIED = "Only the sender, the assignee or a project administrator can prepare this handoff again, because it clears the receiver's acknowledgements.";

/**
 * Preparing again replaces the record and with it every acknowledgement, so once a record exists only the
 * people who answer for the handoff may do it. A first preparation is open to anyone who can open the item.
 */
export function mayPrepare(record: HandoffRecord | null, viewerId: string | null, assigneeId: string | null, isAdmin: boolean): boolean {
  if (record === null) return true;
  if (viewerId === null) return false;
  return isAdmin || viewerId === record.fromId || viewerId === assigneeId;
}

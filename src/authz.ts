// Whether the person may change the project's decisions. The answer comes from Jira's own permission check,
// asked as the person, so the app keeps no list of admins of its own.
export const MANAGE_DENIED = "Only a project administrator can change decisions. Ask one to do it, or to make you an administrator of this project.";

/** Reads the body of GET /rest/api/3/mypermissions?permissions=ADMINISTER_PROJECTS. Anything else is "no". */
export function hasAdminPermission(body: unknown): boolean {
  const p = (body as { permissions?: { ADMINISTER_PROJECTS?: { havePermission?: unknown } } } | null)?.permissions;
  return p?.ADMINISTER_PROJECTS?.havePermission === true;
}

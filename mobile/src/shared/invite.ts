// Invite-link helpers. A shared invite is a web URL (works for everyone; the
// /join route on the deployed web app handles it) plus the app deep link and
// the raw code for manual entry. Pure — safe on web and native.
export const JOIN_WEB_BASE = 'https://family-tree-6a597.web.app';

// Signed-out users tapping an invite stash the code here; the index gate
// forwards them back to /join right after sign-in.
export const PENDING_JOIN_CODE_KEY = 'ft.pendingJoinCode';

const clean = (code: string) => code.trim().toUpperCase();

export const joinUrl = (code: string) => `${JOIN_WEB_BASE}/join?code=${encodeURIComponent(clean(code))}`;

export const joinDeepLink = (code: string) => `familytree://join?code=${encodeURIComponent(clean(code))}`;

export const inviteMessage = (familyName: string, code: string) =>
  `Join "${familyName}" on Family Tree:\n${joinUrl(code)}\n\nInvite code: ${clean(code)}`;

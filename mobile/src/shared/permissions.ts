// Role-based permissions (pure). Four roles:
//   owner   — exactly one (the founder); full control, and the only role that can
//             delete the family or demote the founder.
//   coowner — full owner powers EXCEPT deleting the family / demoting the founder.
//   admin   — many; full data control (add/edit/delete anyone, import).
//   member  — normal user; may edit only their OWN linked node and add/remove
//             relationships at depth 1 (edges that touch their own node).
// Legacy roles ('editor' / 'viewer' from the old model) normalise to 'member'.
import type { Member } from './types';

export type Role = 'owner' | 'coowner' | 'admin' | 'member';

export function normalizeRole(r?: string | null): Role {
  return r === 'owner' ? 'owner' : r === 'coowner' ? 'coowner' : r === 'admin' ? 'admin' : 'member';
}

export const isOwner = (r?: string | null) => normalizeRole(r) === 'owner';
export const isCoOwner = (r?: string | null) => normalizeRole(r) === 'coowner';
export const isAdmin = (r?: string | null) => normalizeRole(r) === 'admin';

// Owner + co-owner share every owner power EXCEPT destroying the family and
// demoting the founding owner — those stay isOwner-only (UI + rules).
export const hasOwnerPowers = (r?: string | null) => {
  const x = normalizeRole(r);
  return x === 'owner' || x === 'coowner';
};

// Full data control: add/edit/delete any member, link/unlink anyone, import.
export const canManageData = (r?: string | null) => {
  const x = normalizeRole(r);
  return x === 'owner' || x === 'coowner' || x === 'admin';
};

// Owner + co-owner promote/demote collaborators.
export const canManageRoles = (r?: string | null) => hasOwnerPowers(r);

// Display label for a role (handles the two-word co-owner).
export const roleLabel = (r?: string | null): string => {
  const x = normalizeRole(r);
  return x === 'owner' ? 'Owner' : x === 'coowner' ? 'Co-owner' : x === 'admin' ? 'Admin' : 'Member';
};

// Bulk import is a privileged write — owner/admin only.
export const canImport = (r?: string | null) => canManageData(r);

// The member id the signed-in user is linked to (their own node), if any.
export const myMemberId = (members: Member[], uid?: string | null): string | undefined =>
  uid ? members.find((m) => m.associatedUserId === uid)?.id : undefined;

// Adding a brand-new person is allowed for everyone (needed to attach a
// relative). The depth-1 limit is enforced on the relationship, not the node.
export const canAddMember = (_r?: string | null) => true;

// A normal member may edit only the node linked to their own account.
export function canEditMember(role: string | null | undefined, member: Pick<Member, 'associatedUserId'> | undefined, uid?: string | null): boolean {
  if (canManageData(role)) return true;
  return !!uid && !!member && member.associatedUserId === uid;
}

// Deleting a node is owner/admin only (a member can't remove people).
export const canDeleteMember = (role?: string | null) => canManageData(role);

// Depth-1: a member may add/remove a relationship only if one endpoint is their
// own node. Owner/admin may link anyone.
export function canEditRelationship(role: string | null | undefined, fromId: string, toId: string, members: Member[], uid?: string | null): boolean {
  if (canManageData(role)) return true;
  const mine = myMemberId(members, uid);
  return !!mine && (fromId === mine || toId === mine);
}

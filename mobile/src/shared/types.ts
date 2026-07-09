// Core Firestore data model — ported verbatim from the web app, plus
// phone/email contact fields used by the mobile profile + dialogs.

export interface Member {
    id: string;
    name: string;
    photoUrl?: string;
    birthDate?: string;
    deathDate?: string;
    // Manual age order among the member's generation (1 = eldest). Only
    // consulted when birth years can't decide (see adjacency.compareByAge) —
    // a real birthDate always wins over this.
    birthOrder?: number;
    gender?: 'male' | 'female' | 'other';
    about?: string;
    associatedUserId?: string; // Links this node to a specific app user for "Me"

    // Contact (tappable in profile)
    phone?: string;
    email?: string;
    address?: string;
    location?: string;       // city / current location

    // Bio extras — all optional, only shown in profile when present
    maidenName?: string;
    occupation?: string;
    placeOfBirth?: string;
    favoriteQuote?: string;
    childhoodStories?: string;
    notes?: string;

    // Open-ended "and more": arbitrary user-added label/value pairs
    customFields?: Record<string, string>;
}

export type RelationshipType = 'parent' | 'spouse' | 'sibling';

export interface Relationship {
    id: string;
    fromId: string; // Convention: for 'parent', fromId = CHILD
    toId: string;   //             for 'parent', toId   = PARENT
    type: RelationshipType;
    status?: 'current' | 'divorced';
    marriageDate?: string; // spouse edges only — powers anniversary timeline events
}

export interface FamilyTreeData {
    members: Member[];
    relationships: Relationship[];
}

export interface TreeMetadata {
    id: string;
    name?: string;
    inviteCode?: string;
    allowedUsers?: string[];
}

// ---- Multi-family (membership restructure) ----
// owner: 1 per tree, manages roles. admin: full data control. member: normal
// user (own info + depth-1 links). Legacy 'editor'/'viewer' normalise to member.
export type FamilyRole = 'owner' | 'admin' | 'member';

// How outsiders join this tree:
//   'open'     — anyone with the invite code joins instantly (legacy behaviour;
//                also the default when the field is absent).
//   'approval' — the invite code creates a join request an owner/admin approves.
export type JoinPolicy = 'open' | 'approval';

// A tree a user can belong to. `id` is the Firestore treeId — for the legacy
// single tree it equals the owner's uid, so old data keeps loading unchanged.
export interface FamilyTree {
    id: string;
    name: string;
    mono?: string;          // monogram letter for the switcher
    color?: string;         // accent colour for the monogram chip
    ownerUid: string;
    inviteCode?: string;
    kind?: string;          // "Your bloodline", "Married in", …
    surname?: string;
    region?: string;
    established?: string;
    summary?: string;
    role?: FamilyRole;      // the current user's role in this tree
    photoUrl?: string;      // reduced (<1 MB) family group photo, inline base64
    joinPolicy?: JoinPolicy; // absent = 'open' (instant invite join)
    // Regional-language relationship terms (family default). relTerms maps a
    // canonical kinship key (see shared/relTerms.ts) → transliterated word
    // (English letters), generated once via Gemini.
    relLang?: string;
    relTerms?: Record<string, string>;
}

// Per-user profile (users/{uid}) — distinct from any family member node and from
// the per-user family index. Seeded from the account on first login; holds
// member-like details the user can sync onto their claimed node, plus a
// regional-language override that wins over the family default.
export interface UserProfile {
    uid: string;
    name?: string;
    email?: string;
    photoUrl?: string;
    birthDate?: string;
    gender?: 'male' | 'female' | 'other';
    phone?: string;
    address?: string;
    location?: string;
    occupation?: string;
    about?: string;
    relLang?: string;
    relTerms?: Record<string, string>;
}

// Index entry under users/{uid}/families/{treeId} — denormalised basics so the
// switcher renders from a single listener. `status: 'pending'` marks a family the
// user has REQUESTED to join (approval policy) but isn't a member of yet.
export interface Membership {
    treeId: string;
    role: FamilyRole;
    name: string;
    mono?: string;
    color?: string;
    status?: 'pending' | 'active';
}

export interface Collaborator {
    uid: string;
    email?: string;
    role: FamilyRole;
    online?: boolean;
}

// A user-created family event (get-together, reunion, …) rendered on the
// timeline. Stored at trees/{treeId}/events/{id}; the year of `date` drives
// timeline placement.
export interface FamilyEvent {
    id: string;
    title: string;
    date: string;            // ISO yyyy-mm-dd
    endDate?: string;        // optional range end
    location?: string;
    driveUrl?: string;       // Google Drive (or any) link
    description?: string;
    memberIds?: string[];    // optional links → also surfaces on those members' rows
    createdBy?: string;      // uid of the creator
}

// A request to join a family whose joinPolicy is 'approval'. Stored at
// trees/{treeId}/joinRequests/{uid}; an owner/admin flips `status`.
export interface JoinRequest {
    uid: string;
    email?: string;
    name?: string;
    message?: string;
    requestedAt?: number;
    status: 'pending' | 'approved' | 'rejected';
}

// ---- Master families (virtual overlay combining several trees) ----
// A master doesn't COPY data; it references constituent treeIds and stores the
// cross-family "bridge" edges that join them. Ids in the combined view are
// namespaced `${treeId}:${localMemberId}` so an edit routes back to the origin
// tree (see firebase/masters.ts splitId). Owner-private in v1.
//   'spouse' / 'parent' — a real relationship across two families (a=child for
//                         'parent'); adds a synthetic edge in the union.
//   'same'              — the two records are the SAME person recorded in both
//                         trees; the union collapses b into a (visual merge).
export type BridgeType = 'spouse' | 'parent' | 'same';

export interface BridgeLink {
    id: string;
    aTreeId: string;
    aMemberId: string;      // for 'parent': the CHILD
    bTreeId: string;
    bMemberId: string;      // for 'parent': the PARENT
    type: BridgeType;
    status?: 'current' | 'divorced'; // spouse bridges only
}

// masters/{masterId} — the combined-family document.
export interface MasterFamily {
    id: string;
    name: string;
    ownerUid: string;
    color?: string;
    memberTreeIds: string[];
    links: BridgeLink[];
    createdAt?: unknown;
}

// Index entry under users/{uid}/masters/{masterId} that powers the switcher.
export interface MasterIndex {
    masterId: string;
    name: string;
    color?: string;
    treeCount?: number;
    sig?: string;   // sorted treeIds joined — used to block duplicate combos
}

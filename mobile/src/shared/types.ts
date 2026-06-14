// Core Firestore data model — ported verbatim from the web app, plus
// phone/email contact fields used by the mobile profile + dialogs.

export interface Member {
    id: string;
    name: string;
    photoUrl?: string;
    birthDate?: string;
    deathDate?: string;
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
}

// Index entry under users/{uid}/families/{treeId} — denormalised basics so the
// switcher renders from a single listener.
export interface Membership {
    treeId: string;
    role: FamilyRole;
    name: string;
    mono?: string;
    color?: string;
}

export interface Collaborator {
    uid: string;
    email?: string;
    role: FamilyRole;
    online?: boolean;
}

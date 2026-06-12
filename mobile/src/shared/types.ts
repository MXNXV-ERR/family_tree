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

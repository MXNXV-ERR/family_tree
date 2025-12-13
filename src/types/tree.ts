export interface Member {
    id: string;
    name: string;
    photoUrl?: string;
    birthDate?: string;
    gender?: 'male' | 'female' | 'other';
    about?: string;
    associatedUserId?: string; // Links this node to a specific app user for "Me" identification
}

export type RelationshipType = 'parent' | 'spouse' | 'sibling';

export interface Relationship {
    id: string;
    fromId: string; // The person defined (e.g., Child)
    toId: string;   // The relative (e.g., Parent)
    type: RelationshipType;
}

// For the graph visualization
export interface FamilyTreeData {
    members: Member[];
    relationships: Relationship[];
}

export interface TreeMetadata {
    id: string; // The owner's UID
    name?: string; // Optional custom name for the tree
    inviteCode?: string;
    allowedUsers?: string[];
}

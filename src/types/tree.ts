export interface Member {
    id: string;
    name: string;
    photoUrl?: string;
    birthDate?: string;
    gender?: 'male' | 'female' | 'other';
    about?: string;
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

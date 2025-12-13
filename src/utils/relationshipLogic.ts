import { Member, Relationship } from '@/types/tree';

// Graph adjacency list: id -> neighbors[]
export type AdjacencyList = Record<string, { id: string; type: 'parent' | 'child' | 'spouse' | 'sibling' }[]>;

export function buildGraph(members: Member[], relationships: Relationship[]): AdjacencyList {
    const file: AdjacencyList = {};

    members.forEach(m => file[m.id] = []);

    relationships.forEach(rel => {
        if (!file[rel.fromId]) file[rel.fromId] = [];
        if (!file[rel.toId]) file[rel.toId] = [];

        // Directed edges but we store as undirected with semantics for traversal
        // fromId is the CHILD in 'parent' rel usually? 
        // Wait, let's standardize: 
        // If type is 'parent': fromId (Child) -> toId (Parent).

        if (rel.type === 'parent') {
            file[rel.fromId].push({ id: rel.toId, type: 'parent' });
            file[rel.toId].push({ id: rel.fromId, type: 'child' });
        } else if (rel.type === 'spouse') {
            file[rel.fromId].push({ id: rel.toId, type: 'spouse' });
            file[rel.toId].push({ id: rel.fromId, type: 'spouse' });
        } else if (rel.type === 'sibling') {
            file[rel.fromId].push({ id: rel.toId, type: 'sibling' });
            file[rel.toId].push({ id: rel.fromId, type: 'sibling' });
        }
    });

    return file;
}

export function findRelationshipPath(graph: AdjacencyList, startId: string, endId: string): string {
    if (startId === endId) return 'Self';

    // Simple BFS to find path
    const queue: { id: string; path: string[] }[] = [{ id: startId, path: [] }];
    const visited = new Set<string>();
    visited.add(startId);

    while (queue.length > 0) {
        const { id, path } = queue.shift()!;

        if (id === endId) {
            // Analyze path to determine relationship name
            return describeRelationship(path);
        }

        const neighbors = graph[id] || [];
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor.id)) {
                visited.add(neighbor.id);
                queue.push({ id: neighbor.id, path: [...path, neighbor.type] });
            }
        }
    }

    return 'No direct relationship found';
}

function describeRelationship(path: string[]): string {
    // This is a simplified logic. Real logic is complex (degrees, consanguinity).
    // Path is sequence of edge types from A to B.

    const p = path.join('-');

    // Direct
    if (p === 'parent') return 'Parent';
    if (p === 'child') return 'Child';
    if (p === 'spouse') return 'Spouse';
    if (p === 'sibling') return 'Sibling';

    // 2nd degree
    if (p === 'parent-parent') return 'Grandparent';
    if (p === 'child-child') return 'Grandchild';
    if (p === 'parent-sibling') return 'Uncle/Aunt'; // Parent's sibling
    if (p === 'sibling-child') return 'Niece/Nephew'; // Sibling's child

    // 3rd
    if (p === 'parent-parent-parent') return 'Great-grandparent';

    // Cousin logic (Parent's Sibling's Child)
    if (p === 'parent-sibling-child') return 'First Cousin';

    return `Relation path: ${p.replace(/-/g, ' -> ')}`;
}

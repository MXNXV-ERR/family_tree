// Relationship pathfinding for the chatbot / "how are we related" feature.
// Ported verbatim. Convention: 'parent' edge = fromId(child) -> toId(parent).
import type { Member, Relationship } from './types';

export type AdjacencyList = Record<string, { id: string; type: 'parent' | 'child' | 'spouse' | 'sibling' }[]>;

export function buildGraph(members: Member[], relationships: Relationship[]): AdjacencyList {
    const file: AdjacencyList = {};
    members.forEach((m) => (file[m.id] = []));

    relationships.forEach((rel) => {
        if (!file[rel.fromId]) file[rel.fromId] = [];
        if (!file[rel.toId]) file[rel.toId] = [];

        if (rel.type === 'parent') {
            file[rel.fromId].push({ id: rel.toId, type: 'parent' }); // child -> parent
            file[rel.toId].push({ id: rel.fromId, type: 'child' });  // parent -> child
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
    const queue: { id: string; path: string[] }[] = [{ id: startId, path: [] }];
    const visited = new Set<string>([startId]);

    while (queue.length > 0) {
        const { id, path } = queue.shift()!;
        if (id === endId) return describeRelationship(path);
        for (const neighbor of graph[id] || []) {
            if (!visited.has(neighbor.id)) {
                visited.add(neighbor.id);
                queue.push({ id: neighbor.id, path: [...path, neighbor.type] });
            }
        }
    }
    return 'No direct relationship found';
}

function describeRelationship(path: string[]): string {
    const p = path.join('-');
    if (p === 'parent') return 'Parent';
    if (p === 'child') return 'Child';
    if (p === 'spouse') return 'Spouse';
    if (p === 'sibling') return 'Sibling';
    if (p === 'parent-parent') return 'Grandparent';
    if (p === 'child-child') return 'Grandchild';
    if (p === 'parent-sibling') return 'Uncle/Aunt';
    if (p === 'sibling-child') return 'Niece/Nephew';
    if (p === 'parent-parent-parent') return 'Great-grandparent';
    if (p === 'parent-sibling-child') return 'First Cousin';
    return `Relation path: ${p.replace(/-/g, ' -> ')}`;
}

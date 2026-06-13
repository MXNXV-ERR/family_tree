// Human relationship label between two members ("Your grandparent", "First
// cousin of Jatin"). Thin wrapper over the BFS path engine, memoised per graph.
import type { Member, Relationship } from './types';
import { buildGraph, findRelationshipPath, type AdjacencyList } from './relationshipLogic';

let cacheKey = '';
let cachedGraph: AdjacencyList | null = null;

function graphFor(members: Member[], relationships: Relationship[]): AdjacencyList {
  const key = `${members.length}|${relationships.length}|${relationships[0]?.id ?? ''}`;
  if (cachedGraph && cacheKey === key) return cachedGraph;
  cachedGraph = buildGraph(members, relationships);
  cacheKey = key;
  return cachedGraph;
}

// Relationship of `ofId` relative to `toId` (e.g. ofId is toId's "Parent").
export function relationLabel(
  members: Member[],
  relationships: Relationship[],
  ofId: string,
  toId: string,
): string | undefined {
  if (!ofId || !toId) return undefined;
  if (ofId === toId) return 'You';
  const g = graphFor(members, relationships);
  const label = findRelationshipPath(g, toId, ofId);
  if (!label || label === 'No direct relationship found') return undefined;
  return label;
}

// "Your parent" / "You" — relationship of `id` to the signed-in user, ready for
// display in a focus bar. Undefined when there's no me or no path.
export function relToMe(
  members: Member[],
  relationships: Relationship[],
  id: string,
  meId?: string,
): string | undefined {
  if (!meId) return undefined;
  if (id === meId) return 'You';
  const label = relationLabel(members, relationships, id, meId);
  if (!label) return undefined;
  return label.startsWith('Relation path') ? label : `Your ${label.toLowerCase()}`;
}

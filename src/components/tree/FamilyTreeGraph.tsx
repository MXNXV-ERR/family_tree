
'use client';

import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    ConnectionLineType,
    Node,
    Edge,
    ReactFlowInstance
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { useAuth } from '@/context/AuthContext';
import { MemberNode } from './MemberNode';
import { MemberDialog } from './MemberDialog';
import { Member, Relationship } from '@/types/tree';
import { Skeleton } from "@/components/ui/skeleton";

const nodeTypes = {
    member: MemberNode,
};

/**
 * Layout Strategy: Virtual Grouping
 * 1. Identify "Spouse Clusters" (people connected by spouse edges).
 * 2. Treat each cluster as a single "Virtual Node" in Dagre.
 *    - Width = sum of widths of all members in cluster + spacing.
 * 3. Link Parent/Child edges to these Virtual Nodes.
 * 4. Run Dagre Layout.
 * 5. Unpack: Position members inside their Virtual Node's allocated space.
 */
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // Constants
    const NODE_WIDTH = 150;
    const NODE_HEIGHT = 150;
    const SPOUSE_SPACING = 50;
    const RANK_SEP = 150;
    const NODE_SEP = 80;

    dagreGraph.setGraph({
        rankdir: 'TB',
        nodesep: NODE_SEP,
        ranksep: RANK_SEP,
        ranker: 'network-simplex'
    });

    // 1. Identify Spouse Clusters
    // Map memberId -> clusterId
    const memberToCluster = new Map<string, string>();
    const clusters = new Map<string, string[]>(); // clusterId -> memberIds[]

    // Init every node as its own cluster
    nodes.forEach(n => {
        memberToCluster.set(n.id, n.id);
        clusters.set(n.id, [n.id]);
    });

    // Merge clusters based on Spouse edges
    edges.filter(e => e.data?.type === 'spouse').forEach(e => {
        const c1 = memberToCluster.get(e.source)!;
        const c2 = memberToCluster.get(e.target)!;

        if (c1 !== c2) {
            // Merge c2 into c1
            const members2 = clusters.get(c2)!;
            const members1 = clusters.get(c1)!;

            // Move members
            members2.forEach(mId => memberToCluster.set(mId, c1));
            clusters.set(c1, [...members1, ...members2]);
            clusters.delete(c2);
        }
    });

    // 2. Add Virtual Nodes to Dagre
    clusters.forEach((membersInCluster, clusterId) => {
        const width = membersInCluster.length * NODE_WIDTH + (membersInCluster.length - 1) * SPOUSE_SPACING;
        dagreGraph.setNode(clusterId, { width, height: NODE_HEIGHT });
    });

    // 3. Map Edges to Virtual Nodes
    edges.forEach(edge => {
        if (edge.data?.type === 'spouse') return; // Internal to cluster, ignore for layout

        const sourceCluster = memberToCluster.get(edge.source)!;
        const targetCluster = memberToCluster.get(edge.target)!;

        // Structure check: Ensure we don't link a cluster to itself (unless cycle)
        if (sourceCluster !== targetCluster) {
            dagreGraph.setEdge(sourceCluster, targetCluster, {
                minlen: 1,
                weight: 1
            });
        }
    });

    // 4. Run Layout
    dagre.layout(dagreGraph);

    // 5. Unpack Positions
    const layoutedNodes = nodes.map(originalNode => {
        const clusterId = memberToCluster.get(originalNode.id)!;
        const clusterMembers = clusters.get(clusterId)!;
        const clusterPos = dagreGraph.node(clusterId); // Center of the virtual node

        // Find index of this member in the cluster (sort alphabetically for stability)
        clusterMembers.sort();
        const index = clusterMembers.indexOf(originalNode.id);

        const clusterWidth = clusterMembers.length * NODE_WIDTH + (clusterMembers.length - 1) * SPOUSE_SPACING;
        const startX = clusterPos.x - (clusterWidth / 2); // Left edge of cluster

        // Calculate specific node X (Center of node)
        // x = startX + (index * (NODE_WIDTH + SPOUSE_SPACING)) + (NODE_WIDTH / 2)
        const nodeX = startX + (index * (NODE_WIDTH + SPOUSE_SPACING)) + (NODE_WIDTH / 2);
        const nodeY = clusterPos.y;

        originalNode.position = {
            // ReactFlow uses top-left origin
            x: nodeX - NODE_WIDTH / 2,
            y: nodeY - NODE_HEIGHT / 2
        };

        return originalNode;
    });

    return { nodes: layoutedNodes, edges };
};

interface FamilyTreeGraphProps {
    members: Member[];
    relationships: Relationship[];
    loading: boolean;
    treeId: string;
    focusNodeId?: string | null;
}

export function FamilyTreeGraph({ members, relationships, loading, treeId, focusNodeId }: FamilyTreeGraphProps) {
    const { user } = useAuth();

    // Loading State with Skeleton
    if (loading) {
        return (
            <div className="flex-1 w-full h-[calc(100vh-100px)] rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shadow-inner overflow-hidden p-8 flex flex-col items-center justify-center gap-8 relative">

                {/* Simulated Tree Structure - Root Level */}
                <div className="flex gap-16 relative z-10">
                    <div className="flex flex-col items-center gap-4">
                        <Skeleton className="h-28 w-28 rounded-full" />
                        <Skeleton className="h-6 w-32 rounded-lg" />
                    </div>
                    <div className="flex flex-col items-center gap-4">
                        <Skeleton className="h-28 w-28 rounded-full" />
                        <Skeleton className="h-6 w-32 rounded-lg" />
                    </div>
                </div>

                {/* Simulated Connecting Lines */}
                <div className="w-[200px] h-16 border-t-2 border-r-2 border-l-2 border-gray-200 dark:border-gray-700 rounded-t-2xl -mt-6 mb-[-30px]" />

                {/* Level 2: Children */}
                <div className="flex gap-12 z-10">
                    <div className="flex flex-col items-center gap-3">
                        <Skeleton className="h-24 w-24 rounded-full" />
                        <Skeleton className="h-5 w-24 rounded-lg" />
                    </div>
                    <div className="flex flex-col items-center gap-3">
                        <Skeleton className="h-24 w-24 rounded-full" />
                        <Skeleton className="h-5 w-24 rounded-lg" />
                    </div>
                    <div className="flex flex-col items-center gap-3">
                        <Skeleton className="h-24 w-24 rounded-full" />
                        <Skeleton className="h-5 w-24 rounded-lg" />
                    </div>
                </div>

                {/* Loading Text Overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-white/30 dark:bg-black/30 backdrop-blur-[2px] z-20">
                    <div className="bg-white dark:bg-gray-800 px-6 py-3 rounded-full shadow-lg flex items-center gap-3">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                        <span className="text-gray-600 dark:text-gray-300 font-medium text-sm ml-1">Loading Family Data...</span>
                    </div>
                </div>
            </div>
        );
    }

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // Edit Dialog State
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

    const handleEdit = useCallback((member: Member) => {
        setEditingMember(member);
        setIsEditDialogOpen(true);
    }, []);

    useEffect(() => {
        if (loading || members.length === 0) return;

        // Transform members to nodes
        const initialNodes: Node[] = members.map(m => ({
            id: m.id,
            type: 'member',
            data: {
                name: m.name,
                photoUrl: m.photoUrl,
                gender: m.gender,
                onEdit: () => handleEdit(m)
            },
            position: { x: 0, y: 0 },
            draggable: false, // Locked
            connectable: false
        }));

        // Transform relationships to edges.
        // Canonical parent edge is { fromId: child, toId: parent }; for the
        // top-down graph we draw parent (source) -> child (target).
        const initialEdges: Edge[] = relationships
            .filter(r => r.type !== 'sibling') // Filter out siblings from visual graph
            .map(r => {
                const isSpouse = r.type === 'spouse';
                const isSibling = r.type === 'sibling'; // This is now always false due to filter, but keeping for logic safety if filter removed later


                return {
                    id: r.id,
                    source: r.type === 'parent' ? r.toId : r.fromId,
                    target: r.type === 'parent' ? r.fromId : r.toId,
                    type: 'smoothstep',
                    animated: false,
                    data: { type: r.type }, // Pass type to layout engine
                    style: {
                        stroke: isSpouse ? '#ec4899' : (isSibling ? '#10b981' : '#6366f1'),
                        strokeWidth: 2,
                        strokeDasharray: isSpouse ? '5,5' : '0'
                    },
                    // Explicitly define handles based on relationship type
                    sourceHandle: isSpouse || isSibling ? 'right' : 'bottom',
                    targetHandle: isSpouse || isSibling ? 'left' : 'top',
                    label: isSpouse ? '❤️' : undefined
                };
            });

        // Filter edges for Layout Calculation to avoid Cycles
        // For Spouses we do NOT want them in the Dagre graph at all as edges, 
        // because we handle them by clustering starting in step 1 of getLayoutedElements.
        // But we DO pass them to getLayoutedElements so it can identify the clusters.
        // So we just pass ALL edges to getLayoutedElements.

        // OLD LOGIC (Removed): We used to filter them to avoid cycles. 
        // NEW LOGIC: We pass all edges. The getLayoutedElements function will inspect types
        // and choose which to use for ranking (structural) vs clustering (grouping).

        const { nodes: layoutedNodes } = getLayoutedElements(
            initialNodes,
            initialEdges
        );

        setNodes(layoutedNodes);
        setEdges(initialEdges); // Set ALL edges for rendering

    }, [members, relationships, loading, setNodes, setEdges, handleEdit]);

    const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);

    // Focus Effect
    useEffect(() => {
        if (focusNodeId && !loading && members.length > 0 && rfInstance) {
            // We need to wait for layout to settle, but usually nodes are already positioned by dagre
            // Find the node in the internal state
            const node = rfInstance.getNode(focusNodeId);
            if (node) {
                // NODE_WIDTH/Height is 150. Center is x + 75.
                rfInstance.setCenter(node.position.x + 75, node.position.y + 75, { zoom: 1.5, duration: 1200 });
            }
        }
    }, [focusNodeId, loading, members, rfInstance]);

    // Empty State
    if (members.length === 0) {
        return (
            <div className="flex-1 h-[calc(100vh-100px)] flex items-center justify-center text-gray-500 border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl bg-gray-50/50 dark:bg-gray-900/50">
                <div className="text-center">
                    <p className="text-lg font-medium mb-2">No family members yet</p>
                    <p className="text-sm">Add your first family member to get started!</p>
                </div>
            </div>
        )
    }

    return (
        <>
            {/* Full Height Container */}
            <div className="flex-1 w-full h-[calc(100vh-100px)] rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shadow-inner overflow-hidden relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    connectionLineType={ConnectionLineType.SmoothStep}
                    fitView
                    minZoom={0.2}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    elementsSelectable={true}
                    onInit={setRfInstance}
                >
                    <Background />
                    <Controls />
                </ReactFlow>
            </div>

            <MemberDialog
                member={editingMember}
                isOpen={isEditDialogOpen}
                onClose={() => setIsEditDialogOpen(false)}
                members={members}
                treeId={treeId}
            />
        </>
    );
}

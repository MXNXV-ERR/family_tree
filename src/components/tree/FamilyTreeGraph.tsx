
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
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { useAuth } from '@/context/AuthContext';
import { MemberNode } from './MemberNode';
import { MemberDialog } from './MemberDialog';
import { Member, Relationship } from '@/types/tree';

const nodeTypes = {
    member: MemberNode,
};

// Improved layout function with Strict TB and Locking
const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const nodeWidth = 150;
    const nodeHeight = 150;

    dagreGraph.setGraph({
        rankdir: 'TB',
        nodesep: 100,
        ranksep: 100,
        ranker: 'network-simplex'
    });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);

        node.position = {
            x: nodeWithPosition.x - nodeWidth / 2,
            y: nodeWithPosition.y - nodeHeight / 2,
        };
        return node;
    });

    return { nodes: layoutedNodes, edges };
};

interface FamilyTreeGraphProps {
    members: Member[];
    relationships: Relationship[];
    loading: boolean;
}

export function FamilyTreeGraph({ members, relationships, loading }: FamilyTreeGraphProps) {
    const { user } = useAuth();

    // We don't fetch here anymore, we use props

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
        console.log("Generating nodes with Base64 photos if present");
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

        // Transform relationships to edges
        const initialEdges: Edge[] = relationships.map(r => {
            const isSpouse = r.type === 'spouse';
            const isSibling = r.type === 'sibling';

            return {
                id: r.id,
                source: r.fromId,
                target: r.toId,
                type: 'smoothstep',
                animated: false,
                style: {
                    stroke: isSpouse ? '#ec4899' : (isSibling ? '#10b981' : '#6366f1'),
                    strokeWidth: 2,
                    strokeDasharray: isSpouse ? '5,5' : '0'
                },
                sourceHandle: isSpouse || isSibling ? 'right' : undefined,
                targetHandle: isSpouse || isSibling ? 'left' : undefined,
                label: isSpouse ? '❤️' : undefined
            };
        });

        // Apply Layout
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
            initialNodes,
            initialEdges
        );

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);

    }, [members, relationships, loading, setNodes, setEdges, handleEdit]);

    if (loading) {
        return <div className="h-full w-full flex items-center justify-center">Loading Tree...</div>;
    }

    if (members.length === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center text-gray-500">
                No family members yet. Add some to get started!
            </div>
        )
    }

    return (
        <>
            {/* Full Height Container */}
            <div className="flex-1 w-full h-[calc(100vh-100px)] rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shadow-inner overflow-hidden">
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
            />
        </>
    );
}

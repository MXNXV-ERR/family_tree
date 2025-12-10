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
import { useFamilyTree } from '@/hooks/useFamilyTree';
import { useAuth } from '@/context/AuthContext';
import { MemberNode } from './MemberNode';

const nodeTypes = {
    member: MemberNode,
};

const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    const nodeWidth = 150;
    const nodeHeight = 150;

    dagreGraph.setGraph({ rankdir: 'TB' });

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

export function FamilyTreeGraph() {
    const { user } = useAuth();
    const { members, relationships, loading } = useFamilyTree(user?.uid);

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    useEffect(() => {
        if (loading || members.length === 0) return;

        // Transform members to nodes
        const initialNodes: Node[] = members.map(m => ({
            id: m.id,
            type: 'member',
            data: { name: m.name, photoUrl: m.photoUrl, gender: m.gender },
            position: { x: 0, y: 0 }, // Handled by dagre
        }));

        // Transform relationships to edges
        const initialEdges: Edge[] = relationships.map(r => ({
            id: r.id,
            source: r.fromId, // Assuming Parent -> Child for typical tree layout
            target: r.toId,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#6366f1' },
        }));

        // Apply Layout
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
            initialNodes,
            initialEdges
        );

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);

    }, [members, relationships, loading, setNodes, setEdges]);

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
        <div className="h-[600px] w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 shadow-inner overflow-hidden">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                connectionLineType={ConnectionLineType.SmoothStep}
                fitView
            >
                <Background />
                <Controls />
            </ReactFlow>
        </div>
    );
}

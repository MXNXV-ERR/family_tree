'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useFamilyTree } from '@/hooks/useFamilyTree';
import { buildGraph, findRelationshipPath } from '@/utils/relationshipLogic';
import { Button } from '@/components/ui/button';
import { MessageSquare, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function RelationshipChat() {
    const { user } = useAuth();
    const { members, relationships } = useFamilyTree(user?.uid);

    const [isOpen, setIsOpen] = useState(false);
    const [memberA, setMemberA] = useState('');
    const [memberB, setMemberB] = useState('');
    const [result, setResult] = useState<string | null>(null);

    const handleAsk = () => {
        if (!memberA || !memberB) return;

        // 1. Build Graph
        const graph = buildGraph(members, relationships);

        // 2. Find Path
        const rel = findRelationshipPath(graph, memberA, memberB);

        const nameA = members.find(m => m.id === memberA)?.name;
        const nameB = members.find(m => m.id === memberB)?.name;

        setResult(`${nameA} is ${nameB}'s ${rel}`);
    };

    return (
        <>
            <Button
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-xl z-40"
                onClick={() => setIsOpen(true)}
            >
                <MessageSquare className="h-6 w-6" />
            </Button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 100 }}
                        className="fixed bottom-24 right-6 w-80 sm:w-96 glass-card p-4 z-40 flex flex-col gap-4"
                    >
                        <div className="flex justify-between items-center border-b pb-2 mb-2">
                            <h3 className="font-bold">Family Assistant</h3>
                            <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-red-500">Close</button>
                        </div>

                        <div className="bg-white/50 p-3 rounded-lg min-h-[100px] flex items-center justify-center text-center text-sm">
                            {result ? (
                                <p className="font-medium text-indigo-800">{result}</p>
                            ) : (
                                <p className="text-gray-500">"Ask me about the relationship between two family members!"</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <select
                                className="w-full text-sm p-2 rounded-md border"
                                value={memberA}
                                onChange={(e) => setMemberA(e.target.value)}
                            >
                                <option value="">Select First Person</option>
                                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>

                            <select
                                className="w-full text-sm p-2 rounded-md border"
                                value={memberB}
                                onChange={(e) => setMemberB(e.target.value)}
                            >
                                <option value="">Select Second Person</option>
                                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>

                            <Button className="w-full" size="sm" onClick={handleAsk} disabled={!memberA || !memberB}>
                                <Send className="mr-2 h-4 w-4" /> Ask Relationship
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

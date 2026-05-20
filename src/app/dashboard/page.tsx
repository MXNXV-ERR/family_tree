'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Link as LinkIcon, LogOut, Share2, X, Copy, ArrowLeft, Users, Settings, ScanFace } from 'lucide-react';

import { MemberDialog } from '@/components/tree/MemberDialog';
import { useFamilyTree } from '@/hooks/useFamilyTree';
import { AddRelationshipDialog } from '@/components/tree/AddRelationshipDialog';
import { FamilyExplorer } from '@/components/familyExplorer/FamilyExplorer';
import GeminiChat from '@/components/GeminiChat';
import { familyActions } from '@/lib/firebase/familyActions';
import { useTreeList } from '@/hooks/useTreeList';
import { TreeSelector } from '@/components/dashboard/TreeSelector';
import { TreeSettingsDialog } from '@/components/dashboard/TreeSettingsDialog';
import { FaceSearchDialog } from '@/components/dashboard/FaceSearchDialog';

export default function Dashboard() {
    const { user, logout, loading: authLoading } = useAuth();
    const router = useRouter();

    // 1. Manage Active Tree View
    const [viewTreeId, setViewTreeId] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<any>(null); // For future use

    // Initialize viewTreeId from localStorage
    useEffect(() => {
        if (user) {
            const stored = localStorage.getItem('activeTreeId');
            if (stored) {
                setViewTreeId(stored);
            } else {
                setViewTreeId(null);
            }
        }
    }, [user]);

    // Fetch List of Trees
    const { trees: availableTrees, loading: listLoading } = useTreeList(user?.uid);
    const userTrees = availableTrees.filter(t => t.id === user?.uid);
    const sharedTrees = availableTrees.filter(t => t.id !== user?.uid);

    // Use the hook with the ACTIVE tree ID (if selected)
    const { members, relationships, loading: treeLoading, treeMetadata } = useFamilyTree(viewTreeId || undefined);

    // Find nodes matching members for graph (simplification)
    const nodes = members.map(m => ({ id: m.id, data: { label: m.name } }));

    // Modal States
    const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
    const [isRelModalOpen, setIsRelModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isFaceSearchOpen, setIsFaceSearchOpen] = useState(false);

    const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
    const [chatTrigger, setChatTrigger] = useState<string | null>(null);

    // Protected Route Check
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // Show loading state while auth is initializing
    if (authLoading || (user && listLoading)) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-black">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            </div>
        );
    }

    if (!user) return null;

    const isMyTree = viewTreeId === user.uid;

    const handleResetView = () => {
        localStorage.removeItem('activeTreeId');
        setViewTreeId(null); // Go back to selection
    };

    const handleSelectTree = (treeId: string) => {
        localStorage.setItem('activeTreeId', treeId);
        setViewTreeId(treeId);
    };

    const handleFaceMatch = (memberId: string) => {
        // 1. Focus Graph
        setFocusNodeId(memberId);

        // 2. Trigger Chat
        const member = members.find(m => m.id === memberId);
        if (member) {
            setChatTrigger(`How am I related to ${member.name}?`);
        }
    };

    // If no tree selected, show selector
    if (!viewTreeId) {
        return (
            <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-8 font-sans flex flex-col items-center">
                <div className="absolute top-4 right-4">
                    <Button variant="ghost" onClick={logout}>
                        <LogOut className="h-5 w-5 mr-2" /> Logout
                    </Button>
                </div>
                <TreeSelector
                    userTrees={userTrees}
                    sharedTrees={sharedTrees}
                    onSelectTree={handleSelectTree}
                    currentUserId={user.uid}
                />
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 sm:p-8 font-sans">
            <div className="max-w-7xl mx-auto flex flex-col gap-6">

                {/* Header */}
                <header className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-card p-6 rounded-3xl">
                    <div>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={handleResetView} className="-ml-2 text-gray-400 hover:text-gray-600">
                                <ArrowLeft className="h-4 w-4" /> Back
                            </Button>
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight mt-1">
                            {treeMetadata?.name || (isMyTree ? 'My Family Tree' : 'Shared Family Tree')}
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                            Welcome back, {user.email}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={() => setIsFaceSearchOpen(true)} title="Find by Face">
                            <ScanFace className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        </Button>
                        {isMyTree && (
                            <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)} title="Settings">
                                <Settings className="h-5 w-5 text-gray-500" />
                            </Button>
                        )}
                        <Button onClick={() => setIsMemberModalOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Add Member
                        </Button>
                        <Button variant="outline" onClick={() => setIsRelModalOpen(true)}>
                            <LinkIcon className="mr-2 h-4 w-4" /> Link
                        </Button>
                        <Button variant="ghost" onClick={handleResetView} title="Switch Tree">
                            <Users className="h-5 w-5" />
                        </Button>
                    </div>
                </header>

                {/* Main Content Area */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-6"
                >
                    {/* Graph View */}
                    <section className="glass-card p-4 h-[650px] relative">
                        <FamilyExplorer
                            members={members}
                            relationships={relationships}
                            loading={treeLoading}
                            treeId={viewTreeId}
                            focusNodeId={focusNodeId}
                            userId={user.uid}
                        />
                    </section>
                </motion.div>
            </div>

            {/* Modals */}
            <MemberDialog
                isOpen={isMemberModalOpen}
                onClose={() => setIsMemberModalOpen(false)}
                members={members}
                treeId={viewTreeId}
            />
            <AddRelationshipDialog
                isOpen={isRelModalOpen}
                onClose={() => setIsRelModalOpen(false)}
                treeId={viewTreeId}
                members={members}
            />

            <TreeSettingsDialog
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                treeMetadata={treeMetadata || null}
                currentUserId={user.uid}
                members={members}
            />

            {/* Face Search Dialog */}
            <FaceSearchDialog
                isOpen={isFaceSearchOpen}
                onClose={() => setIsFaceSearchOpen(false)}
                members={members}
                onMatchFound={handleFaceMatch}
            />

            {/* Chat Bot */}
            <GeminiChat
                triggerPrompt={chatTrigger}
                onTriggerHandled={() => setChatTrigger(null)}
                members={members}
                relationships={relationships}
            />
        </main>
    );
}

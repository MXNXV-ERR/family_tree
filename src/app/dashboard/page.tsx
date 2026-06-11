'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Link as LinkIcon, LogOut, Users, Settings, ScanFace } from 'lucide-react';

import { MemberDialog } from '@/components/tree/MemberDialog';
import { useFamilyTree } from '@/hooks/useFamilyTree';
import { AddRelationshipDialog } from '@/components/tree/AddRelationshipDialog';
import { FamilyExplorer } from '@/components/familyExplorer/FamilyExplorer';
import GeminiChat from '@/components/GeminiChat';
import { useTreeList } from '@/hooks/useTreeList';
import { TreeSelector } from '@/components/dashboard/TreeSelector';
import { TreeSettingsDialog } from '@/components/dashboard/TreeSettingsDialog';
import { FaceSearchDialog } from '@/components/dashboard/FaceSearchDialog';

export default function Dashboard() {
    const { user, logout, loading: authLoading } = useAuth();
    const router = useRouter();

    // 1. Manage Active Tree View
    const [viewTreeId, setViewTreeId] = useState<string | null>(null);

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
        <main className="min-h-dvh bg-gray-50 dark:bg-gray-950 p-3 sm:p-5 font-sans">
            {/* Single unified panel: header + visualizer merged inside FamilyExplorer */}
            <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto max-w-[1600px] h-[calc(100dvh-1.5rem)] sm:h-[calc(100dvh-2.5rem)] relative rounded-3xl overflow-hidden shadow-xl border border-white/40 dark:border-white/10"
            >
                <FamilyExplorer
                    members={members}
                    relationships={relationships}
                    loading={treeLoading}
                    treeId={viewTreeId}
                    focusNodeId={focusNodeId}
                    userId={user.uid}
                    title={treeMetadata?.name || (isMyTree ? 'My Family Tree' : 'Shared Family Tree')}
                    subtitle={user.email ?? undefined}
                    onBack={handleResetView}
                    actions={
                        <>
                            <button className="fe-icon-btn" onClick={() => setIsFaceSearchOpen(true)} title="Find by face" aria-label="Find by face">
                                <ScanFace size={17} strokeWidth={1.8} />
                            </button>
                            {isMyTree && (
                                <button className="fe-icon-btn" onClick={() => setIsSettingsOpen(true)} title="Tree settings" aria-label="Tree settings">
                                    <Settings size={17} strokeWidth={1.8} />
                                </button>
                            )}
                            <button className="fe-icon-btn" onClick={handleResetView} title="Switch tree" aria-label="Switch tree">
                                <Users size={17} strokeWidth={1.8} />
                            </button>
                            <button className="fe-btn" onClick={() => setIsRelModalOpen(true)}>
                                <LinkIcon size={14} strokeWidth={2} /> Link
                            </button>
                            <button className="fe-btn fe-btn-primary" onClick={() => setIsMemberModalOpen(true)}>
                                <Plus size={15} strokeWidth={2.2} /> Add
                            </button>
                        </>
                    }
                />
            </motion.section>

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

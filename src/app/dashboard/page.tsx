'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Link as LinkIcon, LogOut } from 'lucide-react';

import { AddMemberDialog } from '@/components/tree/AddMemberDialog';
import { AddRelationshipDialog } from '@/components/tree/AddRelationshipDialog';
import { FamilyTreeGraph } from '@/components/tree/FamilyTreeGraph';
import GeminiChat from '@/components/GeminiChat';

export default function Dashboard() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();

    const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
    const [isRelModalOpen, setIsRelModalOpen] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-black">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <main className="min-h-screen p-4 sm:p-8 bg-gray-50 dark:bg-black">
            <div className="mx-auto max-w-7xl space-y-6">
                {/* Header */}
                <header className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-card p-6 rounded-3xl">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            My <span className="text-gradient">Family Tree</span>
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Welcome back, {user.email}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => setIsMemberModalOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" /> Add Member
                        </Button>
                        <Button variant="secondary" onClick={() => setIsRelModalOpen(true)}>
                            <LinkIcon className="mr-2 h-4 w-4" /> Link
                        </Button>
                        <Button variant="ghost" onClick={logout}>
                            <LogOut className="h-5 w-5" />
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
                        <FamilyTreeGraph />
                    </section>
                </motion.div>
            </div>

            {/* Modals */}
            <AddMemberDialog
                isOpen={isMemberModalOpen}
                onClose={() => setIsMemberModalOpen(false)}
            />
            <AddRelationshipDialog
                isOpen={isRelModalOpen}
                onClose={() => setIsRelModalOpen(false)}
            />

            {/* Chat Bot */}
            {/* Chat Bot */}
            <GeminiChat />
        </main>
    );
}

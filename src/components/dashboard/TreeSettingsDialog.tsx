
'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TreeMetadata, Member } from '@/types/tree';
import { familyActions } from '@/lib/firebase/familyActions';
import { Loader2, Settings, Users, ShieldCheck, User, Share2, Copy } from 'lucide-react';

interface TreeSettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    treeMetadata: TreeMetadata | null;
    currentUserId: string;
    members: Member[];
}

export function TreeSettingsDialog({ isOpen, onClose, treeMetadata, currentUserId, members }: TreeSettingsDialogProps) {
    const [activeTab, setActiveTab] = useState<'general' | 'access' | 'share'>('general');
    const [name, setName] = useState(treeMetadata?.name || '');
    const [loading, setLoading] = useState(false);

    const shareUrl = typeof window !== 'undefined' && treeMetadata?.inviteCode
        ? `${window.location.origin}/join?id=${treeMetadata.id}&code=${treeMetadata.inviteCode}`
        : '';

    const handleGenerateCode = async () => {
        if (!treeMetadata?.id) return;
        setLoading(true);
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        try {
            await familyActions.updateTreeMetadata(treeMetadata.id, { inviteCode: code });
        } catch (err) {
            console.error("Failed to generate code:", err);
            alert("Failed to generate invite code.");
        } finally {
            setLoading(false);
        }
    };

    // Sync state when metadata loads
    useEffect(() => {
        if (treeMetadata?.name) {
            setName(treeMetadata.name);
        }
    }, [treeMetadata]);

    // Filter members who are linked to a user account
    const linkedMembers = members.filter(m => m.associatedUserId);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!treeMetadata?.id) return;

        setLoading(true);
        try {
            await familyActions.updateTreeMetadata(treeMetadata.id, { name });
            onClose();
        } catch (error) {
            console.error("Failed to update tree settings:", error);
            alert("Failed to save settings.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Tree Settings"
        >
            <div className="flex flex-col gap-6">
                {/* Tabs */}
                <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${activeTab === 'general'
                            ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Settings size={16} /> General
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('access')}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${activeTab === 'access'
                            ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Users size={16} /> Access
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('share')}
                        className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${activeTab === 'share'
                            ? 'bg-white dark:bg-gray-700 shadow-sm text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                            }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Share2 size={16} /> Share
                        </div>
                    </button>
                </div>

                {/* Content */}
                <div className="min-h-[300px]">
                    {activeTab === 'general' && (
                        <form onSubmit={handleSave} className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Family Tree Name
                                </label>
                                <Input
                                    placeholder="e.g. The Smith Family"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                                <p className="text-xs text-gray-500">
                                    This name will be displayed in the dashboard header.
                                </p>
                            </div>

                            <div className="flex justify-end pt-4">
                                <Button type="button" variant="outline" onClick={onClose} className="mr-2">
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={loading}>
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    )}

                    {activeTab === 'access' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

                            {/* Joined Users Section */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <ShieldCheck className="text-green-500" size={16} /> Authorized Users
                                </h3>
                                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold uppercase text-gray-400">Total Users</span>
                                        <span className="bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 text-xs px-2 py-0.5 rounded-full font-mono">
                                            {(treeMetadata?.allowedUsers?.length || 0) + 1}
                                        </span>
                                    </div>
                                    <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700">
                                            <div className="w-2 h-2 rounded-full bg-green-500" />
                                            <span className="font-mono text-xs">{treeMetadata?.id}</span>
                                            <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 rounded-full">Owner</span>
                                        </div>
                                        {treeMetadata?.allowedUsers?.map(uid => (
                                            <div key={uid} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700">
                                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                                <span className="font-mono text-xs">{uid}</span>
                                                <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 rounded-full">Member</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Linked Members Section */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <User className="text-indigo-500" size={16} /> Linked Family Members
                                </h3>
                                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                                    {linkedMembers.length === 0 ? (
                                        <p className="text-sm text-gray-500 text-center py-4">No family members are currently linked to user accounts.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {linkedMembers.map(m => (
                                                <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700">
                                                    <div className="flex items-center gap-3">
                                                        {m.photoUrl ? (
                                                            <img src={m.photoUrl} alt={m.name} className="w-8 h-8 rounded-full object-cover" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                                                                {m.name.charAt(0)}
                                                            </div>
                                                        )}
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white">{m.name}</p>
                                                            <p className="text-xs text-gray-500">Member ID: {m.id.slice(0, 6)}...</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-mono text-gray-400">Linked to User:</p>
                                                        <p className="text-xs font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded">
                                                            {m.associatedUserId?.slice(0, 10)}...
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    )}

                    {activeTab === 'share' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-4">
                                <p className="text-sm text-gray-600 dark:text-gray-300">
                                    Invite others to view and edit this family tree. They will join as separate users but share the same data.
                                </p>

                                {treeMetadata?.inviteCode ? (
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase text-gray-400">Share Link</label>
                                        <div className="flex gap-2">
                                            <Input
                                                readOnly
                                                value={shareUrl}
                                                className="bg-gray-50 dark:bg-gray-900 font-mono text-xs"
                                            />
                                            <Button size="icon" variant="outline" onClick={() => navigator.clipboard.writeText(shareUrl)}>
                                                <Copy size={16} />
                                            </Button>
                                        </div>
                                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-200 dark:border-yellow-800/50">
                                            <p className="text-xs text-yellow-800 dark:text-yellow-200">
                                                <strong>Note:</strong> Anyone with this link can join and modify your tree.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl text-center">
                                        <p className="text-sm text-indigo-800 dark:text-indigo-200 mb-3">
                                            No invite link active. Generate one to start sharing.
                                        </p>
                                        <Button onClick={handleGenerateCode} className="w-full" disabled={loading}>
                                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Generate Invite Link
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}

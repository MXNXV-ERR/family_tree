'use client';

import { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { addRelationship } from '@/lib/firebase/firestore';
import { Member } from '@/types/tree';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { useFamilyTree } from '@/hooks/useFamilyTree';

interface AddRelationshipDialogProps {
    isOpen: boolean;
    onClose: () => void;
    treeId: string;
    members: Member[];
}

export function AddRelationshipDialog({ isOpen, onClose, treeId, members }: AddRelationshipDialogProps) {
    const { user } = useAuth();
    // Removed duplicate useFamilyTree hook

    const [fromId, setFromId] = useState('');
    const [toId, setToId] = useState('');
    const [type, setType] = useState<'parent' | 'spouse' | 'sibling'>('parent');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !fromId || !toId) return;

        if (fromId === toId) {
            alert("Cannot create relationship with self");
            return;
        }

        setLoading(true);
        try {
            await addRelationship(treeId, {
                fromId,
                toId,
                type,
            });
            onClose();
            setFromId('');
            setToId('');
        } catch (error) {
            console.error('Error adding relationship:', error);
            alert('Failed to add relationship');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Define Relationship">
            <form onSubmit={handleSubmit} className="space-y-4">

                <div className="space-y-2">
                    <label className="text-sm font-medium">Person A (Start)</label>
                    <select
                        className="w-full rounded-xl border p-3 bg-white/50 dark:bg-gray-900/50"
                        value={fromId}
                        onChange={(e) => setFromId(e.target.value)}
                        required
                    >
                        <option value="">Select Member</option>
                        {members.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Relationship</label>
                    <div className="flex gap-2">
                        <select
                            className="w-full rounded-xl border p-3 bg-white/50 dark:bg-gray-900/50 font-bold"
                            value={type}
                            onChange={(e: any) => setType(e.target.value)}
                        >
                            <option value="parent">is Parent of</option>
                            <option value="spouse">is Spouse of</option>
                            <option value="sibling">is Sibling of</option>
                        </select>
                    </div>
                    <p className="text-xs text-gray-500">
                        Read as: [Person A] {type === 'parent' ? 'is Parent of' : type === 'spouse' ? 'is Spouse of' : 'is Sibling of'} [Person B]
                    </p>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium">Person B (Target)</label>
                    <select
                        className="w-full rounded-xl border p-3 bg-white/50 dark:bg-gray-900/50"
                        value={toId}
                        onChange={(e) => setToId(e.target.value)}
                        required
                    >
                        <option value="">Select Member</option>
                        {members.filter(m => m.id !== fromId).map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={loading} disabled={!fromId || !toId}>
                        Add Link
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

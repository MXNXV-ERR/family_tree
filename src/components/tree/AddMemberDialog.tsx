'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { addMember } from '@/lib/firebase/firestore';
import { uploadPhoto } from '@/lib/firebase/storage';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

interface AddMemberDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AddMemberDialog({ isOpen, onClose }: AddMemberDialogProps) {
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
    const [photo, setPhoto] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        try {
            let photoUrl = '';
            if (photo) {
                photoUrl = await uploadPhoto(user.uid, photo);
            }

            await addMember(user.uid, {
                name,
                birthDate,
                gender,
                photoUrl,
                about: '',
            });

            onClose();
            // Reset form
            setName('');
            setBirthDate('');
            setPhoto(null);
        } catch (error) {
            console.error('Error adding member:', error);
            alert('Failed to add member');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Family Member">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col items-center gap-4">
                    <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600">
                        {photo ? (
                            <img
                                src={URL.createObjectURL(photo)}
                                alt="Preview"
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <Upload className="h-8 w-8 text-gray-400" />
                        )}
                        <input
                            type="file"
                            accept="image/*"
                            className="absolute inset-0 cursor-pointer opacity-0"
                            onChange={(e) => {
                                if (e.target.files?.[0]) setPhoto(e.target.files[0]);
                            }}
                        />
                    </div>
                    <span className="text-xs text-gray-500">Tap to upload photo</span>
                </div>

                <Input
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    label="Name"
                />

                <div className="grid grid-cols-2 gap-4">
                    <Input
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        label="Birth Date"
                    />
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Gender</label>
                        <select
                            className="flex h-12 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                            value={gender}
                            onChange={(e: any) => setGender(e.target.value)}
                        >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                        </select>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={loading}>
                        Add Member
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

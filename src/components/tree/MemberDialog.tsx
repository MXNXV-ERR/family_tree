
'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { addMember, updateMember } from '@/lib/firebase/firestore';
import { Member } from '@/types/tree';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Loader2, Upload } from 'lucide-react';

interface MemberDialogProps {
    isOpen: boolean;
    onClose: () => void;
    member?: Member | null; // If provided, we are in EDIT mode. If null/undefined, ADD mode.
    members: Member[];
    treeId: string;
}

export function MemberDialog({ isOpen, onClose, member, members, treeId }: MemberDialogProps) {
    const { user } = useAuth();

    // Form State
    const [name, setName] = useState('');
    const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
    const [birthDate, setBirthDate] = useState('');
    const [about, setAbout] = useState('');
    const [isSelf, setIsSelf] = useState(false);

    // Image State
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isEditMode = !!member;

    // Reset or Populate Form
    useEffect(() => {
        if (isOpen) {
            if (member) {
                // Edit Mode
                setName(member.name);
                setGender(member.gender || 'male');
                setBirthDate(member.birthDate || '');
                setAbout(member.about || '');
                setIsSelf(member.associatedUserId === user?.uid);
                setPreviewUrl(member.photoUrl || null);
                setPhotoFile(null);
            } else {
                // Add Mode - Reset
                setName('');
                setGender('male');
                setBirthDate('');
                setAbout('');
                setIsSelf(false);
                setPreviewUrl(null);
                setPhotoFile(null);
            }
        }
    }, [isOpen, member, user]);

    // Handle File Selection
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setPhotoFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    // Image Compression Logic
    const processImage = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 500;
                    const MAX_HEIGHT = 500;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
                img.onerror = (error) => reject(error);
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        try {
            // 1. Handle Unclaiming Other "Me" Nodes
            if (isSelf) {
                const otherMeNodes = members.filter(
                    m => m.associatedUserId === user.uid && m.id !== member?.id
                );

                if (otherMeNodes.length > 0) {
                    console.log("Unclaiming other 'Me' nodes:", otherMeNodes.map(m => m.name));
                    await Promise.all(otherMeNodes.map(m =>
                        // @ts-ignore
                        updateMember(treeId, m.id, { associatedUserId: null })
                    ));
                }
            }

            // 2. Handle Image
            let finalPhotoUrl = isEditMode ? member?.photoUrl : '';
            if (photoFile) {
                finalPhotoUrl = await processImage(photoFile);
            }

            // 3. Handle Associated User ID (Me Node)
            const existingAssocId = member?.associatedUserId || null;
            const newAssociatedUserId = isSelf
                ? user.uid
                : (existingAssocId === user.uid ? null : existingAssocId);

            const commonData = {
                name,
                gender,
                birthDate,
                about,
                photoUrl: finalPhotoUrl || null,
                associatedUserId: newAssociatedUserId || null
            };

            if (isEditMode && member) {
                // @ts-ignore
                await updateMember(treeId, member.id, commonData);
            } else {
                // @ts-ignore
                await addMember(treeId, commonData);
            }

            onClose();
        } catch (error) {
            console.error('Error saving member:', error);
            alert('Failed to save member');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditMode ? `Edit ${member?.name}` : "Add Family Member"}
        >
            <form onSubmit={handleSubmit} className="space-y-5">

                {/* Photo Upload */}
                <div className="flex flex-col items-center gap-4">
                    <div className="relative group">
                        <div className="w-28 h-28 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center shadow-inner">
                            {previewUrl ? (
                                <img
                                    src={previewUrl}
                                    alt="Preview"
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <Upload className="h-8 w-8 text-gray-400" />
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute bottom-1 right-1 bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:bg-indigo-700 transition-transform active:scale-95"
                        >
                            <Upload className="h-4 w-4" />
                        </button>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileSelect}
                    />
                    <span className="text-xs text-gray-400">
                        {isEditMode ? "Change Photo" : "Upload Photo"}
                    </span>
                </div>

                {/* Fields */}
                <div className="space-y-4">
                    <Input
                        label="Full Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Grandma Betty"
                        required
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            type="date"
                            label="Birth Date"
                            value={birthDate}
                            onChange={(e) => setBirthDate(e.target.value)}
                        />

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Gender
                            </label>
                            <select
                                className="flex h-10 w-full rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2 text-sm focus-visible:outline-none focus:ring-2 focus:ring-indigo-500"
                                value={gender}
                                onChange={(e: any) => setGender(e.target.value)}
                            >
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            About / Bio
                        </label>
                        <textarea
                            className="w-full min-h-[80px] p-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
                            placeholder="Share a brief story or memory..."
                            value={about}
                            onChange={(e) => setAbout(e.target.value)}
                        />
                    </div>

                    {/* 'Me' Checkbox */}
                    <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                        {isEditMode && member?.associatedUserId && member.associatedUserId !== user?.uid ? (
                            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800/50">
                                <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium flex items-center gap-2">
                                    Linked to another user
                                </p>
                                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                                    This family member is already claimed by another user account.
                                </p>
                            </div>
                        ) : (
                            <>
                                <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={isSelf}
                                        onChange={(e) => setIsSelf(e.target.checked)}
                                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300 dark:border-gray-600"
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                                        This is me
                                    </span>
                                </label>
                                <p className="text-xs text-gray-500 dark:text-gray-400 pl-7">
                                    Selecting this links your user profile to this family member node.
                                </p>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEditMode ? 'Save Changes' : 'Add Member'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

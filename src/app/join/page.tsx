'use client';

import { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

function JoinPageContent() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const treeId = searchParams.get('id');
    const inviteCode = searchParams.get('code');

    const [status, setStatus] = useState<'verifying' | 'joining' | 'success' | 'error'>('verifying');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (loading) return;

        if (!user) {
            // Redirect to login with return url preserving query params
            const returnUrl = `/join?id=${treeId}&code=${inviteCode}`;
            router.push(`/login?redirect=${encodeURIComponent(returnUrl)}`);
            return;
        }

        if (!treeId || !inviteCode) {
            setStatus('error');
            setErrorMessage('Invalid invitation link. Missing details.');
            return;
        }

        const joinTree = async () => {
            setStatus('joining');
            try {
                const treeRef = doc(db, 'trees', treeId);
                const treeSnap = await getDoc(treeRef);

                if (!treeSnap.exists()) {
                    throw new Error("Tree not found.");
                }

                const treeData = treeSnap.data();
                if (treeData.inviteCode !== inviteCode) {
                    throw new Error("Invalid or expired invite code.");
                }

                // Add user to allowedUsers
                await updateDoc(treeRef, {
                    allowedUsers: arrayUnion(user.uid)
                });

                // Set as active tree preference
                localStorage.setItem('activeTreeId', treeId);

                setStatus('success');
                setTimeout(() => {
                    router.push('/dashboard');
                }, 2000);

            } catch (err: any) {
                console.error("Join failed:", err);
                setStatus('error');
                setErrorMessage(err.message || "Failed to join tree.");
            }
        };

        joinTree();

    }, [user, loading, treeId, inviteCode, router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black p-4">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-6">

                {status === 'verifying' || status === 'joining' ? (
                    <>
                        <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mx-auto" />
                        <h2 className="text-xl font-semibold">Joining Family Tree...</h2>
                        <p className="text-gray-500">Verifying your invitation.</p>
                    </>
                ) : status === 'success' ? (
                    <>
                        <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Success!</h2>
                        <p className="text-gray-500">You have joined the family tree.</p>
                        <p className="text-sm text-indigo-500 animate-pulse">Redirecting to Dashboard...</p>
                    </>
                ) : (
                    <>
                        <XCircle className="w-16 h-16 text-red-500 mx-auto" />
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Join Failed</h2>
                        <p className="text-red-500">{errorMessage}</p>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="mt-4 px-6 py-2 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 transition-colors"
                        >
                            Go to Dashboard
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

export default function JoinPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" /></div>}>
            <JoinPageContent />
        </Suspense>
    );
}

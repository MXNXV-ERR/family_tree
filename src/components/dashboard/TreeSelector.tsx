
import { TreeMetadata } from '@/types/tree';
import { Button } from '@/components/ui/button';
import { User, Users, ArrowRight } from 'lucide-react';
// import { formatDate } from '@/lib/utils'; // Not needed yet

interface TreeSelectorProps {
    userTrees: TreeMetadata[];
    sharedTrees: TreeMetadata[];
    onSelectTree: (treeId: string) => void;
    currentUserId: string;
}

export function TreeSelector({ userTrees, sharedTrees, onSelectTree, currentUserId }: TreeSelectorProps) {

    // Helper simple date formatter if utils missing
    const simpleDate = () => new Date().toLocaleDateString();

    return (
        <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-4">
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome Back</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Select a family tree to view</p>
            </div>

            {/* My Trees Section */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider pl-1">My Family Tree</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {userTrees.map((tree) => (
                        <div
                            key={tree.id}
                            onClick={() => onSelectTree(tree.id)}
                            className="group relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all cursor-pointer"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <User className="w-24 h-24 text-indigo-500" />
                            </div>

                            <div className="relative z-10 flex flex-col gap-4">
                                <div className="flex items-start justify-between">
                                    <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
                                        <User size={24} />
                                    </div>
                                    <div className="p-2 rounded-full bg-gray-50 dark:bg-gray-900 opacity-0 group-hover:opacity-100 transition-opacity -mr-2 -mt-2">
                                        <ArrowRight size={16} className="text-gray-400" />
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                        {tree.name || 'My Personal Tree'}
                                    </h4>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        {tree.inviteCode ? 'Sharing Active' : 'Private'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Shared Trees Section */}
            {sharedTrees.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider pl-1">Shared with Me</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {sharedTrees.map((tree) => (
                            <div
                                key={tree.id}
                                onClick={() => onSelectTree(tree.id)}
                                className="group relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-pink-200 dark:hover:border-pink-800 transition-all cursor-pointer"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Users className="w-24 h-24 text-pink-500" />
                                </div>

                                <div className="relative z-10 flex flex-col gap-4">
                                    <div className="flex items-start justify-between">
                                        <div className="p-3 rounded-xl bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400">
                                            <Users size={24} />
                                        </div>
                                        <div className="p-2 rounded-full bg-gray-50 dark:bg-gray-900 opacity-0 group-hover:opacity-100 transition-opacity -mr-2 -mt-2">
                                            <ArrowRight size={16} className="text-gray-400" />
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                                            {tree.name || 'Shared Family Tree'}
                                        </h4>
                                        <p className="text-xs font-mono text-gray-400 mt-1 truncate">
                                            ID: {tree.id.slice(0, 8)}...
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

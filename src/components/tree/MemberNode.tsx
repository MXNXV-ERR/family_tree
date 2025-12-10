'use client';

import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { User } from 'lucide-react';

export const MemberNode = memo(({ data }: { data: { name: string; photoUrl?: string; gender?: string } }) => {
    return (
        <div className="relative flex flex-col items-center rounded-xl bg-white dark:bg-gray-800 border-2 border-indigo-200 dark:border-indigo-900 shadow-xl p-2 w-32 hover:scale-105 transition-transform duration-200">
            <Handle type="target" position={Position.Top} className="!bg-indigo-500" />

            <div className="relative mb-2 h-16 w-16 overflow-hidden rounded-full border-2 border-white dark:border-gray-700 shadow-sm">
                {data.photoUrl ? (
                    <img src={data.photoUrl} alt={data.name} className="h-full w-full object-cover" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center bg-indigo-100 dark:bg-indigo-900/50">
                        <User className="h-8 w-8 text-indigo-500" />
                    </div>
                )}
            </div>

            <div className="text-center">
                <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate w-full px-1">{data.name}</p>
                <p className="text-[10px] text-gray-500 capitalize">{data.gender || 'Family'}</p>
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-indigo-500" />
        </div>
    );
});

MemberNode.displayName = 'MemberNode';

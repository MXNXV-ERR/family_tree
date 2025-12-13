
'use client';

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Globe, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { useAuth } from '@/context/AuthContext';
import { useFamilyTree } from '@/hooks/useFamilyTree';
import { buildGraph, findRelationshipPath } from '@/utils/relationshipLogic';

interface Message {
    role: "user" | "bot";
    content: string;
}

const LANGUAGES = [
    { code: "Gujarati", label: "Gujarati (ગુજરાતી)" },
    { code: "Hindi", label: "Hindi (हिंदी)" },
    { code: "Marathi", label: "Marathi (मराठी)" },
    { code: "Tamil", label: "Tamil (தமிழ்)" },
    { code: "English", label: "English" },
];

export default function GeminiChat() {
    const { user } = useAuth();
    const { members, relationships } = useFamilyTree(user?.uid);

    // UI State
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState<'chat' | 'rel'>('chat');

    // Chat State
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "bot",
            content:
                "Namaste! Ask me about your family relationships.",
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState("Gujarati");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Relationship Mode State
    const [personA, setPersonA] = useState('');
    const [personB, setPersonB] = useState('');

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen, mode]);

    useEffect(() => {
        // Auto-detect "Me"
        if (members.length > 0 && user) {
            const myNode = members.find(m => m.associatedUserId === user.uid);

            // If Person A is not set, or we just switched to 'rel' mode and want to ensure defaults
            if (myNode && !personA) {
                setPersonA(myNode.id);
            }
        }
    }, [members, user, mode, personA]);

    const handleChatSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMessage,
                    language: selectedLanguage
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.details || "Failed to fetch response");
            }

            setMessages((prev) => [...prev, { role: "bot", content: data.response }]);
        } catch (error: any) {
            console.error("Chat Error:", error);
            setMessages((prev) => [
                ...prev,
                { role: "bot", content: `Error: ${error.message || "Something went wrong."}` },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRelationshipAsk = async () => {
        if (!personA || !personB) return;

        setIsLoading(true);
        // 1. Calculate Relationship Path (Client Side)
        const graph = buildGraph(members, relationships);
        const pathDescription = findRelationshipPath(graph, personA, personB);

        const memA = members.find(m => m.id === personA);
        const memB = members.find(m => m.id === personB);

        const nameA = memA?.name || 'Person A';
        const nameB = memB?.name || 'Person B';
        const genderA = memA?.gender || 'unknown';
        const genderB = memB?.gender || 'unknown';

        // 2. Construct Prompt
        const prompt = `
            Context: Family Tree Analysis.
            - ${nameA} is ${genderA}.
            - ${nameB} is ${genderB}.
            - Calculated Path: ${nameA} is the ${pathDescription} of ${nameB}.
            
            Task: Verify this and explain the relationship in ${selectedLanguage}.
            Crucial: Use the provided gender to give the EXACT specific term (e.g., if Father, say 'Father', not 'Parent').
            
            Output format: "**${nameA} is ${nameB}'s [Relationship]** (Native term in English) (Native Term). [Short context]".
            Keep it strictly one line.
        `;

        // Switch to chat view to show result
        setMode('chat');
        setMessages(prev => [...prev, { role: 'user', content: `How is ${nameA} related to ${nameB}?` }]);

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: prompt, language: selectedLanguage }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.details || "Failed to fetch response");
            }

            setMessages(prev => [...prev, { role: 'bot', content: data.response }]);
        } catch (e: any) {
            console.error("Relationship Chat Error:", e);
            setMessages(prev => [...prev, { role: 'bot', content: `Error: ${e.message || "Calculating relationship failed."}` }]);
        } finally {
            setIsLoading(false);
            // setPersonA(''); // Keep Person A selected (usually 'Me') for better UX
            setPersonB('');
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col items-end pointer-events-auto">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="mb-4 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-[90vw] md:w-96 border border-gray-200 dark:border-gray-700 overflow-hidden pointer-events-auto flex flex-col max-h-[600px]"
                    >
                        {/* Header */}
                        <div className="bg-indigo-600 p-4 flex flex-col gap-3">
                            <div className="flex justify-between items-center">
                                <h3 className="text-white font-semibold flex items-center gap-2">
                                    <MessageCircle size={20} />
                                    Family Helper
                                </h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setMode(mode === 'chat' ? 'rel' : 'chat')}
                                        className={cn(
                                            "text-white/80 hover:text-white transition-colors p-1 rounded hover:bg-white/10",
                                            mode === 'rel' && "bg-white/20 text-white"
                                        )}
                                        title={mode === 'chat' ? "Switch to Calculator" : "Back to Chat"}
                                    >
                                        {mode === 'chat' ? <Users size={18} /> : <MessageCircle size={18} />}
                                    </button>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="text-white/80 hover:text-white transition-colors p-1"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="relative">
                                <Globe className="absolute left-2 top-1/2 -translate-y-1/2 text-indigo-200" size={14} />
                                <select
                                    value={selectedLanguage}
                                    onChange={(e) => setSelectedLanguage(e.target.value)}
                                    className="w-full bg-indigo-500/50 text-white text-sm rounded-lg pl-8 pr-3 py-1.5 border-none focus:ring-1 focus:ring-white/50 cursor-pointer appearance-none hover:bg-indigo-500/70 transition-colors"
                                >
                                    {LANGUAGES.map(lang => (
                                        <option key={lang.code} value={lang.code} className="text-gray-900 bg-white">
                                            {lang.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Content */}
                        {mode === 'chat' ? (
                            <>
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900/50 min-h-[300px]">
                                    {messages.map((msg, index) => (
                                        <div
                                            key={index}
                                            className={cn(
                                                "flex w-full",
                                                msg.role === "user" ? "justify-end" : "justify-start"
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    "max-w-[85%] rounded-2xl px-4 py-2 text-sm",
                                                    msg.role === "user"
                                                        ? "bg-indigo-600 text-white rounded-tr-none"
                                                        : "bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm border border-gray-100 dark:border-gray-600 rounded-tl-none"
                                                )}
                                            >
                                                {msg.role === "bot" ? (
                                                    <div className="prose dark:prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-p:m-0">
                                                        <ReactMarkdown
                                                            components={{
                                                                p: ({ children }) => <span className="mb-0 has-[strong]:font-medium">{children}</span>
                                                            }}
                                                        >
                                                            {msg.content}
                                                        </ReactMarkdown>
                                                    </div>
                                                ) : (
                                                    msg.content
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {isLoading && (
                                        <div className="flex justify-start w-full">
                                            <div className="bg-white dark:bg-gray-700 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-600">
                                                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                <form onSubmit={handleChatSubmit} className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            placeholder={`Ask in ${selectedLanguage}...`}
                                            className="flex-1 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-900 border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-900 focus:ring-0 text-sm transition-all"
                                        />
                                        <button
                                            type="submit"
                                            disabled={isLoading || !input.trim()}
                                            className="bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <Send size={18} />
                                        </button>
                                    </div>
                                </form>
                            </>
                        ) : (
                            <div className="flex-1 p-4 bg-gray-50 dark:bg-gray-900/50 flex flex-col gap-6 min-h-[300px]">
                                <div className="text-center space-y-2">
                                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">Relationship Calculator</h4>
                                    <p className="text-xs text-gray-500">Select two members to find out how they are related.</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase text-gray-400">First Person</label>
                                        <select
                                            className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                            value={personA}
                                            onChange={(e) => setPersonA(e.target.value)}
                                        >
                                            <option value="">Select Person (or You)</option>
                                            {members.map(m => (
                                                <option key={m.id} value={m.id}>
                                                    {m.name} {m.associatedUserId === user?.uid ? '(You)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex justify-center relative">
                                        <div className="absolute inset-0 flex items-center">
                                            <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                                        </div>
                                        <span className="relative bg-gray-50 dark:bg-gray-900 px-2 text-xs text-gray-400 uppercase">And</span>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase text-gray-400">Second Person</label>
                                        <select
                                            className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                            value={personB}
                                            onChange={(e) => setPersonB(e.target.value)}
                                        >
                                            <option value="">Select Person</option>
                                            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                    </div>

                                    <button
                                        onClick={handleRelationshipAsk}
                                        disabled={!personA || !personB || isLoading}
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
                                    >
                                        {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Users size={18} />}
                                        Analyze Relationship
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Toggle Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
                >
                    <MessageCircle size={24} />
                </button>
            )}
        </div>
    );
}

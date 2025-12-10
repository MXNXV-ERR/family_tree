"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Loader2, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

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
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "bot",
            content:
                "Namaste! **Select a language** above and ask me about a family relationship (e.g. 'Father's brother').",
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState("Gujarati");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");
        setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    message: userMessage,
                    language: selectedLanguage
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to fetch response");
            }

            const data = await response.json();
            setMessages((prev) => [
                ...prev,
                { role: "bot", content: data.response },
            ]);
        } catch (error) {
            console.error("Chat error", error)
            setMessages((prev) => [
                ...prev,
                {
                    role: "bot",
                    content: "Sorry, I'm having trouble connecting right now. Please check your API key setup.",
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end pointer-events-none">
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
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="text-white/80 hover:text-white transition-colors p-1"
                                    aria-label="Close chat"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Language Selector */}
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

                        {/* Messages */}
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

                        {/* Input */}
                        <form onSubmit={handleSubmit} className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
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
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                onClick={() => setIsOpen(!isOpen)}
                className="pointer-events-auto bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95 flex items-center justify-center relative group"
                aria-label="Toggle chat"
            >
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white dark:border-gray-900"></div>
                <MessageCircle size={24} />
            </button>
        </div>
    );
}

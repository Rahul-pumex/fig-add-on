import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { AuthService, withAuth, resetAuthState } from "@utils";
import ChatBox from "../../../components/templates/Chat/ChatBox";
import { ChatModeProvider } from "../../../components/ChatModeContext";
import { MessageMappingProvider } from "../../../components/MessageMappingContext";
import { SelectedContextsProvider } from "../../../components/SelectedContextsContext";
import { LucideLogOut, LucideMessageSquarePlus, LucideList } from "lucide-react";
import { useFigAgent } from "@/hooks/useFigAgent";
import { GridSpinner } from "@components/atoms/GridSpinner";
import ExistingChatIcon from "../../../components/icons/existingChat";

function ThreadPage() {
    const router = useRouter();
    const { query } = router;
    const { threadId, setThreadId, setThread } = useFigAgent();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [showThreadList, setShowThreadList] = useState(false);

    // Update threadId from URL
    useEffect(() => {
        if (query.threadId !== undefined) {
            let id = query.threadId as string;
            if (id === "new") {
                id = "";
            }
            // Only update threadId if it's actually different
            if (id !== threadId) {
                console.log("[ThreadPage] Setting threadId from URL:", id);
                setThreadId(id);
            }
        }
    }, [query.threadId, threadId, setThreadId]);

    const handleLogout = async () => {
        resetAuthState(); // Reset global auth state
        AuthService.clearAllTokens();
        router.replace("/auth");
    };

    const handleNewThread = () => {
        console.log("[ThreadPage] Creating new thread");
        setThreadId("");
        setThread({
            kg: { nodes: [], edges: [] },
            logs: [],
            topics: [],
            messages: [],
            charts: [],
            texts: [],
            executionId: undefined,
            threadId: undefined
        });
        // Use shallow routing to prevent auth re-check
        router.push("/chat/new", undefined, { shallow: true });
    };

    const toggleThreadList = () => {
        setShowThreadList((prev) => !prev);
    };

    // Hide list when navigating to a specific thread
    useEffect(() => {
        setShowThreadList(false);
    }, [router.asPath]);

    return (
        <SelectedContextsProvider>
            <ChatModeProvider>
                <MessageMappingProvider>
                    <div className="flex h-screen flex-col overflow-hidden bg-white">
                        {/* Header */}
                        <div className="border-b border-gray-200 bg-white shadow-sm">
                                <div className="flex items-center justify-between h-10 w-[98%]">
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={toggleThreadList}
                                            className="group relative flex items-center justify-center px-2 py-2 rounded-lg text-[#745263] transition-all hover:bg-[#FAF8F9] active:scale-95"
                                            aria-label="Threads"
                                        >
                                            <LucideList size={22} strokeWidth={2} />
                                            <span className="pointer-events-none absolute -bottom-10 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                                                Threads
                                            </span>
                                        </button>
                                        <button
                                            onClick={handleNewThread}
                                            className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-medium text-[#745263] transition-colors hover:bg-[#FAF8F9] active:scale-95"
                                            aria-label="New Thread"
                                        >
                                            <LucideMessageSquarePlus size={20} strokeWidth={2} className="relative" />
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleLogout}
                                        className="group relative flex items-center justify-center p-2 rounded-lg text-gray-600 transition-all hover:bg-red-50 hover:text-red-600 active:scale-95"
                                        aria-label="Logout"
                                    >
                                        <LucideLogOut size={22} strokeWidth={2} />
                                        <span className="pointer-events-none absolute -bottom-10 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                                            Logout
                                        </span>
                                    </button>
                                </div>
                        </div>

                        {/* Content Area: either Threads List or Chat */}
                        <div className="flex-1 overflow-hidden bg-white">
                            {showThreadList ? (
                                <ThreadListView
                                    onNewThread={handleNewThread}
                                    onDone={() => setShowThreadList(false)}
                                />
                            ) : (
                                <ChatBox
                                    threadId={threadId}
                                    onCollapseChange={(collapsed) => setIsCollapsed(collapsed)}
                                />
                            )}
                        </div>
                    </div>
                </MessageMappingProvider>
            </ChatModeProvider>
        </SelectedContextsProvider>
    );
}

export default withAuth(ThreadPage);

// Local component to list threads similar to main app's sidebar list
function ThreadListView({ onNewThread, onDone }: { onNewThread: () => void; onDone: () => void }) {
    const router = useRouter();
    const { thread_list = [], thread_list_status, fetchThreads, setThreadId, threadId } = useFigAgent();

    useEffect(() => {
        fetchThreads?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openThread = (id: string) => {
        setThreadId(id);
        router.push(`/chat/${id}`, undefined, { shallow: true });
        onDone();
    };

    return (
        <div className="flex h-full w-full flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-2 py-3 relative">
                {thread_list_status === 'LOADING' ? (
                    <div className="flex h-full items-center justify-center">
                        <GridSpinner height={48} width={48} />
                    </div>
                ) : thread_list.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-gray-500">
                        No threads yet.
                    </div>
                ) : (
                    <ul className="space-y-4 px-2">
                        {thread_list.map((item: any) => {
                            const isActive = item.thread_id === threadId;
                            return (
                                <li key={item.thread_id}>
                                    <button
                                        onClick={() => openThread(item.thread_id)}
                                        aria-selected={isActive}
                                        className={`group flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm shadow-sm transition-colors
                                            ${isActive ? "bg-gray-100 border-gray-300 text-gray-900" : "bg-white border-gray-200 text-gray-800 hover:bg-gray-50"}`}
                                    >
                                        <div className="flex min-w-0 items-center gap-3 p-2">
                                            <ExistingChatIcon className={isActive ? "text-black" : "text-gray-500"} />
                                            <span className="truncate font-medium leading-5">
                                                {formatTitle(item.description)}
                                            </span>
                                        </div>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={`h-4 w-4 ${isActive ? "text-gray-700" : "text-gray-400 group-hover:text-gray-500"}`}>
                                            <path fill="currentColor" d="M9 18l6-6-6-6v12z" />
                                        </svg>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}

function formatTitle(desc?: string) {
    const text = (desc || "Untitled thread").trim();
    return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

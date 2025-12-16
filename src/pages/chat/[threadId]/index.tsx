import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { AuthService, withAuth, resetAuthState } from "@utils";
import ChatBoxContent from "../../../components/templates/Chat/ChatBoxContent";
import { ChatModeProvider } from "../../../components/ChatModeContext";
import { MessageMappingProvider } from "../../../components/MessageMappingContext";
import { SelectedContextsProvider } from "../../../components/SelectedContextsContext";
import { LucideLogOut, LucideMessageSquarePlus } from "lucide-react";
import { useFigAgent } from "@/hooks/useFigAgent";

function ThreadPage() {
    const router = useRouter();
    const { query } = router;
    const { threadId, setThreadId, setThread } = useFigAgent();
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Update threadId from URL
    useEffect(() => {
        if (query.threadId !== undefined) {
            let id = query.threadId as string;
            if (id === "new") {
                id = "";
            }
            if (id !== threadId) {
                console.log("[ThreadPage] Setting threadId from URL:", id);
                setThreadId(id);
            }
        }
    }, [query.threadId, threadId, setThreadId]);

    const handleLogout = async () => {
        resetAuthState();
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
        router.push("/chat/new", undefined, { shallow: true });
    };

    return (
        <SelectedContextsProvider>
            <ChatModeProvider>
                <MessageMappingProvider>
                    <div className="flex h-screen flex-col overflow-hidden bg-white">
                        {/* Minimal Header */}
                        <div className="border-b border-gray-200 bg-white ">
                            <div className="flex items-center justify-between px-4 py-3">
                                {/* Left side - just thread indicator if active */}
                                <div className="flex items-center gap-2">
                                    {threadId && threadId !== "new" && (
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                                            <span>Active</span>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Right side - Actions */}
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={handleNewThread}
                                        className="group relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-[#745263] bg-[#FAF8F9] hover:bg-[#F5F0F3] transition-all active:scale-95"
                                        aria-label="New Chat"
                                    >
                                        <LucideMessageSquarePlus size={18} strokeWidth={2} />
                                       
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="group relative flex items-center justify-center p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all active:scale-95"
                                        aria-label="Logout"
                                    >
                                        <LucideLogOut size={18} strokeWidth={2} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Chat Area */}
                        <div className="flex-1 overflow-hidden bg-gradient-to-b from-white via-[#FDFCFD] to-[#F5F0F3]">
                            <ChatBoxContent
                                isCollapsed={isCollapsed}
                                setIsCollapsed={setIsCollapsed}
                                onCollapseChange={(collapsed) => setIsCollapsed(collapsed)}
                            />
                        </div>
                    </div>
                </MessageMappingProvider>
            </ChatModeProvider>
        </SelectedContextsProvider>
    );
}

export default withAuth(ThreadPage);
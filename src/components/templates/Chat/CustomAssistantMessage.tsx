import { AssistantMessageProps } from "@copilotkit/react-ui";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMessageMapping } from "../../MessageMappingContext";
import { useFigAgent, useResponsiveChatPadding } from "../../../hooks";
import { GridSpinner } from "../../atoms/GridSpinner";
import { ChartContainer } from "../../molecules/ChartContainer";
import { ChartSqlPanel } from "../../molecules/ChartSqlPanel";
import { Tabs } from "../../molecules/Tabs";
import BallLoader from "../../atoms/BallLoader";

const CustomAssistantMessage = (props: AssistantMessageProps) => {
    const { message, isLoading, subComponent } = props;
    // useMessageMapping now returns safe defaults if provider isn't available
    const { getUserIdForAssistant, getLastUserMessageId, addMapping } = useMessageMapping();
    const { threadInfo } = useFigAgent();
    const contentRef = useRef<HTMLDivElement | null>(null);
    const tableIndexRef = useRef(0);
    const exportTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [hasTable, setHasTable] = useState(false);
    const [exportingTableIndex, setExportingTableIndex] = useState<number | null>(null);
    // Get responsive padding based on chat container width
    const horizontalPadding = useResponsiveChatPadding();
    
    // Get assistant message ID
    const rawData = (props as any)?.rawData;
    const assistantId = useMemo(() => {
        return rawData?.id || null;
    }, [rawData?.id]);
    
    // Get user message ID for this assistant message (check if mapping already exists)
    const userMessageId = useMemo(() => {
        if (assistantId) {
            return getUserIdForAssistant(assistantId);
        }
        return null;
    }, [assistantId, getUserIdForAssistant]);
    
    // Create mapping when assistant message is rendered (only once per assistantId)
    useEffect(() => {
        // Skip if mapping already exists
        if (assistantId && !userMessageId) {
            let lastUserId = getLastUserMessageId();
            
            // Fallback: try to get user message ID from DOM if context doesn't have it
            if (!lastUserId) {
                const messageContainer = document.querySelector('.copilot-kit-messages');
                if (messageContainer) {
                    // Find the most recent user message element
                    const userMessages = messageContainer.querySelectorAll('[data-message-role="user"]');
                    if (userMessages.length > 0) {
                        const lastUserMessage = userMessages[userMessages.length - 1];
                        // Try to get ID from the element or its parent
                        const userIdFromDom = (lastUserMessage as HTMLElement)?.id || 
                                            (lastUserMessage as HTMLElement)?.getAttribute?.('data-message-id') ||
                                            (lastUserMessage.parentElement as HTMLElement | null)?.id;
                        if (userIdFromDom) {
                            lastUserId = userIdFromDom;
                        }
                    }
                }
            }
            
            if (lastUserId) {
                addMapping(assistantId, lastUserId);
            } else {
                const timeout = setTimeout(() => {
                    const retryUserId = getLastUserMessageId();
                    if (retryUserId) {
                        addMapping(assistantId, retryUserId);
                    }
                }, 100);
                return () => clearTimeout(timeout);
            }
        }
    }, [assistantId, userMessageId, getLastUserMessageId, addMapping]);
    

    useEffect(() => {
        // Listen for write response from Google Sheets
        const handleWriteResponse = (event: MessageEvent) => {
            if (event.data && event.data.type === 'WRITE_SHEET_RESPONSE' && event.data.source === 'google-sheets') {
                // Clear any pending timeout
                if (exportTimeoutRef.current) {
                    clearTimeout(exportTimeoutRef.current);
                    exportTimeoutRef.current = null;
                }
                
                setExportingTableIndex(null);
                
                const payload = event.data.payload;
                
                if (payload.success) {
                    // Show success notification
                    console.log(`✓ Successfully wrote table to Google Sheets!`);
                } else {
                    // Show error notification
                    console.warn(`✗ Failed to write to Google Sheets: ${payload.message || 'Unknown error'}`);
                }
            }
        };
    
        window.addEventListener('message', handleWriteResponse);
    
        return () => {
            window.removeEventListener('message', handleWriteResponse);
            // Clean up timeout on unmount
            if (exportTimeoutRef.current) {
                clearTimeout(exportTimeoutRef.current);
            }
        };
    }, []);

    
    // Keep currentMessageId for backward compatibility if needed
    const currentMessageId = useMemo(() => {
        if (!message) return null;
        
        const rawData = (props as any)?.rawData;
        if (rawData?.id) {
            return rawData.id;
        }
        
        return null;
    }, [message, props]);
    
    const [chartTab, setChartTab] = useState<"sql" | "charts">("charts");
    const [showLoader, setShowLoader] = useState(true);
    
    // Use userMessageId to filter charts and texts since they are associated with user messages
    const derivedState = useMemo(() => {
        // Use userMessageId if available, otherwise fall back to currentMessageId
        const messageIdToUse = userMessageId || currentMessageId;
        
        // Get charts and texts from threadInfo (real state) instead of mock data
        const allCharts = Array.isArray(threadInfo?.charts) ? threadInfo.charts : [];
        const allTexts = Array.isArray(threadInfo?.texts) ? threadInfo.texts : [];
        const allTopics = Array.isArray(threadInfo?.topics) ? threadInfo.topics : [];
        
        // Filter charts and texts by message_id - only show charts/texts that have a matching message_id
        // If there's no messageIdToUse, don't show any charts/texts (return empty arrays)
        // If a chart/text doesn't have a message_id field, exclude it to prevent showing for all messages
        const filteredCharts = messageIdToUse
            ? allCharts.filter((chart) => {
                // Only include charts that have a message_id and it matches
                return (chart as { message_id?: string }).message_id && (chart as { message_id?: string }).message_id === messageIdToUse;
            })
            : [];
        
        const filteredTexts = messageIdToUse
            ? allTexts.filter((text) => {
                // Only include texts that have a message_id and it matches
                return (text as { message_id?: string }).message_id && (text as { message_id?: string }).message_id === messageIdToUse;
            })
            : [];

        return {
            hasTopics: allTopics.length > 0,
            hasCharts: filteredCharts.length > 0,
            hasTexts: filteredTexts.length > 0,
            hasKnowledgeGraph: false,
            hasDashboardContent: filteredCharts.length > 0 || filteredTexts.length > 0,
            topics: allTopics,
            charts: filteredCharts,
            texts: filteredTexts
        };
    }, [userMessageId, currentMessageId, threadInfo]);
    
    useEffect(() => {
        setShowLoader(true);

        const timer = setTimeout(() => {
            setShowLoader(false);
        }, 10000);

        if (derivedState.hasCharts) {
            setShowLoader(false);
        }

        return () => clearTimeout(timer);
    }, [derivedState.hasCharts]);
    
    const shouldShowLoader = showLoader;
    const tabData: Array<[string, string]> = [
        ["sql", "Chart SQL"],
        ["charts", "Charts"]
    ];
    
    const handleTabChange = (tab: string) => {
        setChartTab(tab as "sql" | "charts");
    };
    
    const handleSendTableToSheet = (tableIndex: number) => {
        // Prevent multiple simultaneous exports
        if (exportingTableIndex !== null) {
            console.warn("Export already in progress, please wait...");
            return;
        }

        const container = contentRef.current;
        if (!container) return;

        const tables = Array.from(container.querySelectorAll("table"));
        if (!tables[tableIndex]) {
            console.warn(`Table at index ${tableIndex} not found`);
            return;
        }

        const table = tables[tableIndex];
        const rows = Array.from(table.rows).map((row) =>
            Array.from(row.cells).map((cell) => cell.innerText.replace(/\s+/g, " ").trim())
        );

        const tablePayload = [{
            name: `Table ${tableIndex + 1}`,
            rows
        }];

        const message = {
            type: "WRITE_SHEET_DATA",
            source: "omniscop-chat",
            payload: {
                tables: tablePayload,
                threadId: threadInfo?.threadId || null
            }
        };

        if (typeof window !== "undefined" && window.parent && window.parent !== window) {
            // Clear any existing timeout
            if (exportTimeoutRef.current) {
                clearTimeout(exportTimeoutRef.current);
            }
            
            setExportingTableIndex(tableIndex);
            window.parent.postMessage(message, "*");
            
            // Fallback timeout in case response doesn't come back (increase to 5 seconds)
            exportTimeoutRef.current = setTimeout(() => {
                console.warn("Export timeout - resetting state");
                setExportingTableIndex(null);
                exportTimeoutRef.current = null;
            }, 5000);
        } else {
            console.warn("Cannot export: not running inside the expected host/iframe.");
        }
    };

    useEffect(() => {
        const container = contentRef.current;
        if (!container) {
            setHasTable(false);
            return;
        }
        const containsTable = container.querySelector("table") !== null;
        setHasTable(containsTable);
        
        // Reset table index counter when message changes
        tableIndexRef.current = 0;
    }, [message, isLoading]);

    const renderChartContent = () => {
        if (!derivedState.hasCharts && !shouldShowLoader) return null;

        if (shouldShowLoader && !derivedState.hasCharts) {
            return (
                <div className="flex min-h-70 items-center justify-center">
                    <GridSpinner height={32} width={32} />
                </div>
            );
        }

        if (chartTab === "sql") {
            return <ChartSqlPanel charts={derivedState.charts} />;
        }

        return <ChartContainer charts={derivedState.charts} showItemActions={true} />;
    };

    return (
        <div 
            style={{ 
                padding: '2px',
                marginBottom: '2px'
            }}
        >
            <div className="flex items-start">
                <div className="w-full wrap-break-word whitespace-pre-line text-black" style={{ overflowY: 'visible' }}>
                    {message && (
                        <div className="prose prose-sm max-w-none" ref={contentRef}>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    h1: (props) => <h1 className="my-1 text-base font-bold text-black" {...props} />,
                                    h2: (props) => <h2 className="my-1 text-sm font-semibold text-black" {...props} />,
                                    p: (props) => <p className="text-xs text-black leading-relaxed" {...props} />,
                                    ul: (props) => <ul className="list-disc pl-6 text-xs text-black" {...props} />,
                                    ol: (props) => <ol className="list-decimal pl-6 text-xs text-black" {...props} />,
                                    li: (props) => <li className="text-xs text-black" {...props} />,
                                    code: (props) => (
                                        <pre className="overflow-x-auto rounded bg-gray-100 p-1.5 text-xs">
                                            <code {...props} />
                                        </pre>
                                    ),
                                    table: (props) => {
                                        const currentIndex = tableIndexRef.current;
                                        tableIndexRef.current += 1;
                                        
                                        return (
                                            <div className="my-3" style={{ width: '100%' }}>
                                                <div style={{ overflowX: 'auto', overflowY: 'visible', width: '100%' }}>
                                                    <table 
                                                        className="border-collapse text-xs text-black" 
                                                        style={{ borderSpacing: 0, minWidth: '100%' }} 
                                                        {...props} 
                                                    />
                                                </div>
                                                {!isLoading && (
                                                    <div className="flex justify-end" style={{ marginTop: '8px' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleSendTableToSheet(currentIndex)}
                                                            disabled={exportingTableIndex === currentIndex}
                                                            className="inline-flex items-center gap-1.5 rounded-md bg-black text-xs font-semibold text-white transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
                                                            style={{ padding: '2px 6px' }}
                                                        >
                                                            {exportingTableIndex === currentIndex ? "Exporting…" : "Export to Sheet"}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    },
                                    th: (props) => (
                                        <th
                                            className="bg-gray-100 px-2 py-1.5 text-left text-xs font-semibold text-black"
                                            style={{ border: "1px solid #e4e4e4" }}
                                            {...props}
                                        />
                                    ),
                                    td: (props) => <td className="px-2 py-1.5 text-xs text-black" style={{ border: "1px solid #e4e4e4" }} {...props} />,
                                    tr: (props) => <tr className="hover:bg-white" {...props} />,
                                    tbody: (props) => <tbody {...props} />
                                }}
                            >
                                {message}
                            </ReactMarkdown>
                        </div>
                    )}

                    {isLoading && (
                        <div className="mt-1.5 flex items-center gap-2 text-gray-500 py-1.5 px-1" style={{ overflow: 'hidden' }}>
                            <BallLoader />
                        </div>
                    )}
                </div>
            </div>


            {subComponent && <div className="my-1.5">{subComponent}</div>}
            
            {(derivedState.hasCharts || derivedState.hasTexts) && !isLoading && message && (
                <div className="mt-4 w-full">
                    <div className="relative mb-3 flex w-full items-center justify-between">
                        {derivedState.hasCharts && (
                            <Tabs data={tabData} activeTab={chartTab} setActiveTab={handleTabChange} />
                        )}
                    </div>
                    <div className="relative z-10">
                        {renderChartContent()}
                        {/* {derivedState.hasTexts && (
                            <TextContainer 
                                text={derivedState.texts} 
                                heightLimit="max-h-[400px]" 
                                showItemActions={true} 
                            />
                        )} */}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CustomAssistantMessage;
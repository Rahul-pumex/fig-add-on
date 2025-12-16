import ChatInputActions, { type UploadedFile } from "../../molecules/ChatInputActions";
import { CustomChatInputProps, MetricOption } from "../../../types";
import { useEffect, useRef, useState, useCallback } from "react";
import CustomAttachmentUI from "../../molecules/CustomAttachmentUI";
import { ArrowUp } from 'lucide-react';
import { ContextBubble } from "../../molecules/contextBubble";
import { useSelectedContexts } from "../../SelectedContextsContext";
import ImageUploadIcon from "../../atoms/icons/imageUploadIcon";
import StopIcon from "../../atoms/icons/stopIcon";

// Placeholder for suggestion bubbles (disabled in mini app)
const SuggestionBubbles = () => null;

const CustomChatInput = (props: CustomChatInputProps) => {
    const [message, setMessage] = useState("");
    const [showCustomUI, setShowCustomUI] = useState(false);
    const [showActions, setShowActions] = useState(false);
    const [isScrollable, setIsScrollable] = useState(false);
    const [internalIsGenerating, setInternalIsGenerating] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    const { onSubmitMessage, onSend, placeholder, disabled, isGenerating, onStop } = props;
    const { selectedContexts } = useSelectedContexts();
    const { clearContexts } = useSelectedContexts();

    const currentlyGenerating = isGenerating !== undefined ? isGenerating : internalIsGenerating;
    const submitFunction = onSubmitMessage || onSend || props.onSubmit;
    const adjustTextareaHeight = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        const maxHeight = 120;
        const sh = el.scrollHeight;
        if (sh > maxHeight) {
            el.style.height = `${maxHeight}px`;
            setIsScrollable(true);
        } else {
            el.style.height = `${Math.max(sh, 32)}px`;
            setIsScrollable(false);
        }
    }, []);
    const getDraftKey = useCallback(() => {
        if (typeof window !== "undefined") {
            return `custom_chat_input_draft:${window.location.pathname}`;
        }
        return "custom_chat_input_draft";
    }, []);

    const saveDraft = useCallback(
        (value: string) => {
            try {
                if (typeof window !== "undefined") {
                    const key = getDraftKey();
                    if (value.trim()) {
                        sessionStorage.setItem(key, value);
                    } else {
                        sessionStorage.removeItem(key);
                    }
                }
            } catch (error) {
                console.warn("Failed to save draft:", error);
            }
        },
        [getDraftKey]
    );

    const loadDraft = useCallback(() => {
        try {
            if (typeof window !== "undefined") {
                const key = getDraftKey();
                return sessionStorage.getItem(key) || "";
            }
        } catch (error) {
            console.warn("Failed to load draft:", error);
        }
        return "";
    }, [getDraftKey]);

    useEffect(() => {
        if (!isInitialized) {
            const saved = loadDraft();
            if (saved) {
                setMessage(saved);
            }
            setIsInitialized(true);
            setTimeout(adjustTextareaHeight, 0);
        }
    }, [loadDraft, isInitialized, adjustTextareaHeight]);

    useEffect(() => {
        if (isInitialized) {
            saveDraft(message);
            adjustTextareaHeight();
        }
    }, [message, saveDraft, isInitialized, adjustTextareaHeight]);

    useEffect(() => {
        const handler = () => adjustTextareaHeight();
        window.addEventListener("resize", handler);
        const t = setTimeout(handler, 50);
        return () => {
            clearTimeout(t);
            window.removeEventListener("resize", handler);
        };
    }, [adjustTextareaHeight]);

    // Request sheet data from Google Sheets parent window
    const requestSheetData = useCallback(() => {
        if (typeof window !== "undefined" && window.parent !== window) {
            // We're in an iframe, send message to parent
            window.parent.postMessage({ type: 'REQUEST_SHEET_DATA' }, '*');
        }
    }, []);

    // Listen for sheet data from parent window
    useEffect(() => {
        if (typeof window === "undefined" || !submitFunction) return;

        const handleSheetData = (event: MessageEvent) => {
            // Accept messages from any origin when in iframe (you may want to restrict this in production)
            if (event.data && event.data.type === 'SHEET_DATA' && event.data.source === 'google-sheets') {
                const payload = event.data.payload;
                if (payload && payload.success && payload.data) {
                    // Format the sheet data for the chat
                    let formattedData = "Google Sheets Data\n";
                    formattedData += "==================\n\n";
                    
                    try {
                        // Handle different data formats
                        if (Array.isArray(payload.data)) {
                            // If data is an array of rows
                            if (payload.data.length > 0) {
                                // First row might be headers
                                const firstRow = payload.data[0];
                                const isFirstRowArray = Array.isArray(firstRow);
                                const headers = isFirstRowArray ? firstRow : Object.keys(firstRow || {});
                                formattedData += "Headers: " + headers.join(", ") + "\n\n";
                                
                                // Add data rows (skip first row if it was used as headers)
                                const dataRows = isFirstRowArray ? payload.data.slice(1) : payload.data.slice(1);
                                formattedData += "Data:\n";
                                dataRows.forEach((row: any, index: number) => {
                                    if (Array.isArray(row)) {
                                        formattedData += `Row ${index + 1}: ${row.join(", ")}\n`;
                                    } else if (typeof row === 'object') {
                                        formattedData += `Row ${index + 1}: ${JSON.stringify(row)}\n`;
                                    } else {
                                        formattedData += `Row ${index + 1}: ${row}\n`;
                                    }
                                });
                            } else {
                                formattedData += "No data available\n";
                            }
                        } else if (typeof payload.data === 'object') {
                            // If data is an object
                            formattedData += JSON.stringify(payload.data, null, 2);
                        } else {
                            // If data is a string or other type
                            formattedData += String(payload.data);
                        }
                    } catch (error) {
                        console.error('Error formatting sheet data:', error);
                        formattedData += JSON.stringify(payload.data, null, 2);
                    }

                    // Send formatted data to chat
                    if (submitFunction) {
                        submitFunction(formattedData);
                    }
                }
            }
        };

        window.addEventListener('message', handleSheetData);

        return () => {
            window.removeEventListener('message', handleSheetData);
        };
    }, [submitFunction]);

    useEffect(() => {
        if (submitFunction && typeof window !== "undefined") {
            (window as any).__chatSubmitFunction = submitFunction;
        }

        const handleCustomSubmit = (event: CustomEvent<{ message: string }>) => {
            if (event.detail?.message && submitFunction) {
                submitFunction(event.detail.message);
            }
        };

        const handleKGSaveMessage = (event: CustomEvent<{ message: string }>) => {
            if (event.detail?.message && submitFunction) {
                submitFunction(event.detail.message);
            }
        };

        document.addEventListener("copilot-submit-message", handleCustomSubmit as EventListener);
        window.addEventListener("kg-send-chat-message", handleKGSaveMessage as EventListener);

        return () => {
            document.removeEventListener("copilot-submit-message", handleCustomSubmit as EventListener);
            window.removeEventListener("kg-send-chat-message", handleKGSaveMessage as EventListener);
        };
    }, [submitFunction]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const parts: string[] = [];

        // Separate contexts and prompts
        const contexts = selectedContexts.filter(c => c.type === 'context');
        const prompts = selectedContexts.filter(c => c.type === 'prompt');

        // Add contexts with heading
        if (contexts.length > 0) {
            parts.push("Business Context");
            parts.push("---------");
            contexts.forEach((context) => {
                if (context.body) {
                    parts.push(context.body);
                }
            });
        }

        // Add prompts with heading
        if (prompts.length > 0) {
            parts.push("Prompt");
            parts.push("-------");
            prompts.forEach((prompt) => {
                if (prompt.body) {
                    parts.push(prompt.body);
                }
            });
        }

        // Add separator before user message if there are contexts or prompts
        if (contexts.length > 0 || prompts.length > 0) {
            parts.push("---------");
        }

        // Add user message
        if (message.trim()) {
            parts.push(message.trim());
        }

        // Add files
        if (uploadedFiles.length > 0) {
            uploadedFiles.forEach((f) => {
                if (f.kind === "txt") {
                    const content = f.content || "";
                    const maxLen = 5000;
                    const payload = content.length > maxLen ? content.slice(0, maxLen) + "\n\n[...truncated...]" : content;
                    parts.push(`FILE [txt]: ${f.file.name}\n\n${payload}`);
                } else {
                    const sizeKB = Math.max(1, Math.round(f.file.size / 1024));
                    parts.push(`FILE [pdf]: ${f.file.name} (${sizeKB} KB) attached.`);
                }
            });
        }

        const finalMessage = parts.join("\n\n");

        if (finalMessage && submitFunction) {
            if (isGenerating === undefined) {
                setInternalIsGenerating(true);
                const checkForCompletion = () => {
                    setTimeout(() => {
                        const lastMessage = document.querySelector(".copilot-kit-messages > div:last-child");
                        if (lastMessage && !lastMessage.textContent?.includes("...")) {
                            setInternalIsGenerating(false);
                        } else {
                            checkForCompletion();
                        }
                    }, 1000);
                };
                checkForCompletion();
            }
            submitFunction(finalMessage);
            setMessage("");
            try {
                if (typeof window !== "undefined") {
                    const key = getDraftKey();
                    sessionStorage.removeItem(key);
                }
            } catch {}
            setUploadedFiles([]);
            clearContexts();
        }
    };

    const handleCustomButtonClick = () => {
        setShowCustomUI((prev) => !prev);

        setTimeout(() => {
            const scrollableElement =
                document.querySelector('[data-testid="copilot-chat-container"]') ||
                document.querySelector(".copilot-kit-chat-container") ||
                document.querySelector('[class*="overflow-y-auto"]');

            if (scrollableElement) {
                scrollableElement.scrollTop = scrollableElement.scrollHeight;
            }

            let element = document.activeElement;
            while (element && element.parentElement) {
                element = element.parentElement;
                if (element.scrollHeight > element.clientHeight) {
                    element.scrollTop = element.scrollHeight;
                    break;
                }
            }
        }, 100);
    };

    const handleCustomUISelect = (option: MetricOption) => {
        setShowCustomUI(false);

        if (submitFunction) {
            submitFunction(option.id);
        } else {
            setMessage(option.id);
        }
    };

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const target = e.target;
        setMessage(target.value);
        target.style.height = "auto";
        const maxHeight = 120;
        const scrollHeight = target.scrollHeight;

        if (scrollHeight > maxHeight) {
            target.style.height = maxHeight + "px";
            setIsScrollable(true);
        } else {
            target.style.height = scrollHeight + "px";
            setIsScrollable(false);
        }
    };
    const handleTextareaWheel = (e: React.WheelEvent<HTMLTextAreaElement>) => {
        const el = e.currentTarget;
        const canScroll = el.scrollHeight > el.clientHeight;
        if (!canScroll) return;
        e.stopPropagation();
    };

    const handleSuggestionClick = (suggestion: { action?: string; text?: string }) => {
        if (submitFunction) {
            submitFunction(suggestion.action || suggestion.text || "");
        } else {
            setMessage(suggestion.action || suggestion.text || "");
        }
    };

    const handleStopGeneration = () => {
        setInternalIsGenerating(false);

        if (onStop) {
            onStop();
        }

        const stopButtons = document.querySelectorAll(
            'button[title*="stop" i]:not([data-stop-button="custom"]), button[aria-label*="stop" i]:not([data-stop-button="custom"])'
        );
        stopButtons.forEach((button) => (button as HTMLButtonElement).click());
    };

    return (
        <div className="sticky right-0 bottom-0 left-0 z-30 w-full bg-white border-t border-gray-200 shadow-lg">
            {/* Suggestions disabled in mini app */}

            <ContextBubble />

            <form onSubmit={handleSubmit} className="flex items-start gap-1 px-4 py-3">
                <div className="flex flex-1 items-stretch rounded-xl border border-gray-300 bg-white px-2 py-2 shadow-sm hover:border-gray-400 focus-within:border-[#745263] focus-within:ring-2 focus-within:ring-[#745263]/20 transition-all">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:bg-gray-100 ${showActions ? "bg-[#745263] text-white" : "text-gray-600"}`}
                            title="Add attachments"
                            disabled={disabled}
                            onClick={() => setShowActions((prev) => !prev)}
                        >
                            <span
                                className="cursor-pointer"
                                style={{
                                    display: "inline-block",
                                    transition: "transform 0.3s",
                                    transform: showActions ? "rotate(45deg)" : "rotate(0deg)"
                                }}
                            >
                                <ImageUploadIcon size={18} />
                            </span>
                        </button>
                    </div>
                    <div className="relative flex min-w-0 flex-1 flex-col justify-center">
                        <textarea
                            id="kg-chat-textarea"
                            name="message"
                            autoComplete="off"
                            ref={textareaRef}
                            value={message}
                            onChange={handleTextareaChange}
                            placeholder={placeholder || "Type your message..."}
                            disabled={disabled}
                            rows={1}
                            className={`relative z-0 w-full min-w-0 resize-none border-none px-2 pr-12 text-sm focus:ring-0 focus:outline-none sm:px-3 sm:pr-12 ${isScrollable ? "scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent overflow-y-auto" : "overflow-hidden"} `}
                            style={{
                                minHeight: "2rem",
                                maxHeight: "7.5rem",
                                color: "#000000",
                                lineHeight: "1.25rem",
                                paddingTop: "0.5rem",
                                paddingBottom: "0.5rem"
                            }}
                            onWheel={handleTextareaWheel}
                            onFocus={() => {
                                try {
                                    textareaRef.current?.scrollIntoView({ block: "nearest" });
                                } catch {}
                                setTimeout(() => {
                                    const el = textareaRef.current;
                                    if (!el) return;
                                    el.style.height = "auto";
                                    const maxHeight = 120;
                                    const sh = el.scrollHeight;
                                    if (sh > maxHeight) {
                                        el.style.height = `${maxHeight}px`;
                                        setIsScrollable(true);
                                    } else {
                                        el.style.height = `${Math.max(sh, 32)}px`;
                                        setIsScrollable(false);
                                    }
                                }, 0);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e);
                                }
                            }}
                        />
                        <button
                            type={currentlyGenerating ? "button" : "submit"}
                            disabled={disabled || (!message.trim() && uploadedFiles.length === 0 && selectedContexts.length === 0 && !currentlyGenerating)}
                            onClick={currentlyGenerating ? handleStopGeneration : undefined}
                            className={`absolute right-1 ${isScrollable ? "bottom-1" : "top-1/2 -translate-y-1/2"} pointer-events-auto z-20 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[#745263] text-white transition-all duration-200 hover:bg-[#9B7080] hover:scale-105 active:scale-95 disabled:cursor-default disabled:opacity-50 disabled:hover:scale-100 shadow-sm`}
                            title={currentlyGenerating ? "Stop generation" : "Send message"}
                            data-stop-button="custom"
                        >
                            {currentlyGenerating ? <StopIcon width={16} height={16} className="text-white" /> : <ArrowUp size={16} color="white" />}
                        </button>
                    </div>
                </div>
            </form>

            {showActions && (
                <ChatInputActions
                    disabled={disabled}
                    onAttachmentClick={handleCustomButtonClick}
                    files={uploadedFiles}
                    onFilesChange={setUploadedFiles}
                    onRequestSheetData={requestSheetData}
                />
            )}
            <CustomAttachmentUI isOpen={showCustomUI} onClose={() => setShowCustomUI(false)} onSelect={handleCustomUISelect} />
        </div>
    );
};

export default CustomChatInput;

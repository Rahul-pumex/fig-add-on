import { LuBrain, LuSearchCode, LuFileText, LuFile, LuTable } from "react-icons/lu";
import { useRef, useState, useEffect } from "react";
import { useChatMode } from "../ChatModeContext";
import { inter } from "@/assets/fonts/inter";
import { LuSparkles } from "react-icons/lu";
import ImageUploadIcon from "../atoms/icons/imageUploadIcon";

type ChatMode = "brain" | "search" | "brain-viz" | "brain-viz-chart";

export type UploadedFile = { file: File; kind: "pdf" | "txt"; content?: string };

interface ChatInputActionsProps {
    disabled?: boolean;
    onAttachmentClick?: () => void;
    files: UploadedFile[];
    onFilesChange: (files: UploadedFile[]) => void;
    onRequestSheetData?: () => void;
}

const ChatInputActions = ({ disabled, onAttachmentClick, files, onFilesChange, onRequestSheetData }: ChatInputActionsProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { mode, setMode } = useChatMode();
    const [activeTab, setActiveTab] = useState<ChatMode>(mode);
    const containerRef = useRef<HTMLDivElement>(null);
    const [sliderStyle, setSliderStyle] = useState({});

    useEffect(() => {
        const tabData = [
            ["brain", LuBrain],
            ["search", LuSearchCode]
        ];

        const index = tabData.findIndex(([value]) => value === activeTab);
        const container = containerRef.current;
        if (!container) return;

        const button = container.children[index];
        if (button && button instanceof HTMLElement) {
            const { offsetLeft, offsetWidth } = button;
            setSliderStyle({
                left: offsetLeft,
                width: offsetWidth
            });
        }
    }, [activeTab]);

    // keep context in sync when local tab changes
    useEffect(() => {
        if (activeTab !== mode) {
            setMode(activeTab);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    const handleImageUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const type = file.type;
            const isPDF = type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
            const isTXT = type === "text/plain" || file.name.toLowerCase().endsWith(".txt");

            if (!isPDF && !isTXT) {
                // Ignore unsupported types
                if (fileInputRef.current) fileInputRef.current.value = "";
                return;
            }

            if (isTXT) {
                const reader = new FileReader();
                reader.onload = async () => {
                    const content = typeof reader.result === "string" ? reader.result : "";
                    onFilesChange([...(files || []), { file, kind: "txt", content }]);
                };
                reader.readAsText(file);
            } else if (isPDF) {
                onFilesChange([...(files || []), { file, kind: "pdf" }]);
            }
        }
        // Reset the input value to allow selecting the same file again
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // Remove file preview
    const handleRemoveFile = (name: string) => {
        onFilesChange((files || []).filter((f) => f.file.name !== name));
    };

    return (
        <div className="sticky bottom-0 z-30 mr-2 mb-2 ml-2">
            {/* Actions Panel - Always visible, sticky at bottom */}
            <div className="flex items-center gap-1 rounded border border-gray-200 bg-gray-50 p-2">
                {/* Tab Component */}
                <div className="relative inline-block rounded border border-gray-200 bg-[#ffffff] p-0 pr-1.5 pl-1">
                    {/* Sliding Background */}
                    <div
                        className="absolute top-[3px] ml-1 h-[calc(100%-6px)] rounded bg-[#343434] transition-all duration-300"
                        style={{ ...sliderStyle }}
                    />

                    {/* Tab Buttons */}
                    <div ref={containerRef} className="relative z-10 inline-flex gap-1">
                        {[
                            ["brain", LuBrain],
                            ["search", LuSearchCode]
                        ].map(([value, IconComponent]) => {
                            const tabValue = value as ChatMode;
                            const TabIcon = IconComponent as React.ComponentType<{ size: number }>;
                            return (
                                <button
                                    key={tabValue}
                                    onClick={() => setActiveTab(tabValue)}
                                    className={`${inter.className} flex h-8 w-8 cursor-pointer items-center justify-center rounded-none text-xs font-medium transition-all duration-200 ${
                                        activeTab === tabValue ? "text-white" : "text-black"
                                    }`}
                                    style={{ padding: 0, height: "2rem", minHeight: "2rem", maxHeight: "2rem" }}
                                >
                                    <TabIcon size={16} />
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Action buttons row - sparkle, file upload (PDF/TXT), then toggle (if needed) */}
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={typeof onAttachmentClick === "function" ? onAttachmentClick : undefined}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-gray-300 bg-white text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-700"
                        title="Set Monitoring"
                        disabled={disabled}
                    >
                        <LuSparkles size={16} />
                    </button>
                    <button
                        type="button"
                        onClick={handleImageUploadClick}
                        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-gray-300 bg-white text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-800"
                        title="Upload PDF/TXT"
                        disabled={disabled}
                    >
                        <ImageUploadIcon size={16} className="text-gray-600" />
                    </button>
                    {onRequestSheetData && (
                        <button
                            type="button"
                            onClick={onRequestSheetData}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-gray-300 bg-white text-green-600 transition-colors hover:border-green-400 hover:text-green-700"
                            title="Get Google Sheets Data"
                            disabled={disabled}
                        >
                            <LuTable size={16} />
                        </button>
                    )}
                    {/* Toggle button placeholder if needed, same height */}
                    {/* <button className="flex items-center justify-center w-8 h-8 ...">Toggle</button> */}
                </div>

                {/* Uploaded file previews (icons only) */}
                {files && files.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                        {files.map((f) => (
                            <div key={f.file.name} className="relative flex items-center gap-2 rounded border bg-white px-2 py-1 text-xs shadow">
                                <span className="text-gray-600">{f.kind === "pdf" ? <LuFile size={14} /> : <LuFileText size={14} />}</span>
                                <span className="max-w-[200px] truncate" title={f.file.name}>
                                    {f.file.name}
                                </span>
                                <button
                                    type="button"
                                    className="ml-1 rounded bg-white px-1 text-gray-600 hover:text-black"
                                    onClick={() => handleRemoveFile(f.file.name)}
                                    title="Remove"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <input ref={fileInputRef} type="file" accept="application/pdf,text/plain" onChange={handleImageUpload} className="hidden" />
            </div>
        </div>
    );
};

export default ChatInputActions;

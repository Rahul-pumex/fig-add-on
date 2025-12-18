import { UserMessageProps } from "@copilotkit/react-ui";
import { useEffect } from "react";
import { useMessageMapping } from "@/components/MessageMappingContext";


const CustomUserMessage: React.FC<UserMessageProps> = (props) => {
    const { message } = props;
    // useMessageMapping now returns safe defaults if provider isn't available
    const { setLastUserMessageId } = useMessageMapping();
    // Get responsive padding based on chat container width
    const horizontalPadding = "px-4";
    
    // Get user message ID from props
    const rawData = (props as any)?.rawData;
    const userId = rawData?.id;
    
    // Register this user message as the last one
    useEffect(() => {
        if (userId) {
            setLastUserMessageId(userId);
        }
    }, [userId, setLastUserMessageId]);
    
    return (
        <div 
            className="flex justify-end" 
            style={{ 
                padding: '2px',  
                marginBottom: '2px', 
            }}
        >
            <div 
                className="w-auto max-w-[85%] min-w-[20%] overflow-x-auto rounded bg-[#745263] wrap-break-word whitespace-pre-line text-xs text-white shadow-sm"
                style={{
                    padding: '10px 14px',
                    lineHeight: '1.5'
                }}
            >
                {message}
            </div>
        </div>
    );
};

export default CustomUserMessage;

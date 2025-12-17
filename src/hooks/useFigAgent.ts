import { useState, useCallback } from 'react';
import { AdminFlowAgentState } from '../types';
import { AuthService } from '../utils/auth/authService';

type ThreadItem = {
    thread_id: string;
    description?: string;
};

// Simplified useFigAgent for mini app with real thread fetching
export const useFigAgent = () => {
    const [threadId, setThreadIdState] = useState<string | undefined>();
    const [threadInfo, setThreadInfo] = useState<AdminFlowAgentState | null>(null);
    const [threadList, setThreadList] = useState<ThreadItem[]>([]);
    const [threadListStatus, setThreadListStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'FAILED'>('IDLE');

    const setThreadId = useCallback((id: string | undefined) => {
        setThreadIdState(id);
    }, []);

    const setThread = useCallback((data: AdminFlowAgentState) => {
        setThreadInfo(data);
    }, []);

    const fetchThreads = useCallback(async () => {
        if (threadListStatus === 'LOADING') return;
        try {
            setThreadListStatus('LOADING');
            const accessToken = AuthService.getAccessToken();
            const sessionId = AuthService.getSessionId();

            const res = await fetch('/api/threads', {
                method: 'GET',
                headers: {
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                    ...(sessionId ? { 'x-session_id': sessionId } : {})
                },
                credentials: 'include'
            });

            if (!res.ok) {
                setThreadListStatus('FAILED');
                return;
            }
            const data = await res.json();
            setThreadList(Array.isArray(data) ? data : []);
            setThreadListStatus('SUCCESS');
        } catch (e) {
            setThreadListStatus('FAILED');
        }
    }, [threadListStatus]);

    return {
        threadId,
        setThreadId,
        threadInfo,
        setThread,
        fetchThreads,
        thread_list: threadList,
        thread_list_status: threadListStatus,
        delete_thread: null
    };
};



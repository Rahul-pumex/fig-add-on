import { setUser } from "@redux/slices/authSlice";
import { getTokenExpiry } from "./authConfig";
import { AuthService } from "./authService";
import { store } from "@redux/store";
import { useEffect } from "react";

/**
 * Fetch interceptor that automatically adds auth headers to API requests
 * This ensures CopilotKit and other API calls include authentication
 */
export const useFetchInterceptor = () => {
    useEffect(() => {
        const originalFetch = window.fetch;
        
        window.fetch = async (url, options = {}) => {
            const modifiedOptions: RequestInit = {
                ...options,
                headers: {
                    ...(options.headers as Record<string, string> || {})
                } as Record<string, string>
            };

            // Add authentication headers for API endpoints
            // This includes copilotkit and other authenticated endpoints
            if (
                typeof url === "string" &&
                (url.includes("/api/copilotkit") || 
                 url.startsWith("/api/") || 
                 (url.startsWith("http") && !url.includes("/api/auth/signin")))
            ) {
                // Skip adding auth headers if refresh is in progress to prevent loops
                if (!(AuthService as any).isRefreshing) {
                    // Get fresh tokens from Redux state at request time
                    const accessToken = AuthService.getAccessToken();
                    const sessionId = AuthService.getSessionId();

                    if (accessToken) {
                        (modifiedOptions.headers as Record<string, string>)["Authorization"] = `Bearer ${accessToken}`;
                    }
                    
                    if (sessionId) {
                        (modifiedOptions.headers as Record<string, string>)["x-session_id"] = sessionId;
                    }
                }
            }

            const response = await originalFetch(url, modifiedOptions);

            // Handle 401 Unauthorized responses - token expired or invalid
            if (response.status === 401) {
                const urlString = typeof url === "string" ? url : url.toString();
                
                // Don't redirect on auth endpoints to avoid loops
                const isAuthEndpoint = urlString.includes("/api/auth/") || 
                                      urlString.includes("/auth/") ||
                                      urlString.includes("signin") ||
                                      urlString.includes("signup");
                
                if (!isAuthEndpoint) {
                    console.warn("[FetchInterceptor] 401 Unauthorized received, clearing tokens and redirecting to login", {
                        url: urlString,
                        pathname: typeof window !== "undefined" ? window.location.pathname : "unknown"
                    });
                    
                    // Clear all tokens
                    AuthService.clearAllTokens();
                    
                    // Redirect to login page if not already there
                    if (typeof window !== "undefined" && !window.location.pathname.includes("/auth")) {
                        console.log("[FetchInterceptor] Redirecting to /auth due to 401");
                        // Use setTimeout to avoid interrupting the current response handling
                        setTimeout(() => {
                            window.location.href = "/auth";
                        }, 100);
                    }
                }
                
                // Return the response so the caller can handle it if needed
                return response;
            }

            // Check response for new tokens and update if present
            try {
                const headers = response.headers as Headers;

                const getHeaderValue = (h: Headers, name: string): string | null => {
                    return h.get(name) || h.get(name.toLowerCase()) || null;
                };

                const accessToken = getHeaderValue(headers, "st-access-token");
                const refreshToken = getHeaderValue(headers, "st-refresh-token");
                const frontToken = getHeaderValue(headers, "front-token");
                const sessionId = getHeaderValue(headers, "x-session_id") || "";

                // If both tokens present, store full token set
                if (accessToken && refreshToken) {
                    let accessTokenExpiry: number;
                    try {
                        accessTokenExpiry = getTokenExpiry(accessToken);
                    } catch {
                        accessTokenExpiry = Date.now() + 3600000; // 1h fallback
                    }
                    const refreshTokenExpiry = Date.now() + 30 * 24 * 60 * 60 * 1000;

                    AuthService.storeTokens({
                        accessToken,
                        refreshToken,
                        accessTokenExpiry,
                        refreshTokenExpiry,
                        sessionId
                    });

                    // Mark fresh login moment
                    try {
                        sessionStorage.setItem("just_logged_in", Date.now().toString());
                    } catch {}

                    // If front-token available, update user in store
                    if (frontToken) {
                        try {
                            const parts = frontToken.split(".");
                            if (parts.length > 0) {
                                const decodedFront = atob(parts[0]);
                                const front = JSON.parse(decodedFront);
                                if (front?.uid) {
                                    store.dispatch(
                                        setUser({
                                            userId: front.uid,
                                            email: front.up?.email || undefined,
                                            username: front.uid
                                        })
                                    );
                                }
                            }
                        } catch {}
                    }
                } else if (accessToken) {
                    // Only access token present: update it
                    let accessTokenExpiry: number;
                    try {
                        accessTokenExpiry = getTokenExpiry(accessToken);
                    } catch {
                        accessTokenExpiry = Date.now() + 3600000;
                    }
                    AuthService.storeAccessToken(accessToken, accessTokenExpiry);
                }
            } catch (e) {
                // Non-fatal - some responses won't have tokens
            }

            return response;
        };

        return () => {
            window.fetch = originalFetch;
        };
    }, []);
};


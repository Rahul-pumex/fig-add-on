import type { AppProps } from "next/app";
import { useEffect } from "react";
import { initAuth, AuthService, useFetchInterceptor } from "@utils";
import StoreProvider from "../redux/StoreProvider";
import { CopilotKit } from "@copilotkit/react-core";
import { ADMIN_AGENT_NAME } from "../constants";
import { SafeSuperTokensWrapper } from "../components/auth/SafeSuperTokensWrapper";
import AuthErrorBoundary from "../components/auth/AuthErrorBoundary";
import { inter } from "../assets/fonts/inter";
import "../styles/index.css";

// Initialize SuperTokens
initAuth();

function MyApp({ Component, pageProps }: AppProps) {
    // CRITICAL: Install fetch interceptor to add auth headers to all API requests
    useFetchInterceptor();
    useEffect(() => {
        if (typeof window !== "undefined") {
            // Enhanced global error handling for session errors
            const handleGlobalError = (event: ErrorEvent) => {
                if (
                    event.error?.message?.includes("No session exists") ||
                    event.error?.message?.includes("SuperTokens")
                ) {
                    console.warn("[App] Global session error handled:", event.error || event.message);
                    event.preventDefault();

                    const isAuthenticated = AuthService.isAuthenticated();
                    if (!isAuthenticated && !window.location.pathname.includes("/auth")) {
                        window.location.href = "/auth";
                    }
                }
            };

            const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
                if (
                    event.reason?.message?.includes("No session exists") ||
                    event.reason?.message?.includes("SuperTokens")
                ) {
                    console.warn("[App] Global promise rejection handled:", event.reason);
                    event.preventDefault();

                    const isAuthenticated = AuthService.isAuthenticated();
                    if (!isAuthenticated && !window.location.pathname.includes("/auth")) {
                        window.location.href = "/auth";
                    }
                }
            };

            window.addEventListener("error", handleGlobalError);
            window.addEventListener("unhandledrejection", handleUnhandledRejection);

            // IMMEDIATE CLEANUP: Check localStorage for persisted tokens and clear SuperTokens if none exist
            // This runs synchronously to prevent SuperTokens from making unauthorized API calls
            // BUT: Skip if we just logged in (to avoid race condition)
            try {
                const justLoggedInTs = sessionStorage.getItem("just_logged_in");
                const isVeryRecentLogin = !!justLoggedInTs && (Date.now() - Number(justLoggedInTs) < 15000); // 15s grace
                
                if (isVeryRecentLogin) {
                    // Skip cleanup for recent login
                } else {
                    const persistedState = localStorage.getItem("persist:root");
                    if (persistedState) {
                        const parsed = JSON.parse(persistedState);
                        const authState = parsed.auth ? JSON.parse(parsed.auth) : null;
                        const hasTokensInStorage = !!(authState?.tokens?.accessToken && authState?.tokens?.refreshToken);
                        
                        if (!hasTokensInStorage) {
                            // Clear SuperTokens cookies immediately
                            const cookiesToClear = [
                                "st-access-token", "st-refresh-token", "front-token", "sFrontToken",
                                "sAccessToken", "sRefreshToken", "sIdRefreshToken", "st-last-access-token-update"
                            ];
                            cookiesToClear.forEach((cookieName) => {
                                document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
                            });
                        }
                    }
                }
            } catch (e) {
                console.warn("[App] Error in immediate cleanup:", e);
            }

            // CRITICAL FIX: Wait for Redux to hydrate before doing full cleanup
            // This prevents clearing tokens before Redux has loaded them from localStorage
            const performCleanup = async () => {
                // Wait for Redux persist to hydrate (longer delay to ensure hydration completes)
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const justLoggedInTs = sessionStorage.getItem("just_logged_in");
                const justLoggedIn = !!justLoggedInTs && Date.now() - Number(justLoggedInTs) < 10_000;
                const isAuthenticated = AuthService.isAuthenticated();

                // Only cleanup if definitely not authenticated AND not in grace period
                if (!isAuthenticated && !justLoggedIn) {
                    try {
                        // Clear SuperTokens localStorage
                        const keysToRemove: string[] = [];
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key && (key.includes("supertokens") || key.includes("st-") || key.includes("front-token") || key.startsWith("sFrontToken"))) {
                                keysToRemove.push(key);
                            }
                        }
                        keysToRemove.forEach((key) => localStorage.removeItem(key));

                        // Clear SuperTokens cookies more aggressively
                        const cookiesToClear = [
                            "st-access-token",
                            "st-refresh-token",
                            "front-token",
                            "sFrontToken",
                            "sAccessToken",
                            "sRefreshToken",
                            "sIdRefreshToken",
                            "st-last-access-token-update"
                        ];
                        cookiesToClear.forEach((cookieName) => {
                            // Clear for root domain
                            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
                            // Clear for domain
                            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
                            // Clear for localhost specifically
                            if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
                                document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=localhost`;
                            }
                        });
                    } catch (error) {
                        console.warn("Error during SuperTokens cleanup:", error);
                    }
                } else if (justLoggedIn) {
                    // Clear the just_logged_in flag after a delay
                    setTimeout(() => {
                        try {
                            sessionStorage.removeItem("just_logged_in");
                        } catch {}
                    }, 5000);
                }
            };

            // Run cleanup after hydration
            performCleanup();

            return () => {
                window.removeEventListener("error", handleGlobalError);
                window.removeEventListener("unhandledrejection", handleUnhandledRejection);
            };
        }
    }, []);

    return (
        <div className={inter.variable}>
            <StoreProvider>
                <AuthErrorBoundary>
                    <SafeSuperTokensWrapper>
                        <CopilotKit runtimeUrl="/api/copilotkit" agent={ADMIN_AGENT_NAME}>
                            <Component {...pageProps} />
                        </CopilotKit>
                    </SafeSuperTokensWrapper>
                </AuthErrorBoundary>
            </StoreProvider>
        </div>
    );
}

export default MyApp;



import { EmailPasswordPreBuiltUI } from "supertokens-auth-react/recipe/emailpassword/prebuiltui";
import SuperTokens from "supertokens-auth-react/ui";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { AuthService } from "@utils";
import { GridSpinner } from "@components/atoms/GridSpinner";

const PreBuiltUIList = [EmailPasswordPreBuiltUI];

export default function Auth() {
    const [loaded, setLoaded] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const checkAuthAndLoad = async () => {
            // Wait a moment for Redux to hydrate
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Check if already authenticated
            const isAuthenticated = AuthService.isAuthenticated();
            
            if (isAuthenticated) {
                router.replace("/chat");
                return;
            }

            // Only clear old login flags if they're actually old (not from a recent login attempt)
            const justLoggedInTs = sessionStorage.getItem("just_logged_in");
            if (justLoggedInTs) {
                const timeSinceLogin = Date.now() - Number(justLoggedInTs);
                
                // Only clear if more than 10 seconds old
                if (timeSinceLogin > 10000) {
                    sessionStorage.removeItem("just_logged_in");
                    sessionStorage.removeItem("login_timestamp");
                    localStorage.removeItem("fresh_login");
                }
            }

            // Clear redirect flags when landing on auth page
            sessionStorage.removeItem("auth_redirecting");
            sessionStorage.removeItem("auth_redirecting_time");

            if (SuperTokens.canHandleRoute(PreBuiltUIList) === true) {
                setLoaded(true);
            }
        };

        checkAuthAndLoad();
    }, [router]);

    if (loaded) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-white via-[#F5F0F3] to-[#E8DDE3]">
                <div className="w-full max-w-md p-8 bg-transparent ">
                    {SuperTokens.getRoutingComponent(PreBuiltUIList)}
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center h-screen bg-gradient-to-b from-white via-[#F5F0F3] to-[#E8DDE3]">
            <GridSpinner height={48} width={48} />
        </div>
    );
}


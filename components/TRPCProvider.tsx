"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpSubscriptionLink, splitLink } from "@trpc/client";
import { useMemo, useEffect, useState, useRef } from "react";
import { trpc } from "../utils/trpc";
import { useIsChatGptApp, useOpenAIGlobal } from "../app/hooks";
import { useClerkReady } from "./ConditionalClerkProvider";
// This import is safe because ClerkAuthWrapper only renders when ClerkProvider exists
import { useAuth } from "@clerk/nextjs";

// Helper to check if JWT is expired
function isTokenExpired(token: string) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const { exp } = JSON.parse(jsonPayload);
    if (!exp) return false;
    // Check if token expires in the next 10 seconds
    return Date.now() >= exp * 1000 - 10000;
  } catch (e) {
    return true; // If we can't parse it, assume it's invalid/expired
  }
}

// Component that uses Clerk auth - only rendered when ClerkProvider is available
function ClerkAuthWrapper({
  onTokenChange,
  onGetToken,
  isChatGptApp,
}: {
  onTokenChange: (token: string | null) => void;
  onGetToken: (getToken: any) => void;
  isChatGptApp: boolean;
}) {
  // This component only renders when ClerkProvider exists, so useAuth is safe here
  const { getToken, isLoaded } = useAuth();

  useEffect(() => {
    if (!isChatGptApp && isLoaded && getToken) {
      // Share the getToken function with the parent
      onGetToken(getToken);

      // Initial token fetch
      const fetchToken = async () => {
        try {
          const token = await getToken();
          onTokenChange(token);
        } catch (error) {
          console.error("Failed to get Clerk token:", error);
          onTokenChange(null);
        }
      };

      // Fetch immediately
      fetchToken();

      // Set up periodic refresh every 30 seconds (before typical 60-second expiry)
      // This ensures tokens are refreshed well before they expire, preventing auth failures
      const refreshInterval = setInterval(() => {
        fetchToken();
      }, 30000); // 30 seconds - refresh twice per token lifetime for safety

      // Cleanup interval on unmount or dependency change
      return () => {
        clearInterval(refreshInterval);
      };
    }
  }, [isChatGptApp, isLoaded, getToken, onTokenChange, onGetToken]);

  return null;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return makeQueryClient();
  } else {
    // Browser: make a new query client if we don't already have one
    // This is very important, so we don't re-make a new client if React
    // suspends during the initial render. This may not be needed if we
    // have a suspense boundary BELOW the creation of the query client
    if (!browserQueryClient) browserQueryClient = makeQueryClient();
    return browserQueryClient;
  }
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  console.log("TRPCProvider");
  const queryClient = getQueryClient();
  const widgetMeta = useOpenAIGlobal("toolResponseMetadata");
  console.log("TRPCProvider widget meta", widgetMeta);
  const isChatGptApp = useIsChatGptApp();
  const isClerkReady = useClerkReady();

  // State for Clerk token (when not in ChatGPT context)
  const [clerkToken, setClerkToken] = useState<string | null>(null);
  const getTokenRef = useRef<any>(null);

  // Memoize the callback to avoid re-creating it on every render
  const handleTokenChange = useMemo(
    () => (token: string | null) => setClerkToken(token),
    []
  );

  const handleGetToken = useMemo(
    () => (getToken: any) => {
      getTokenRef.current = getToken;
    },
    []
  );

  // Extract authInfo from widgetMeta (ChatGPT context)
  const chatGptAuthToken = useMemo(() => {
    if (
      widgetMeta &&
      typeof widgetMeta === "object" &&
      "userJwt" in widgetMeta
    ) {
      console.log(
        "TRPCProvider setting up trpc with auth info",
        widgetMeta.authInfo,
        "and userJwt",
        widgetMeta.userJwt
      );
      const userJwt = widgetMeta.userJwt;
      // authInfo might be a string token or an object with a token property
      if (typeof userJwt === "string") {
        return userJwt;
      }
    }
    return null;
  }, [widgetMeta]);

  // Use ChatGPT token if available, otherwise use Clerk token
  const authToken = isChatGptApp ? chatGptAuthToken : clerkToken;

  const trpcClient = useMemo(
    () =>
      trpc.createClient({
        links: [
          splitLink({
            condition: (op) => op.type === "subscription",
            // SSE link for subscriptions
            true: httpSubscriptionLink({
              url: "/api/trpc",
              eventSourceOptions() {
                const headers: Record<string, string> = {};
                if (authToken) {
                  // Use CustomBearer prefix for ChatGPT tokens, Bearer for Clerk tokens
                  const prefix = isChatGptApp ? "CustomBearer" : "Bearer";
                  headers.Authorization = `${prefix} ${authToken}`;
                }
                return { headers };
              },
            }),
            // Batch HTTP link for queries and mutations
            false: httpBatchLink({
              url: "/api/trpc",
              async headers() {
                const headers: Record<string, string> = {};

                // Default to the state-based token
                let token = authToken;

                // If we have a fresh token getter and we're not in ChatGPT mode, try to get a fresh token
                // This avoids issues where the state-based token is stale (e.g. after tab suspension)
                if (!isChatGptApp && getTokenRef.current) {
                  try {
                    // Only refresh if the current token is missing or expired (with buffer)
                    // This prevents checking for a fresh token on every single request (performance)
                    if (!token || isTokenExpired(token)) {
                      const freshToken = await getTokenRef.current();
                      if (freshToken) {
                        token = freshToken;
                      }
                    }
                  } catch (error) {
                    console.error(
                      "Failed to get fresh Clerk token for TRPC request:",
                      error
                    );
                    // Fallback to existing token in state if fresh fetch fails
                  }
                }

                if (token) {
                  // Use CustomBearer prefix for ChatGPT tokens, Bearer for Clerk tokens
                  const prefix = isChatGptApp ? "CustomBearer" : "Bearer";
                  headers.Authorization = `${prefix} ${token}`;
                }
                return headers;
              },
            }),
          }),
        ],
      }),
    [authToken, isChatGptApp]
  );

  console.log(
    "TRPCProvider missing authToken",
    !authToken,
    "isChatGptApp",
    isChatGptApp,
    "both true means we show the loader"
  );

  if (!authToken && isChatGptApp) {
    return (
      <div className="flex flex-col gap-4 p-8 animate-pulse">
        <div className="h-8 bg-gray-200 rounded-md w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="space-y-3 mt-4">
          <div className="h-12 bg-gray-200 rounded-lg"></div>
          <div className="h-12 bg-gray-200 rounded-lg"></div>
          <div className="h-12 bg-gray-200 rounded-lg"></div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="h-24 bg-gray-200 rounded-lg"></div>
          <div className="h-24 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {/* Only render ClerkAuthWrapper when ClerkProvider is available */}
        {!isChatGptApp && isClerkReady && (
          <ClerkAuthWrapper
            onTokenChange={handleTokenChange}
            onGetToken={handleGetToken}
            isChatGptApp={isChatGptApp}
          />
        )}
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}

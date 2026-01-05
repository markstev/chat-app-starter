"use client";

import { useIsChatGptApp } from "@/app/hooks";
import {
  ReactNode,
  useEffect,
  useState,
  createContext,
  useContext,
} from "react";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { AmplitudeUserProvider } from "@/app/hooks/use-amplitude";

// Context to track if Clerk is ready
const ClerkReadyContext = createContext<boolean>(false);

export function useClerkReady() {
  return useContext(ClerkReadyContext);
}

// Component that uses Clerk hooks - only rendered when ClerkProvider is available
// This component only renders when ClerkProvider exists, so useUser is safe here
function AmplitudeUserWrapper({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();

  // Calculate admin status from user metadata
  const isAdmin =
    user?.publicMetadata &&
    typeof user.publicMetadata === "object" &&
    "role" in user.publicMetadata &&
    (user.publicMetadata as { role?: string }).role === "admin";

  return (
    <AmplitudeUserProvider
      userId={user?.id}
      isLoaded={isLoaded}
      isAdmin={isAdmin ?? false}
    >
      {children}
    </AmplitudeUserProvider>
  );
}

export function ConditionalClerkProvider({
  children,
}: {
  children: ReactNode;
}) {
  const isChatGptApp = useIsChatGptApp();
  const [ClerkProvider, setClerkProvider] = useState<any>(null);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    if (!isChatGptApp) {
      console.log("Importing Clerk");
      // Only import Clerk when not in ChatGPT app
      import("@clerk/nextjs").then((mod) => {
        setClerkProvider(() => mod.ClerkProvider);
      });
    }
  }, [isChatGptApp]);

  useEffect(() => {
    // Check if we're in an iframe
    setIsInIframe(window.self !== window.top);
  }, []);

  console.log("ConditionalClerkProvider isChatGptApp", isChatGptApp);

  if (isChatGptApp) {
    return (
      <ClerkReadyContext.Provider value={false}>
        <AmplitudeUserProvider isLoaded={true} isAdmin={false}>
          {children}
        </AmplitudeUserProvider>
      </ClerkReadyContext.Provider>
    );
  }

  // Show loading state while Clerk is being imported
  if (!ClerkProvider) {
    return (
      <ClerkReadyContext.Provider value={false}>
        <AmplitudeUserProvider isLoaded={false} isAdmin={false}>
          {children}
        </AmplitudeUserProvider>
      </ClerkReadyContext.Provider>
    );
  }

  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
    >
      <ClerkReadyContext.Provider value={true}>
        <AmplitudeUserWrapper>
          {!isInIframe && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 w-full shadow-sm mb-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <svg
                    className="w-5 h-5 text-slate-600 dark:text-slate-400 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                    />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <SignedOut>
                      <p className="text-sm text-slate-900 dark:text-slate-100 font-medium">
                        Sign in to access your account
                      </p>
                    </SignedOut>
                    <SignedIn>
                      <p className="text-sm text-slate-900 dark:text-slate-100 font-medium">
                        Welcome back!
                      </p>
                    </SignedIn>
                  </div>
                </div>
                <SignedOut>
                  <SignInButton mode="modal">
                    <button className="rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-3 py-1.5 text-sm font-semibold shadow-sm hover:bg-slate-700 dark:hover:bg-slate-300 transition-colors">
                      Sign In
                    </button>
                  </SignInButton>
                </SignedOut>
                <SignedIn>
                  <UserButton afterSignOutUrl="/" />
                </SignedIn>
              </div>
            </div>
          )}
          {children}
        </AmplitudeUserWrapper>
      </ClerkReadyContext.Provider>
    </ClerkProvider>
  );
}

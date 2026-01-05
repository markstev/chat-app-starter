"use client";

import React, {
  useEffect,
  useCallback,
  createContext,
  useContext,
} from "react";
import {
  initAmplitude,
  trackEvent,
  getDomainFromHost,
} from "@/utils/amplitude";

let initializationAttempted = false;

// Context to hold user info from Clerk
export const AmplitudeUserContext = createContext<{
  userId: string | undefined;
  isLoaded: boolean;
  isAdmin: boolean;
}>({ userId: undefined, isLoaded: false, isAdmin: false });

/**
 * Hook to track events with Amplitude
 * Automatically includes isAdmin and domain properties
 * Works even when Clerk is not available (e.g., in ChatGPT app)
 */
export function useAmplitude() {
  const { userId, isLoaded, isAdmin } = useContext(AmplitudeUserContext);

  // Initialize Amplitude once when loaded
  useEffect(() => {
    if (typeof window === "undefined" || initializationAttempted) {
      return;
    }

    if (isLoaded) {
      initAmplitude(userId);
      initializationAttempted = true;
    }
  }, [isLoaded, userId]);

  const track = useCallback(
    (eventName: string, eventProperties?: Record<string, unknown>) => {
      if (typeof window === "undefined") {
        return;
      }

      const domain = getDomainFromHost();
      const properties = {
        ...eventProperties,
        isAdmin,
        domain,
      };

      trackEvent(eventName, properties, userId);
    },
    [isAdmin, userId]
  );

  return { track };
}

// Provider component that accepts userId, isLoaded, and isAdmin as props
export function AmplitudeUserProvider({
  children,
  userId,
  isLoaded,
  isAdmin,
}: {
  children: React.ReactNode;
  userId?: string | undefined;
  isLoaded?: boolean;
  isAdmin?: boolean;
}) {
  const contextValue = {
    userId: userId ?? undefined,
    isLoaded: isLoaded ?? false,
    isAdmin: isAdmin ?? false,
  };

  return React.createElement(
    AmplitudeUserContext.Provider,
    { value: contextValue },
    children
  );
}
